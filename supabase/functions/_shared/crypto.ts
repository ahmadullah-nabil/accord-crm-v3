// ─── PKCE + state helpers ─────────────────────────────────────────────────────
//
// Server-side only. The code_verifier never leaves the Edge Function / database;
// only the S256 challenge is sent to the provider.

/** Cryptographically random URL-safe string. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return base64UrlEncode(buf)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** RFC 7636 S256 challenge derived from the verifier. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

/** PKCE verifier: 43–128 chars of the unreserved set. */
export function createCodeVerifier(): string {
  return randomToken(48)
}
