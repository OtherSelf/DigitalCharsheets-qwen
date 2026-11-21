import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  hashPasswordAsync,
  verifyPasswordAsync,
} from '@/lib/security/password';
import {
  hashRecoveryPhraseAsync,
  recoveryPhraseMatchesAsync,
} from '@/lib/security/phrase';
import { hashSecret, verifySecretHashAsync } from '@/lib/security/scrypt';

/**
 * Async-scrypt для запросного пути. Синхронные функции остаются для
 * startup/офлайн-тулинга; здесь проверяется, что формат хэша общий, старые
 * значения читаются, а параллельные проверки не зависят друг от друга.
 */

const SECRET = 'correct horse battery staple';

describe('async scrypt', () => {
  it('8 параллельных хэшей имеют разные соли и проверяются', async () => {
    const passwords = Array.from(
      { length: 8 },
      (_, index) => `parallel-pass-${index}`,
    );
    const hashes = await Promise.all(passwords.map(hashPasswordAsync));

    expect(new Set(hashes).size).toBe(passwords.length);
    const checks = await Promise.all(
      hashes.map((hash, index) => verifyPasswordAsync(hash, passwords[index])),
    );
    expect(checks.every((check) => check.valid)).toBe(true);
    expect(checks.every((check) => !check.needsRehash)).toBe(true);
  });

  it('читает хэш, записанный синхронной версией', async () => {
    const hash = hashSecret(SECRET);
    expect(await verifySecretHashAsync(hash, SECRET)).toBe(true);
    expect(await verifySecretHashAsync(hash, 'другой секрет')).toBe(false);
  });

  it('старый sha256 принимается и просит перезаписи', async () => {
    const legacy = crypto
      .createHash('sha256')
      .update('legacy-pass-1234')
      .digest('hex');
    expect(
      (await verifyPasswordAsync(legacy, 'legacy-pass-1234')).needsRehash,
    ).toBe(true);
    expect((await verifyPasswordAsync(legacy, 'wrong-pass-1234')).valid).toBe(
      false,
    );
  });

  it('async-фраза нормализуется и не пускает чужой текст', async () => {
    const hash = await hashRecoveryPhraseAsync('Alpha Beta Gamma');
    expect(await recoveryPhraseMatchesAsync(hash, 'alpha beta gamma')).toBe(
      true,
    );
    expect(await recoveryPhraseMatchesAsync(hash, 'alpha beta delta')).toBe(
      false,
    );
  });
});
