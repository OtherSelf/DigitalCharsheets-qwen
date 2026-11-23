import { describe, expect, it } from 'vitest';

import {
  MAX_PHRASE_LENGTH,
  MIN_PHRASE_LENGTH,
  MIN_PHRASE_WORDS,
  normalizePhrase,
  phrasePolicyError,
} from '@/lib/security/phrase-policy';

describe('политика recovery-фразы', () => {
  it('нормализует регистр и пробелы', () => {
    expect(normalizePhrase('  Alpha   BETA\nGamma ')).toBe('alpha beta gamma');
  });

  it('требует непустую фразу', () => {
    expect(phrasePolicyError('')).toBe('Recovery phrase is required.');
    expect(phrasePolicyError('   ')).toBe('Recovery phrase is required.');
    expect(phrasePolicyError(undefined)).toBe('Recovery phrase is required.');
  });

  it('отвергает короткие фразы из 5 символов и 5 слов', () => {
    expect(phrasePolicyError('12345')).not.toBeNull();
    expect(phrasePolicyError('one two three four five')).not.toBeNull();
  });

  it('принимает 6 слов даже если они короче 24 символов', () => {
    expect(phrasePolicyError('one two three four five six')).toBeNull();
  });

  it('принимает 24 символа без шести слов', () => {
    expect(phrasePolicyError('a'.repeat(MIN_PHRASE_LENGTH))).toBeNull();
    expect(phrasePolicyError('a'.repeat(MIN_PHRASE_LENGTH - 1))).not.toBeNull();
  });

  it('принимает ровно 6 слов в верхнем регистре и с лишними пробелами', () => {
    expect(phrasePolicyError('  ONE   two THREE four five six  ')).toBeNull();
    expect(phrasePolicyError('ONE two THREE four five')).not.toBeNull();
  });

  it('ограничивает длину сверху', () => {
    expect(phrasePolicyError('a'.repeat(MAX_PHRASE_LENGTH))).toBeNull();
    expect(phrasePolicyError('a'.repeat(MAX_PHRASE_LENGTH + 1))).toContain(
      'at most 256',
    );
  });

  it('константы совпадают с текстом ошибки', () => {
    expect(MIN_PHRASE_WORDS).toBe(6);
    expect(MIN_PHRASE_LENGTH).toBe(24);
    expect(MAX_PHRASE_LENGTH).toBe(256);
  });
});
