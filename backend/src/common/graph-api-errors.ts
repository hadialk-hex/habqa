// ─────────────────────────────────────────────────────────────────
// Meta Graph API — Centralized Error Classifier
// Reference: docs/meta-api/10-error-codes.md
// ─────────────────────────────────────────────────────────────────
import { Logger } from '@nestjs/common';

const logger = new Logger('GraphApiErrors');

// ── Types ───────────────────────────────────────────────────────

/** Shape of the `error` object inside a Graph API JSON error response. */
export interface GraphApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

/** What the caller should do after classifying the error. */
export enum ErrorAction {
  /** Retry immediately (transient server hiccup). */
  RETRY = 'RETRY',
  /** Wait `delayMs` then retry (rate-limit / temporary outage). */
  RETRY_AFTER_DELAY = 'DELAY',
  /** Token is invalid/expired — the user must re-authenticate. */
  REAUTH = 'REAUTH',
  /** The request itself is malformed — do not retry. */
  FIX_REQUEST = 'FIX',
  /** Duplicate / already-handled — skip silently. */
  SKIP = 'SKIP',
  /** Unknown or severe — alert the dev team. */
  ALERT = 'ALERT',
}

export interface ClassifiedError {
  action: ErrorAction;
  /** Suggested wait (ms) before retry.  Only present for RETRY / DELAY. */
  delayMs?: number;
  /** Optional Arabic message safe to show the tenant in the dashboard. */
  userMessage?: string;
}

// ── Classifier ──────────────────────────────────────────────────

/**
 * Inspects a Graph API error body and returns what the caller should do.
 *
 * The logic is built on `code` + `error_subcode` — never on the human-
 * readable `message` string which Meta may change without notice.
 */
export function classifyError(error: GraphApiError): ClassifiedError {
  switch (error.code) {
    // ═══ Transient / Unknown ═══
    case 1:
      return { action: ErrorAction.RETRY, delayMs: 2_000 };
    case 2:
      return { action: ErrorAction.RETRY_AFTER_DELAY, delayMs: 15_000 };

    // ═══ Rate Limits ═══
    case 4: // Application request limit
      return {
        action: ErrorAction.RETRY_AFTER_DELAY,
        delayMs: 300_000, // 5 min
        userMessage: 'تم تجاوز حد الطلبات. سنعاود المحاولة خلال 5 دقائق.',
      };
    case 17: // User-level rate limit
      return { action: ErrorAction.RETRY_AFTER_DELAY, delayMs: 900_000 };
    case 32: // Page-level rate limit
      return { action: ErrorAction.RETRY_AFTER_DELAY, delayMs: 1_800_000 };

    // ═══ Permission Errors ═══
    case 10:
    case 200:
    case 299:
      return {
        action: ErrorAction.REAUTH,
        userMessage: 'يرجى إعادة ربط حسابك لمنح الأذونات المطلوبة.',
      };

    // ═══ Token / OAuth Errors ═══
    case 190:
      if (error.error_subcode === 463) {
        return {
          action: ErrorAction.REAUTH,
          userMessage: 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.',
        };
      }
      if (error.error_subcode === 460) {
        return {
          action: ErrorAction.REAUTH,
          userMessage: 'تم تعديل كلمة المرور. يرجى إعادة تسجيل الدخول.',
        };
      }
      if (error.error_subcode === 464) {
        return {
          action: ErrorAction.REAUTH,
          userMessage: 'الحساب غير نشط أو لم يتم التحقق منه.',
        };
      }
      if (error.error_subcode === 467) {
        return {
          action: ErrorAction.REAUTH,
          userMessage: 'انتهت صلاحية Access Token.',
        };
      }
      if (error.error_subcode === 492) {
        return {
          action: ErrorAction.REAUTH,
          userMessage: 'تم سحب الصلاحيات. يرجى إعادة ربط الحساب.',
        };
      }
      return { action: ErrorAction.REAUTH };

    case 102: // Session expired
      return { action: ErrorAction.REAUTH };

    // ═══ Request Errors ═══
    case 100: // Invalid parameter
      return { action: ErrorAction.FIX_REQUEST };
    case 104: // Incorrect signature
      return { action: ErrorAction.ALERT };

    // ═══ Duplicate ═══
    case 506: // Duplicate post
      return { action: ErrorAction.SKIP };

    // ═══ WhatsApp-Specific ═══
    case 131047: // Outside 24h window — need template
      return {
        action: ErrorAction.SKIP,
        userMessage: 'تجاوزت نافذة 24 ساعة. يلزم إرسال Template Message.',
      };
    case 131021: // Recipient not on WhatsApp
      return { action: ErrorAction.SKIP };
    case 130429: // WhatsApp Cloud API rate limit
      return { action: ErrorAction.RETRY_AFTER_DELAY, delayMs: 60_000 };
    case 132000: // Template param count mismatch
    case 132001: // Template doesn't exist
    case 132005: // Template hydration failed
    case 132007: // Template not in approved language
    case 132012: // Template param format policy violation
    case 132015: // Template paused
    case 132016: // Template disabled
      return { action: ErrorAction.FIX_REQUEST };

    default:
      return { action: ErrorAction.ALERT };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Extracts and returns the Graph API error object from a Response,
 * or `null` if the body isn't a valid Graph error.
 */
export async function extractGraphError(
  response: Response,
): Promise<GraphApiError | null> {
  try {
    const body = await response.json();
    if (body?.error?.code !== undefined) {
      return body.error as GraphApiError;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Logs a structured Graph API error with all useful fields.
 */
export function logGraphError(
  context: string,
  error: GraphApiError,
  classified: ClassifiedError,
): void {
  logger.error(
    `[Graph API Error] ${context} ` +
      `| code=${error.code} subcode=${error.error_subcode ?? '-'} ` +
      `| action=${classified.action} ` +
      `| fbtrace=${error.fbtrace_id ?? 'N/A'} ` +
      `| msg="${error.message}"`,
  );
}
