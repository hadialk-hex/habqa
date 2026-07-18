// ─────────────────────────────────────────────────────────────────
// Telegram Bot API — thin client + webhook-secret derivation
// Docs: https://core.telegram.org/bots/api
// Each tenant connects their OWN bot (created via @BotFather); the bot
// token is AES-encrypted at rest like every other channel token.
// ─────────────────────────────────────────────────────────────────
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('TelegramApi');

export const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramResponse<T = any> {
  ok: boolean;
  result: T | null;
  description?: string;
}

export async function telegramRequest<T = any>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramResponse<T>> {
  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const data: any = await response.json().catch(() => ({}));
    if (!data?.ok) {
      logger.warn(
        `Telegram ${method} failed: ${data?.description || `HTTP ${response.status}`}`,
      );
      return {
        ok: false,
        result: null,
        description: data?.description || `HTTP ${response.status}`,
      };
    }
    return { ok: true, result: data.result as T };
  } catch (err: any) {
    logger.error(`Telegram ${method} network error: ${err.message}`);
    return { ok: false, result: null, description: err.message };
  }
}

// Deterministic per-connection webhook secret (Telegram echoes it back in
// the X-Telegram-Bot-Api-Secret-Token header) — derived from the server's
// ENCRYPTION_KEY so nothing extra needs storing.
export function telegramWebhookSecret(connectionId: string): string {
  const key = process.env.ENCRYPTION_KEY || 'hubqa';
  return crypto
    .createHmac('sha256', key)
    .update(`telegram-webhook:${connectionId}`)
    .digest('hex')
    .slice(0, 48);
}
