import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
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
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

/**
 * POST /api/auth/phrase: фраза — второй ключ к аккаунту, поэтому её смена из
 * живой сессии требует текущий пароль, а новая фраза проходит политику.
 */
describe('recovery-фраза из сессии (SEC-21, SEC-14)', () => {
  async function createUser(
    username = 'phrase-api',
    password = 'pass-one-1234',
  ) {
    const result = await authenticateUser(username, password);
    return result.user!.uid;
  }

  async function userWithPhrase(
    username = 'phrase-api',
    phrase = 'amber cobalt lantern silver ember frost',
  ) {
    const uid = await createUser(username);
    expect(await setRecoveryPhrase(uid, phrase)).toBe(true);
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
      json(
        {
          phrase: 'alpha beta gamma delta epsilon zeta',
          currentPassword: 'pass-one-1234',
        },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    const stored = storedPhrase(uid);
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('alpha');
    expect(
      recoveryPhraseMatches(stored, 'alpha beta gamma delta epsilon zeta'),
    ).toBe(true);
  });

  it('/api/auth/phrase валидирует поля', async () => {
    const uid = await createUser();
    const res = await phraseRoute(json({}, await sessionHeaders(uid)));
    expect(res.status).toBe(400);
  });

  it('/api/auth/phrase отвергает фразу короче политики', async () => {
    const uid = await createUser();
    const res = await phraseRoute(
      json(
        { phrase: '12345', currentPassword: 'pass-one-1234' },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_phrase');
    expect(storedPhrase(uid)).toBeUndefined();
  });

  it('/api/auth/phrase принимает 6 слов', async () => {
    const uid = await createUser();
    const res = await phraseRoute(
      json(
        {
          phrase: 'one two three four five six',
          currentPassword: 'pass-one-1234',
        },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(200);
    expect(
      recoveryPhraseMatches(storedPhrase(uid), 'one two three four five six'),
    ).toBe(true);
  });

  it('/api/auth/phrase без текущего пароля — 403 и фраза не меняется', async () => {
    const uid = await userWithPhrase();
    const before = storedPhrase(uid);

    const res = await phraseRoute(
      json(
        { phrase: 'new phrase here silver ember frost' },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('invalid_password');
    expect(storedPhrase(uid)).toBe(before);
  });

  it('/api/auth/phrase с неверным паролем — 403 и фраза не меняется', async () => {
    const uid = await userWithPhrase();
    const before = storedPhrase(uid);

    const res = await phraseRoute(
      json(
        {
          phrase: 'new phrase here silver ember frost',
          currentPassword: 'not-my-pass-1234',
        },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('invalid_password');
    expect(storedPhrase(uid)).toBe(before);
  });
});
