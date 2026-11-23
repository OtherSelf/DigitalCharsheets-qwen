import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decryptTotpSecret,
  encryptTotpSecret,
  findBackupCodeIndex,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  totpCodeForStep,
  totpOtpauthUri,
  validateTotpKeyConfig,
  verifyTotpCode,
} from '@/lib/security/totp';

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP (RFC 6238)', () => {
  it('совпадает с векторами RFC 6238 (SHA-1, 30 с)', () => {
    // 8-значные векторы; наши 6 цифр — младшие шесть.
    expect(totpCodeForStep(RFC_SECRET, 1)).toBe('287082'); // 59 s
    expect(totpCodeForStep(RFC_SECRET, 37037036)).toBe('081804'); // 1111111109
    expect(totpCodeForStep(RFC_SECRET, 41152263)).toBe('005924'); // 1234567890
  });

  it('принимает окно ±1 и отвергает чужие шаги', () => {
    const now = 59_000;
    const step = Math.floor(now / 30_000);
    const code = totpCodeForStep(RFC_SECRET, step);
    expect(verifyTotpCode(RFC_SECRET, code, now)).toBe(step);
    expect(
      verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step - 1), now),
    ).toBe(step - 1);
    expect(
      verifyTotpCode(RFC_SECRET, totpCodeForStep(RFC_SECRET, step + 2), now),
    ).toBeNull();
    expect(verifyTotpCode(RFC_SECRET, 'abcdef', now)).toBeNull();
  });

  it('генерирует секрет для authenticator', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBe(32);
  });

  it('строит otpauth-URI без QR-зависимости', () => {
    const uri = totpOtpauthUri('ABC234', 'hero@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('secret=ABC234');
    expect(uri).toContain('period=30');
  });
});

describe('TOTP: секрет и backup-коды', () => {
  const key = crypto.randomBytes(32);
  const uid = '9d1f0d4e-2c0f-4b5e-9f8a-4a1b2c3d4e5f';

  it('шифрует секрет и не расшифровывает чужим uid/ключом', () => {
    const secret = generateTotpSecret();
    const envelope = encryptTotpSecret(secret, key, uid);
    expect(envelope.startsWith('v1.')).toBe(true);
    expect(envelope).not.toContain(secret);
    expect(decryptTotpSecret(envelope, key, uid)).toBe(secret);
    expect(decryptTotpSecret(envelope, key, 'other-uid')).toBeNull();
    expect(decryptTotpSecret(envelope, crypto.randomBytes(32), uid)).toBeNull();
    expect(decryptTotpSecret('broken', key, uid)).toBeNull();
  });

  it('backup-код проверяется по ключевому хэшу и одноразовый по смыслу', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    const hashes = codes.map((code) => hashBackupCode(code, key, uid));
    expect(hashes[0]).not.toContain(codes[0]);
    expect(findBackupCodeIndex(codes[3], hashes, key, uid)).toBe(3);
    expect(findBackupCodeIndex('WRONGCODE1', hashes, key, uid)).toBe(-1);
    expect(findBackupCodeIndex(codes[0], hashes, key, 'other')).toBe(-1);
  });

  it('DCS_TOTP_KEY требует ровно 32 байта base64', () => {
    const previous = process.env.DCS_TOTP_KEY;
    delete process.env.DCS_TOTP_KEY;
    expect(() => validateTotpKeyConfig()).not.toThrow();

    process.env.DCS_TOTP_KEY = crypto.randomBytes(32).toString('base64');
    expect(() => validateTotpKeyConfig()).not.toThrow();

    process.env.DCS_TOTP_KEY = 'short';
    expect(() => validateTotpKeyConfig()).toThrow(/32 bytes/);

    if (previous === undefined) delete process.env.DCS_TOTP_KEY;
    else process.env.DCS_TOTP_KEY = previous;
  });
});
