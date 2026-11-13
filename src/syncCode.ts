/** Crockford base32: no I, L, O or U, so a code read aloud or typed from a screen survives. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 20; // 100 bits: far too many to guess.

export function generateSyncCode(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 256 is a multiple of 32, so taking each byte mod 32 stays uniform.
  return Array.from(randomBytes(LENGTH), (byte) => ALPHABET[byte % 32]).join("");
}

/** Turns whatever the user typed into the canonical code, or null if it can't be one. */
export function normalizeSyncCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return code.length === LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export function formatSyncCode(code: string): string {
  return code.match(/.{1,5}/g)?.join("-") ?? code;
}
