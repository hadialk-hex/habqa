// ─────────────────────────────────────────────────────────────────
// Meta Graph API — Centralized HTTP Client
// Wraps every outbound Graph API call with:
//   • Automatic retry + exponential backoff for transient errors
//   • Rate-limit header monitoring (X-App-Usage, X-Page-Usage)
//   • Structured error classification (→ graph-api-errors.ts)
//   • Sender actions (typing_on) helper
//
// Reference: docs/meta-api/09-rate-limits.md, 10-error-codes.md
// ─────────────────────────────────────────────────────────────────
import { Logger } from '@nestjs/common';
import { GRAPH_API_BASE } from './graph-api';
import {
  classifyError,
  extractGraphError,
  logGraphError,
  ErrorAction,
  type GraphApiError,
} from './graph-api-errors';

const logger = new Logger('GraphApiClient');

// ── Rate-limit monitoring ───────────────────────────────────────

interface UsageMetrics {
  call_count: number;
  total_cputime: number;
  total_time: number;
}

/**
 * Reads X-App-Usage / X-Page-Usage headers and logs warnings when
 * approaching limits.  The thresholds follow Meta's recommendation:
 *   80% → WARN   95% → ERROR
 */
function checkRateLimitHeaders(headers: Headers, context: string): void {
  for (const headerName of ['x-app-usage', 'x-page-usage']) {
    const raw = headers.get(headerName);
    if (!raw) continue;
    try {
      const usage: UsageMetrics = JSON.parse(raw);
      const maxVal = Math.max(
        usage.call_count ?? 0,
        usage.total_cputime ?? 0,
        usage.total_time ?? 0,
      );
      if (maxVal >= 95) {
        logger.error(
          `🛑 [${headerName}] ${context} — usage at ${maxVal}%! Throttling required.`,
        );
      } else if (maxVal >= 80) {
        logger.warn(
          `⚠️ [${headerName}] ${context} — usage at ${maxVal}%. Approaching limit.`,
        );
      }
    } catch {
      // Malformed header — ignore silently
    }
  }
}

// ── Main request wrapper ────────────────────────────────────────

export interface GraphRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown> | string;
  token: string;
  /** Human-readable label for logs, e.g. "sendDM" or "commentReply". */
  context?: string;
  /** Max retry attempts for transient errors (default 2). */
  maxRetries?: number;
  /**
   * Per-attempt timeout in ms (default 15s). A stalled Graph connection
   * (not an HTTP error — just a connection that never resolves) would
   * otherwise hang indefinitely, which in a webhook-processing request can
   * block past Meta's ~20s response window and delay the 200 OK back to it.
   */
  timeoutMs?: number;
}

export interface GraphResponse<T = any> {
  ok: boolean;
  data: T | null;
  /** Set when Meta returns a structured error. */
  error: GraphApiError | null;
  /** The raw HTTP status code. */
  status: number;
  /** PSID / recipient_id returned by the Send API (if present). */
  recipientId?: string;
}

/**
 * Central Graph API request wrapper.
 *
 * Every outbound call to `graph.facebook.com` should go through this
 * function so we get uniform retry, error classification, and rate-
 * limit monitoring across the entire backend.
 *
 * @param path  Relative path after `GRAPH_API_BASE`, e.g. `/me/messages`
 *              or an absolute URL for Instagram-specific endpoints.
 */
export async function graphApiRequest<T = any>(
  path: string,
  options: GraphRequestOptions,
): Promise<GraphResponse<T>> {
  const {
    method = 'POST',
    body,
    token,
    context = 'graphApiRequest',
    maxRetries = 2,
    timeoutMs = 15_000,
  } = options;

  const url = path.startsWith('http') ? path : `${GRAPH_API_BASE}${path}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body
          ? typeof body === 'string'
            ? body
            : JSON.stringify(body)
          : undefined,
        signal: abortController.signal,
      };

      const response = await fetch(url, fetchOptions);

      // ── Rate-limit monitoring ──
      checkRateLimitHeaders(response.headers, context);

      // ── Success ──
      if (response.ok) {
        let data: T | null = null;
        try {
          data = (await response.json()) as T;
        } catch {
          // Some endpoints return empty 200 — that's fine
        }
        return {
          ok: true,
          data,
          error: null,
          status: response.status,
          recipientId: (data as any)?.recipient_id,
        };
      }

      // ── Error ──
      const graphError = await extractGraphError(response);
      if (graphError) {
        const classified = classifyError(graphError);
        logGraphError(context, graphError, classified);

        switch (classified.action) {
          case ErrorAction.RETRY:
            if (attempt < maxRetries) {
              await delay(classified.delayMs ?? 2_000);
              continue;
            }
            break;

          case ErrorAction.RETRY_AFTER_DELAY:
            if (attempt < maxRetries && classified.delayMs) {
              // Cap the wait at 30 seconds in webhook context to avoid
              // Meta's 20-second webhook response timeout.
              const waitMs = Math.min(classified.delayMs, 30_000);
              await delay(waitMs);
              continue;
            }
            break;

          // Non-retryable — fall through to return
          case ErrorAction.REAUTH:
          case ErrorAction.FIX_REQUEST:
          case ErrorAction.SKIP:
          case ErrorAction.ALERT:
            break;
        }

        return {
          ok: false,
          data: null,
          error: graphError,
          status: response.status,
        };
      }

      // Non-Graph error (e.g. 502 from proxy)
      logger.error(
        `[${context}] HTTP ${response.status} ${response.statusText} (no Graph error body)`,
      );
      if (attempt < maxRetries) {
        await delay(Math.pow(2, attempt) * 1_000);
        continue;
      }

      return { ok: false, data: null, error: null, status: response.status };
    } catch (networkError: any) {
      const isTimeout = networkError.name === 'AbortError';
      logger.error(
        `[${context}] ${isTimeout ? `Timed out after ${timeoutMs}ms` : 'Network error'} (attempt ${attempt + 1}/${maxRetries + 1}): ${networkError.message}`,
      );
      if (attempt < maxRetries) {
        await delay(Math.pow(2, attempt) * 1_000);
        continue;
      }
      return { ok: false, data: null, error: null, status: 0 };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  // Should never reach here, but TypeScript needs it
  return { ok: false, data: null, error: null, status: 0 };
}

// ── Sender Actions ──────────────────────────────────────────────

/**
 * Sends a `typing_on` indicator before an auto-reply so the
 * conversation feels natural.  Best-effort — never throws.
 *
 * Supported on: Messenger, Instagram.
 * NOT supported on: WhatsApp (use a different read-receipt API).
 */
export async function sendTypingIndicator(
  recipientId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`${GRAPH_API_BASE}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: 'typing_on',
      }),
    });
  } catch {
    // Best-effort — typing indicators must never block message delivery
  }
}

/**
 * Sends `mark_seen` to show the blue read-receipt indicator.
 * Best-effort — never throws.
 */
export async function sendMarkSeen(
  recipientId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`${GRAPH_API_BASE}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: 'mark_seen',
      }),
    });
  } catch {
    // Best-effort
  }
}

// ── WhatsApp Messaging ──────────────────────────────────────────

export interface WhatsAppTextMessage {
  type: 'text';
  text: string;
}

export interface WhatsAppImageMessage {
  type: 'image';
  imageUrl: string;
  caption?: string;
}

export interface WhatsAppTemplateMessage {
  type: 'template';
  templateName: string;
  languageCode: string;
  components?: any[]; // The template components (header, body, buttons variables)
}

export type WhatsAppOutboundMessage =
  WhatsAppTextMessage | WhatsAppImageMessage | WhatsAppTemplateMessage;

/**
 * Sends a message via WhatsApp Cloud API.
 *
 * @param phoneNumberId  The Page's WhatsApp phone_number_id (platformId).
 * @param to             The recipient's phone number in international format.
 * @param msg            The message payload.
 * @param token          Decrypted access token.
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  msg: WhatsAppOutboundMessage,
  token: string,
): Promise<GraphResponse> {
  let body: Record<string, unknown>;

  switch (msg.type) {
    case 'text':
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: msg.text },
      };
      break;

    case 'image':
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: {
          link: msg.imageUrl,
          ...(msg.caption ? { caption: msg.caption } : {}),
        },
      };
      break;

    case 'template':
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: msg.templateName,
          language: { code: msg.languageCode },
          ...(msg.components ? { components: msg.components } : {}),
        },
      };
      break;

    default:
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: String((msg as any).text ?? '') },
      };
  }

  return graphApiRequest(`/${phoneNumberId}/messages`, {
    token,
    body,
    context: 'sendWhatsAppMessage',
  });
}

// ── Instagram Content Publishing ────────────────────────────────

/**
 * Publishes a photo or video to an Instagram Professional account.
 * This is a two-step process: create container, then publish.
 *
 * @param igUserId The Instagram User ID (not the Page ID).
 * @param imageUrl The public URL of the media.
 * @param caption Optional caption for the post.
 * @param token The decrypted page access token.
 */
export async function publishInstagramMedia(
  igUserId: string,
  imageUrl: string,
  caption: string,
  token: string,
): Promise<GraphResponse> {
  // Step 1: Create media container
  const containerRes = await graphApiRequest(`/${igUserId}/media`, {
    method: 'POST',
    token,
    body: {
      image_url: imageUrl,
      caption: caption || '',
    },
    context: 'publishInstagramMedia_Container',
  });

  if (!containerRes.ok || !containerRes.data?.id) {
    return containerRes; // Return the error
  }

  const creationId = containerRes.data.id;

  // Step 2: Publish the container
  return graphApiRequest(`/${igUserId}/media_publish`, {
    method: 'POST',
    token,
    body: {
      creation_id: creationId,
    },
    context: 'publishInstagramMedia_Publish',
  });
}

// ── Media Upload (WhatsApp) ─────────────────────────────────────

/**
 * Uploads media to WhatsApp to get an ID for templates/messages.
 * Note: Body should be a FormData object containing messaging_product and file.
 */
export async function uploadWhatsAppMedia(
  phoneNumberId: string,
  formData: any,
  token: string,
): Promise<GraphResponse> {
  // Use raw fetch because FormData changes Content-Type headers automatically
  // (We cannot set application/json on multipart/form-data)
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/media`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON body — leave data null and rely on the HTTP status
    }

    if (response.ok) {
      return { ok: true, data, error: null, status: response.status };
    } else {
      return {
        ok: false,
        data: null,
        error: data?.error,
        status: response.status,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      error: { message: err.message } as any,
      status: 500,
    };
  }
}

// ── Utility ─────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
