import { describe, expect, it } from 'vitest';
import { base64FromBytes, bytesFromBase64 } from './base64';

declare const Buffer: { from(input: string | Uint8Array, encoding?: string): { toString(encoding: string): string } };

const bytes = (...xs: number[]) => Uint8Array.from(xs);

describe('base64 без atob', () => {
  it('збігається з еталоном Node для всіх довжин залишку', () => {
    for (const size of [0, 1, 2, 3, 4, 5, 255, 1000]) {
      const data = Uint8Array.from({ length: size }, (_, i) => (i * 37) % 256);
      const expected = Buffer.from(data).toString('base64');
      expect(base64FromBytes(data)).toBe(expected);
      expect([...bytesFromBase64(expected)]).toEqual([...data]);
    }
  });

  it('не спотикається на переносах рядків усередині рядка', () => {
    const data = bytes(80, 75, 3, 4, 20, 0);
    const encoded = base64FromBytes(data);
    const wrapped = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`;
    expect([...bytesFromBase64(wrapped)]).toEqual([...data]);
  });

  it('зберігає сигнатуру ZIP, з якої починається файл Excel', () => {
    expect([...bytesFromBase64('UEsDBBQA')].slice(0, 4)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
