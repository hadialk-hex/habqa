// ─────────────────────────────────────────────────────────────────
// SSRF protection for tenant-supplied URLs (outbound webhooks today;
// anything else that fetches a user-controlled URL should reuse this).
//
// A malicious tenant could point the outbound-webhook URL at
// 169.254.169.254 (cloud metadata), 127.0.0.1, an internal Docker
// hostname, etc. This validates the *resolved* IP — not just the
// hostname string — against every private/reserved range, and is
// called both at configuration time and again immediately before each
// dispatch (DNS can change between the two).
//
// Known limitation: re-resolving right before fetch narrows but does not
// fully eliminate DNS-rebinding races. Full protection needs pinning the
// validated IP for the actual TCP connection, which native fetch doesn't
// support without a custom dispatcher — acceptable trade-off for now.
// ─────────────────────────────────────────────────────────────────
import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns/promises';
import * as net from 'net';

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed → treat as unsafe
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — recheck the embedded IPv4 address
    const mapped = lower.split(':').pop()!;
    if (net.isIPv4(mapped)) return isPrivateIPv4(mapped);
    return true;
  }
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  return false;
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized format → refuse rather than risk it
}

// Throws BadRequestException (Arabic message) if the URL is not a
// safe-to-fetch public https(s) endpoint. Resolves DNS itself — do not
// pass IP literals expecting them to be skipped.
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('الرابط غير صالح');
  }

  const isLocalDev =
    process.env.NODE_ENV !== 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !(isLocalDev && url.protocol === 'http:')) {
    throw new BadRequestException('الرابط يجب أن يبدأ بـ https://');
  }
  if (isLocalDev) return; // explicit local-dev escape hatch, never in prod

  if (net.isIP(url.hostname)) {
    if (isPrivateIP(url.hostname)) {
      throw new BadRequestException(
        'لا يُسمح بروابط تشير إلى عناوين شبكة داخلية',
      );
    }
    return;
  }

  let addresses: string[];
  try {
    addresses = (await dns.lookup(url.hostname, { all: true })).map(
      (a) => a.address,
    );
  } catch {
    throw new BadRequestException('تعذر تحليل اسم النطاق في الرابط');
  }
  if (addresses.length === 0 || addresses.some(isPrivateIP)) {
    throw new BadRequestException(
      'لا يُسمح بروابط تشير إلى عناوين شبكة داخلية',
    );
  }
}
