// Alphanumeric only — DB connection strings, ORM clients, and CLI tools
// handle these without URL-encoding or quoting tricks. Skips visually
// ambiguous characters (0/O, 1/l/I) so users typing it don't misread.
const ALPHA_LOWER = "abcdefghijkmnopqrstuvwxyz";
const ALPHA_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const PASSWORD_CHARSET = ALPHA_LOWER + ALPHA_UPPER + DIGITS;
const FIRST_CHAR_CHARSET = ALPHA_LOWER + ALPHA_UPPER;

function randomIndex(modulo: number, fallback = false): number {
  if (!fallback && typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % modulo;
  }
  return Math.floor(Math.random() * modulo);
}

/**
 * Generates a DB-safe random password.
 *
 * - Alphanumeric only (no symbols, so no URL-encoding or shell-quoting).
 * - First character is a letter (some DB clients reject leading digits).
 * - Default length 24 → ~139 bits of entropy with the 56-char alphabet.
 */
export function generateStrongPassword(length = 24): string {
  const useFallback = typeof window === "undefined" || !window.crypto?.getRandomValues;
  const out = new Array<string>(length);

  out[0] = FIRST_CHAR_CHARSET[randomIndex(FIRST_CHAR_CHARSET.length, useFallback)];
  for (let i = 1; i < length; i++) {
    out[i] = PASSWORD_CHARSET[randomIndex(PASSWORD_CHARSET.length, useFallback)];
  }

  return out.join("");
}
