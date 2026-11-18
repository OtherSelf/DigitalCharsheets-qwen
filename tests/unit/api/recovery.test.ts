/**
 * Recovery-роуты: phrase, recover/verify, recover/update, одноразовый токен
 * и rate limit; «нет аккаунта» и «неверная фраза» неразличимы.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
import { POST as recoverRoute } from '@/app/api/auth/recover/route';
import { POST as recoverUpdateRoute } from '@/app/api/auth/recover/update/route';
import { POST as recoverVerifyRoute } from '@/app/api/auth/recover/verify/route';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { authenticateUser, setRecoveryPhrase } from '@/lib/server-auth';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { json } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
  // Лимитер auth-роутов переживает тест (синглтон), поэтому его история
  // сбрасывается вместе с каталогом данных.
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

/**
 * RECOVERY (SEC-1, SEC-4): восстановление доступа через API.
 *
 * Флоу: `recover/verify` проверяет фразу ЦЕЛИКОМ и отдаёт одноразовый токен
 * (без Set-Cookie), `recover/update` по этому токену меняет пароль и фразу.
 * Логин в теле `update` ничего не доказывает и не принимается.
 */
describe('recovery-роуты (SEC-1, SEC-4)', () => {
  async function createUser(
    username = 'recover-api',
    password = 'pass-one-1234',
  ) {
    const result = authenticateUser(username, password);
    return result.user!.uid;
  }

  async function userWithPhrase(
    username = 'recover-api',
    phrase = 'amber cobalt lantern',
  ) {
    const uid = await createUser(username);
    expect(setRecoveryPhrase(uid, phrase)).toBe(true);
    return uid;
  }

  const storedPhrase = (uid: string) =>
    readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;

  it('/api/auth/phrase без сессии — 401', async () => {
    await userWithPhrase();
    const res = await phraseRoute(json({ phrase: 'Alpha Beta' }));
    expect(res.status).toBe(401);
  });

  it('/api/auth/phrase сохраняет фразу хэшем текущему пользователю', async () => {
    const uid = await createUser();
    const res = await phraseRoute(
      json({ phrase: 'Alpha Beta' }, sessionHeaders(uid)),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    const stored = storedPhrase(uid);
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('alpha');
    expect(recoveryPhraseMatches(stored, 'alpha beta')).toBe(true);
  });

  it('/api/auth/phrase валидирует поля', async () => {
    const uid = await createUser();
    const res = await phraseRoute(json({}, sessionHeaders(uid)));
    expect(res.status).toBe(400);
  });

  it('recover/verify отдаёт токен, но НЕ ставит сессию', async () => {
    await userWithPhrase();

    const res = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(20);
    // Cookie здесь не появляется: доказана фраза, а не владение сессией.
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('recover/verify требует поля — 400', async () => {
    const noPhrase = await recoverVerifyRoute(
      json({ username: 'recover-api' }),
    );
    expect(noPhrase.status).toBe(400);

    const noUsername = await recoverVerifyRoute(
      json({ recoveryPhrase: 'amber cobalt lantern' }),
    );
    expect(noUsername.status).toBe(400);

    const broken = await recoverVerifyRoute(
      new Request('http://localhost/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(broken.status).toBe(400);
  });

  it('recover/verify отклоняет частичную фразу — 400', async () => {
    await userWithPhrase();

    for (const partial of [
      'amber',
      'lantern',
      'amber cobalt',
      'cobalt amber lantern',
    ]) {
      const res = await recoverVerifyRoute(
        json({ username: 'recover-api', recoveryPhrase: partial }),
      );
      expect({ partial, status: res.status }).toEqual({
        partial,
        status: 400,
      });
      expect((await res.json()).reason).toBe('recovery_failed');
    }
  });

  it('recover/verify не падает на "." и "(" — 400, а не 500', async () => {
    await userWithPhrase();

    // Ровно столько попыток, сколько разрешает окно лимита (5 за 15 минут).
    for (const input of ['.', '(', ')', '$&', '*']) {
      const res = await recoverVerifyRoute(
        json({ username: 'recover-api', recoveryPhrase: input }),
      );
      expect({ input, status: res.status }).toEqual({ input, status: 400 });
    }
  });

  it('recover/verify работает с кириллицей', async () => {
    await userWithPhrase('cyrillic-api', 'Синий Кит Фонарь');

    const res = await recoverVerifyRoute(
      json({ username: 'cyrillic-api', recoveryPhrase: 'синий  кит фонарь' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('recover/verify неотличим для «нет аккаунта» и «неверная фраза»', async () => {
    await userWithPhrase('enum-api');

    const noAccount = await recoverVerifyRoute(
      json({ username: 'nobody-here', recoveryPhrase: 'amber cobalt lantern' }),
    );
    const wrongPhrase = await recoverVerifyRoute(
      json({ username: 'enum-api', recoveryPhrase: 'wrong phrase here' }),
    );

    expect(noAccount.status).toBe(400);
    expect(wrongPhrase.status).toBe(400);
    expect(await noAccount.json()).toEqual(await wrongPhrase.json());
  });

  it('recover/update без токена → 401 и пароль не меняется', async () => {
    const uid = await userWithPhrase();
    const before = readJson(userPaths(dataDir, uid).userFile).passwordHash;

    const res = await recoverUpdateRoute(
      json({
        // Логин ничего не доказывает — раньше этого хватало для захвата.
        username: 'recover-api',
        newPassword: 'pwned-pass-1234',
        newRecoveryPhrase: 'x y z',
      }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('invalid_token');
    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      before,
    );
    expect(authenticateUser('recover-api', 'pwned-pass-1234').success).toBe(
      false,
    );
  });

  it('recover/update по токену меняет пароль и фразу', async () => {
    const uid = await userWithPhrase();

    const verified = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );
    const { token } = await verified.json();

    const res = await recoverUpdateRoute(
      json({
        token,
        newPassword: 'fresh-password',
        newRecoveryPhrase: 'new amber cobalt',
      }),
    );
    expect(res.status).toBe(200);
    expect(authenticateUser('recover-api', 'fresh-password').success).toBe(
      true,
    );
    expect(authenticateUser('recover-api', 'pass1').success).toBe(false);
    expect(recoveryPhraseMatches(storedPhrase(uid), 'new amber cobalt')).toBe(
      true,
    );
  });

  it('токен одноразовый: повторный update → 401', async () => {
    await userWithPhrase();

    const verified = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );
    const { token } = await verified.json();

    const first = await recoverUpdateRoute(
      json({ token, newPassword: 'first-pass-1234' }),
    );
    expect(first.status).toBe(200);

    const second = await recoverUpdateRoute(
      json({ token, newPassword: 'second-pass-1234' }),
    );
    expect(second.status).toBe(401);

    // Второй пароль не применился.
    expect(authenticateUser('recover-api', 'first-pass-1234').success).toBe(
      true,
    );
    expect(authenticateUser('recover-api', 'second-pass-1234').success).toBe(
      false,
    );
  });

  it('recover/update валидирует длину пароля и фразы', async () => {
    const uid = await userWithPhrase();
    const { token } = await (
      await recoverVerifyRoute(
        json({
          username: 'recover-api',
          recoveryPhrase: 'amber cobalt lantern',
        }),
      )
    ).json();

    const shortPassword = await recoverUpdateRoute(
      json({ token, newPassword: '123' }),
    );
    expect(shortPassword.status).toBe(400);

    const shortPhrase = await recoverUpdateRoute(
      json({ token, newPassword: 'test-pass-12345', newRecoveryPhrase: 'ab' }),
    );
    expect(shortPhrase.status).toBe(400);

    // Токен не сгорел на неудачных валидациях — им ещё можно воспользоваться.
    const ok = await recoverUpdateRoute(
      json({
        token,
        newPassword: 'test-pass-12345',
        newRecoveryPhrase: 'gamma delta',
      }),
    );
    expect(ok.status).toBe(200);
    expect(authenticateUser('recover-api', 'test-pass-12345').success).toBe(
      true,
    );
    expect(recoveryPhraseMatches(storedPhrase(uid), 'gamma delta')).toBe(true);
  });

  it('legacy /api/auth/recover — только по токену, без слов из листов', async () => {
    const uid = await userWithPhrase('legacy-api');

    const byWords = await recoverRoute(
      json({
        username: 'legacy-api',
        word1: 'ragnar',
        word2: 'testborn',
        word3: 'fighter',
        newPassword: 'fresh-pass-1234',
      }),
    );
    expect(byWords.status).toBe(401);

    const { token } = await (
      await recoverVerifyRoute(
        json({
          username: 'legacy-api',
          recoveryPhrase: 'amber cobalt lantern',
        }),
      )
    ).json();

    const byToken = await recoverRoute(
      json({ token, newPassword: 'fresh-pass-1234' }),
    );
    expect(byToken.status).toBe(200);
    expect(authenticateUser('legacy-api', 'fresh-pass-1234').success).toBe(
      true,
    );
    // Фраза не менялась: в теле её не было.
    expect(
      recoveryPhraseMatches(storedPhrase(uid), 'amber cobalt lantern'),
    ).toBe(true);
  });

  it('после 5 неудачных попыток recover/verify отвечает 429', async () => {
    await userWithPhrase('limited-api');

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const res = await recoverVerifyRoute(
        json({ username: 'limited-api', recoveryPhrase: 'wrong phrase' }),
      );
      statuses.push(res.status);
      if (attempt === 6) {
        expect(res.headers.get('retry-after')).toBeTruthy();
      }
    }

    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
  });
});

/**
 * SEC-10: тело листа — входные данные. Раньше оно писалось как есть (`...body`),
 * поэтому в файл мог попасть любой JSON, а `id` из тела переписывал имя файла.
 * Теперь POST/PUT проверяются схемой редакции, служебные поля отбрасываются,
 * тело ограничено 1 МБ.
 */
