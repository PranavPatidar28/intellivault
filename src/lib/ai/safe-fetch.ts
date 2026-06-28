/**
 * SSRF-safe remote fetch helpers.
 *
 * User/AI-controlled URLs (e.g. image `src` pulled from note content) must
 * never be fetched naively from the server: an attacker could point them at
 * internal services, cloud metadata endpoints (169.254.169.254), or loopback.
 * These helpers validate the URL/host, block private address ranges, disable
 * redirects, and bound time + bytes.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface SafeFetchResult {
  buffer: Buffer;
  mimeType: string;
}

export class SafeFetchError extends Error {}

/**
 * Returns true if the given IP literal is in a private, loopback, link-local,
 * unique-local, CGNAT, or otherwise non-public range that must not be reached
 * from the server.
 */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  // Not a valid IP literal: treat as blocked (caller resolves real IPs).
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]!; // strip zone id
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]!);
  const firstHextet = addr.split(":")[0] || "";
  const head = parseInt(firstHextet || "0", 16);
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/**
 * Validate that `url` is an http(s) URL whose host resolves only to public
 * addresses. Throws SafeFetchError otherwise. Returns the parsed URL.
 */
async function assertPublicHttpUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SafeFetchError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SafeFetchError(`Unsupported protocol: ${parsed.protocol}`);
  }

  const host = parsed.hostname;

  // If the host is an IP literal, validate it directly.
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError("Blocked address");
    return parsed;
  }

  // Otherwise resolve and ensure every resolved address is public.
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new SafeFetchError("DNS resolution failed");
  }
  if (records.length === 0) throw new SafeFetchError("DNS resolution failed");
  for (const { address } of records) {
    if (isBlockedIp(address)) throw new SafeFetchError("Blocked address");
  }
  return parsed;
}

/**
 * Fetch a remote resource with SSRF protections: http(s) only, no redirects,
 * public hosts only, content-type and byte-size enforced, hard timeout.
 *
 * Also accepts `data:` URLs, which are decoded locally without any network I/O.
 */
export async function safeFetchImage(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Inline data URLs: decode directly, no network access.
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new SafeFetchError("Invalid data URL");
    const mimeType = match[1] || "application/octet-stream";
    if (!mimeType.startsWith("image/")) {
      throw new SafeFetchError("data URL is not an image");
    }
    const isBase64 = !!match[2];
    const data = match[3] || "";
    const buffer = isBase64
      ? Buffer.from(data, "base64")
      : Buffer.from(decodeURIComponent(data), "utf-8");
    if (buffer.byteLength > maxBytes) throw new SafeFetchError("Image too large");
    return { buffer, mimeType };
  }

  const parsed = await assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed.toString(), {
      redirect: "manual", // never follow redirects to a potentially-internal target
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });

    // Manual redirect: a 3xx (or opaqueredirect) means the server tried to
    // bounce us elsewhere — refuse rather than chase it.
    if (response.status >= 300 && response.status < 400) {
      throw new SafeFetchError("Refusing to follow redirect");
    }
    if (!response.ok) {
      throw new SafeFetchError(`Upstream returned ${response.status}`);
    }

    const mimeType = (response.headers.get("content-type") || "").split(";")[0]!.trim();
    if (!mimeType.startsWith("image/")) {
      throw new SafeFetchError("Response is not an image");
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new SafeFetchError("Image too large");
    }

    // Stream with a hard byte cap so a missing/lying Content-Length can't OOM us.
    const reader = response.body?.getReader();
    if (!reader) throw new SafeFetchError("Empty response body");
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new SafeFetchError("Image too large");
        }
        chunks.push(value);
      }
    }

    return { buffer: Buffer.concat(chunks), mimeType };
  } finally {
    clearTimeout(timer);
  }
}
