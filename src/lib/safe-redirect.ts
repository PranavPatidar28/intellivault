/**
 * Sanitize a post-login redirect target.
 *
 * Only same-origin relative paths are allowed. This prevents an open-redirect:
 * an attacker cannot craft /signin?callbackUrl=https://evil.com (or a
 * protocol-relative //evil.com) to bounce a freshly-authenticated user to a
 * phishing site. Anything that isn't a single-leading-slash path falls back to
 * the default.
 */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw) return fallback;

  // Must be a relative path beginning with a single "/".
  // Reject "//host" (protocol-relative) and "/\host" (browser-normalized).
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  // Reject anything that smuggles a scheme or control characters.
  if (/[:\\]/.test(raw.split(/[?#]/)[0]!)) {
    return fallback;
  }

  return raw;
}
