import { describe, expect, it } from 'vitest';
import { parseSignInInput } from './signInInput';

describe('що вставили в поле входу', () => {
  it('шестизначний код, навіть із пробілами', () => {
    expect(parseSignInInput('123456')).toEqual({ kind: 'code', code: '123456' });
    expect(parseSignInInput(' 123 456 ')).toEqual({ kind: 'code', code: '123456' });
  });

  it('посилання з листа', () => {
    const link =
      'https://koejvoyfhkzxayimijbb.supabase.co/auth/v1/verify?token=1e713ef2992159228334f8db961ac9aca8c35a1e977cb90a31ef14d8&type=magiclink&redirect_to=http://localhost:5173/';
    expect(parseSignInInput(link)).toEqual({
      kind: 'link',
      tokenHash: '1e713ef2992159228334f8db961ac9aca8c35a1e977cb90a31ef14d8',
    });
  });

  it('сам токен, скопійований без посилання', () => {
    expect(parseSignInInput('1e713ef2992159228334f8db961ac9aca8c35a1e977cb90a31ef14d8')).toEqual({
      kind: 'link',
      tokenHash: '1e713ef2992159228334f8db961ac9aca8c35a1e977cb90a31ef14d8',
    });
  });

  it('порожнє чи незрозуміле — нічого', () => {
    expect(parseSignInInput('   ')).toBeNull();
    expect(parseSignInInput('доброго вечора')).toBeNull();
  });
});
