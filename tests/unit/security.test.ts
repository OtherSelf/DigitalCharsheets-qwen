import crypto from 'node:crypto';
import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getRecoveryTokensFile } from '@/lib/data-dir';
import {
  clientIpFromRequest,
  createMemoryRateLimitStore,
  createRateLimiter,
  LOGIN_RATE_LIMIT,
  rateLimitKey,
  RECOVERY_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import { safeStringEqual } from '@/lib/security/timing';
import {
  consumeRecoveryToken,
  hashRecoveryToken,
  issueRecoveryToken,
  RECOVERY_TOKEN_TTL_MS,
  revokeRecoveryTokensForUser,
} from '@/lib/security/tokens';

import { readJson, removeDir, useTempDataDir } from './helpers';

/**
 * Утилиты безопасности, на которых стоят восстановление доступа (SEC-1/SEC-4),
 * лимиты попыток (SEC-7/SEC-9) и сравнение секретов.
 *
 * Токены читают/пишут `<data-dir>/tokens.json`, поэтому каждый тест работает в
 * своём временном каталоге данных (useTempDataDir) — реальный ./data не
 * затрагивается.
 */

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('recovery-токены', () => {
  const uid = () => crypto.randomUUID();

  it('выдаёт токен, обменивает его на uid и гасит при повторной попытке', () => {
    const owner = uid();
    const { token, expiresAt } = issueRecoveryToken(owner);

    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());

    expect(consumeRecoveryToken(token)).toEqual({
      success: true,
      uid: owner,
    });
    // Одноразовость: тот же токен второй раз не работает.
    expect(consumeRecoveryToken(token)).toEqual({
      success: false,
      reason: 'invalid',
    });
  });

  it('хранит на диске только хэш токена, а не сам токен', () => {
    const owner = uid();
    const { token } = issueRecoveryToken(owner);

    const raw = fs.readFileSync(getRecoveryTokensFile(), 'utf8');
    const parsed = readJson(getRecoveryTokensFile()) as {
      version: number;
      tokens: Record<string, { uid: string; createdAt: string }>;
    };

    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.tokens)).toEqual([hashRecoveryToken(token)]);
    expect(parsed.tokens[hashRecoveryToken(token)].uid).toBe(owner);
    // Копия файла не даёт войти: значения токена в нём нет.
    expect(raw).not.toContain(token);
  });

  it('истекает по TTL: обмен просроченного токена отклоняется', () => {
    const owner = uid();
    const issuedAt = Date.UTC(2026, 0, 1, 12, 0, 0);
    const { token } = issueRecoveryToken(owner, {
      ttlMs: 60_000,
      nowMs: issuedAt,
    });

    expect(consumeRecoveryToken(token, { nowMs: issuedAt + 60_001 })).toEqual({
      success: false,
      reason: 'expired',
    });
  });

  it('по умолчанию живёт 15 минут', () => {
    const owner = uid();
    const issuedAt = Date.UTC(2026, 0, 1, 12, 0, 0);
    const { expiresAt } = issueRecoveryToken(owner, { nowMs: issuedAt });

    expect(Date.parse(expiresAt) - issuedAt).toBe(RECOVERY_TOKEN_TTL_MS);
    expect(RECOVERY_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('отклоняет мусорный, пустой и чужой токен', () => {
    const owner = uid();
    const { token } = issueRecoveryToken(owner);

    expect(consumeRecoveryToken('')).toEqual({
      success: false,
      reason: 'invalid',
    });
    expect(consumeRecoveryToken('not-a-token')).toEqual({
      success: false,
      reason: 'invalid',
    });
    expect(consumeRecoveryToken(`${token}x`)).toEqual({
      success: false,
      reason: 'invalid',
    });
    // Мусор не должен погасить настоящий токен.
    expect(consumeRecoveryToken(token)).toEqual({ success: true, uid: owner });
  });

  it('revokeRecoveryTokensForUser гасит все токены одного uid', () => {
    const victim = uid();
    const other = uid();
    const first = issueRecoveryToken(victim);
    const second = issueRecoveryToken(victim);
    const survivor = issueRecoveryToken(other);

    expect(revokeRecoveryTokensForUser(victim)).toBe(2);
    expect(consumeRecoveryToken(first.token).success).toBe(false);
    expect(consumeRecoveryToken(second.token).success).toBe(false);
    expect(consumeRecoveryToken(survivor.token)).toEqual({
      success: true,
      uid: other,
    });
  });

  it('не хранит токен для невалидного uid', () => {
    expect(() => issueRecoveryToken('../../etc/passwd')).toThrow(/valid uid/);
    expect(fs.existsSync(getRecoveryTokensFile())).toBe(false);
  });

  it('битый файл токенов считается пустым, а не падением', () => {
    fs.writeFileSync(getRecoveryTokensFile(), '{ broken', 'utf8');
    expect(consumeRecoveryToken('whatever')).toEqual({
      success: false,
      reason: 'invalid',
    });

    const owner = uid();
    const { token } = issueRecoveryToken(owner);
    expect(consumeRecoveryToken(token)).toEqual({ success: true, uid: owner });
  });
});

describe('rate limit', () => {
  it('после исчерпания окна отвечает отказом с Retry-After', () => {
    const nowMs = 1_000_000;
    const limiter = createRateLimiter({ now: () => nowMs });

    for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT.limit; attempt += 1) {
      const decision = limiter.check('login:1.2.3.4:hero', LOGIN_RATE_LIMIT);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(LOGIN_RATE_LIMIT.limit - attempt);
    }

    const blocked = limiter.check('login:1.2.3.4:hero', LOGIN_RATE_LIMIT);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(
      LOGIN_RATE_LIMIT.windowMs / 1000,
    );
  });

  it('окно скользящее: запросы освобождаются по мере старения', () => {
    let nowMs = 0;
    const rule = { limit: 2, windowMs: 1000 };
    const limiter = createRateLimiter({ now: () => nowMs });

    expect(limiter.check('k', rule).allowed).toBe(true);
    nowMs = 400;
    expect(limiter.check('k', rule).allowed).toBe(true);
    expect(limiter.check('k', rule).allowed).toBe(false);

    // Первая метка вышла из окна — снова есть один слот, вторая ещё держит.
    nowMs = 1001;
    expect(limiter.check('k', rule).allowed).toBe(true);
    expect(limiter.check('k', rule).allowed).toBe(false);

    nowMs = 1402;
    expect(limiter.check('k', rule).allowed).toBe(true);
  });

  it('ключи независимы и reset очищает историю', () => {
    const limiter = createRateLimiter();
    const rule = { limit: 1, windowMs: 60_000 };

    expect(limiter.check('a', rule).allowed).toBe(true);
    expect(limiter.check('a', rule).allowed).toBe(false);
    expect(limiter.check('b', rule).allowed).toBe(true);

    limiter.reset('a');
    expect(limiter.check('a', rule).allowed).toBe(true);

    limiter.reset();
    expect(limiter.check('b', rule).allowed).toBe(true);
  });

  it('recovery-окно строже входного', () => {
    expect(RECOVERY_RATE_LIMIT.limit).toBeLessThan(LOGIN_RATE_LIMIT.limit);
    expect(RECOVERY_RATE_LIMIT.windowMs).toBeGreaterThanOrEqual(
      LOGIN_RATE_LIMIT.windowMs,
    );
  });

  it('умеет работать на подменённом хранилище', () => {
    const store = createMemoryRateLimitStore();
    const writes: string[] = [];
    const spyStore = {
      read: (key: string) => store.read(key),
      write: (key: string, timestamps: number[]) => {
        writes.push(key);
        store.write(key, timestamps);
      },
      clear: () => store.clear(),
    };

    const limiter = createRateLimiter({ store: spyStore });
    expect(limiter.check('k', { limit: 1, windowMs: 1000 }).allowed).toBe(true);
    expect(limiter.check('k', { limit: 1, windowMs: 1000 }).allowed).toBe(
      false,
    );
    expect(writes).toEqual(['k', 'k']);
  });

  it('складывает ключ из действия, IP и нормализованного логина', () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    expect(clientIpFromRequest(request)).toBe('203.0.113.7');
    expect(rateLimitKey('login', request, '  Hero@Example.com ')).toBe(
      'login:203.0.113.7:hero@example.com',
    );

    const realIp = new Request('http://localhost/api/auth', {
      headers: { 'x-real-ip': '198.51.100.9' },
    });
    expect(clientIpFromRequest(realIp)).toBe('198.51.100.9');

    const anonymous = new Request('http://localhost/api/auth');
    expect(clientIpFromRequest(anonymous)).toBe('unknown');
    expect(rateLimitKey('exists', anonymous)).toBe('exists:unknown:');
  });
});

describe('timing-safe сравнение', () => {
  it('совпадение и несовпадение строк', () => {
    expect(safeStringEqual('amber cobalt', 'amber cobalt')).toBe(true);
    expect(safeStringEqual('amber cobalt', 'amber cobalT')).toBe(false);
  });

  it('не оракулит длину: короткая и длинная строка сравнимы', () => {
    expect(safeStringEqual('a', 'a much longer secret value')).toBe(false);
    expect(safeStringEqual('', '')).toBe(true);
    expect(safeStringEqual('', 'x')).toBe(false);
  });
});
