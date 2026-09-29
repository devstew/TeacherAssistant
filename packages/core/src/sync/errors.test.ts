import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('пояснює обрив зв\'язку людською мовою', () => {
    expect(friendlyError('Failed to fetch')).toMatch(/зв'язку/);
    expect(friendlyError('Не вдалося надіслати зміни: TypeError: Load failed')).toMatch(/зв'язку/);
  });

  it('підказує, скільки чекати до наступного коду', () => {
    expect(friendlyError('For security purposes, you can only request this after 47 seconds.')).toContain('47');
  });

  it('не приховує незнайому помилку', () => {
    expect(friendlyError('duplicate key value violates unique constraint')).toBe(
      'duplicate key value violates unique constraint',
    );
  });
});
