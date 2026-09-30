/**
 * base64 ↔ байти. У Hermes (React Native) немає ні `atob`, ні `Buffer`,
 * а SheetJS віддає книгу Excel саме в base64 — без цього перетворення
 * файл із телефона був би пошкоджений.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) INDEX[ALPHABET[i]] = i;

export function bytesFromBase64(input: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out = new Uint8Array(Math.floor((input.length * 3) / 4));
  let length = 0;
  for (const char of input) {
    const digit = INDEX[char];
    if (digit === undefined) continue; // '=', переноси рядків і пробіли
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[length++] = (value >> bits) & 0xff;
    }
  }
  return out.subarray(0, length);
}

export function base64FromBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : ALPHABET[c & 63];
  }
  return out;
}
