/**
 * Регистрация и вход через настоящие route handler'ы: uid из логина,
 * регистронезависимость, recovery-фраза и изоляция персонажей по аккаунту.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { isUid } from '@/lib/ids';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { TERMS_VERSION } from '@/lib/legal/terms';
import { verifyPassword } from '@/lib/security/password';
import { isRecoveryPhraseHash } from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';

import { readJson, removeDir, userPaths, useTempDataDir } from '@tests/support';
import {
  cookieFor,
  createCharacter,
  jsonRequest,
  listCharacters,
  login,
  PASSWORD,
  PHRASE_URL,
  RECOVERY_PHRASE,
  register,
  REGISTER_URL,
} from '@tests/support/character-flows';
import { dndPayload } from '@tests/support/character-payloads';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('авторизация: регистрация и вход', () => {
  it('регистрирует аккаунт, пишет user.json и отдаёт uid из логина', async () => {
    const user = await register('  Auth.User  ', 'Auth Tester');

    expect(isUid(user.uid)).toBe(true);
    expect(user.username).toBe('auth.user');
    expect(user.displayName).toBe('Auth Tester');
    expect(user.hasRecoveryPhrase).toBe(true);

    const paths = userPaths(dataDir, user.uid);
    expect(fs.existsSync(paths.userFile)).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored).toMatchObject({
      username: 'auth.user',
      displayName: 'Auth Tester',
    });
    // Пароль лежит scrypt-хэшем с солью, а не sha256 без соли.
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, PASSWORD).valid).toBe(true);
    expect(verifyPassword(stored.passwordHash, `${PASSWORD}x`).valid).toBe(
      false,
    );
    // Фраза хранится хэшем и не восстанавливается из файла.
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(stored.recoveryPhrase).not.toContain(RECOVERY_PHRASE);
  });

  it('повторный вход узнаёт владельца и не перезаписывает профиль', async () => {
    const first = await register('returning-user', 'Первый');
    const second = await login('returning-user', PASSWORD, 'Второй');

    expect(second.status).toBe(200);
    expect(second.body.isNewUser).toBe(false);
    expect(second.body.user.uid).toBe(first.uid);
    // displayName задаётся один раз — при первом входе.
    expect(second.body.user.displayName).toBe('Первый');

    expect(readJson(userPaths(dataDir, first.uid).userFile)).toMatchObject({
      displayName: 'Первый',
    });
  });

  it('не пускает с неверным паролем и не создаёт второй аккаунт', async () => {
    const user = await register('wrong-pass-user');
    const before = readJson(userPaths(dataDir, user.uid).userFile);

    const bad = await login('wrong-pass-user', 'not-my-password');
    expect(bad.status).toBe(401);
    // Текст нейтральный: он не должен подсказывать, есть ли такой аккаунт.
    expect(bad.body).toMatchObject({
      success: false,
      reason: 'invalid_credentials',
    });

    // Каталог пользователя ровно один, user.json не тронут.
    expect(fs.readdirSync(path.join(dataDir, 'users'))).toHaveLength(1);
    expect(readJson(userPaths(dataDir, user.uid).userFile)).toEqual(before);

    // Пароль всё ещё работает.
    expect((await login('wrong-pass-user', PASSWORD)).body.isNewUser).toBe(
      false,
    );
  });

  it('валидирует пустые поля; длину пароля проверяет регистрация', async () => {
    const noPassword = await login('someone', '');
    expect(noPassword.status).toBe(400);
    expect(noPassword.body.error).toMatch(/required/i);

    const noUsername = await login('', PASSWORD);
    expect(noUsername.status).toBe(400);

    // Вход длину не проверяет: короткий пароль — просто неверный.
    const shortOnLogin = await login('someone', '123');
    expect(shortOnLogin.status).toBe(401);
    expect(shortOnLogin.body.reason).toBe('invalid_credentials');

    // Регистрация с коротким паролем отклоняется политикой (12 символов).
    const shortOnRegister = await registerRoute(
      jsonRequest(REGISTER_URL, {
        username: `short-pass-${Date.now()}`,
        password: '123',
        displayName: 'Short',
        recoveryPhrase: 'amber cobalt',
        consent: true,
        privacyVersion: PRIVACY_VERSION,
        termsVersion: TERMS_VERSION,
      }),
    );
    expect(shortOnRegister.status).toBe(400);
    expect((await shortOnRegister.json()).error).toMatch(/at least 12/i);

    // Неудачные попытки не должны создавать аккаунты.
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('логин регистронезависим, пробелы по краям игнорируются', async () => {
    const first = await register('Mixed.Case.User ');
    expect(first.username).toBe('mixed.case.user');
    // displayName без явного значения — часть логина до @.
    expect(first.displayName).toBe('mixed.case.user');

    const again = await login('mIxEd.CaSe.UsEr', PASSWORD);
    expect(again.status).toBe(200);
    expect(again.body.isNewUser).toBe(false);
    expect(again.body.user.uid).toBe(first.uid);
  });

  it('разные логины получают разные uid', async () => {
    const a = await register('player-one');
    const b = await register('player-two');

    expect(a.uid).not.toBe(b.uid);
    // Оба каталога существуют независимо.
    expect(fs.existsSync(userPaths(dataDir, a.uid).userFile)).toBe(true);
    expect(fs.existsSync(userPaths(dataDir, b.uid).userFile)).toBe(true);
  });

  it('сообщает hasRecoveryPhrase=true после установки фразы', async () => {
    const user = await register('phrase-user');

    const res = await phraseRoute(
      jsonRequest(
        PHRASE_URL,
        {
          phrase: 'amber cobalt lantern silver ember frost',
          currentPassword: PASSWORD,
        },
        cookieFor(user.uid),
      ),
    );
    expect(res.status).toBe(200);

    const again = await login('phrase-user', PASSWORD);
    expect(again.body.user.hasRecoveryPhrase).toBe(true);
    expect(again.body.user.uid).toBe(user.uid);
  });
});

// ──────────────────── изоляция данных между аккаунтами ─────────────────────

describe('авторизация: изоляция персонажей по аккаунту', () => {
  it('персонажи одного пользователя не видны другому', async () => {
    const alice = await register('alice');
    const bob = await register('bob');

    const created = await createCharacter(alice.uid, dndPayload());
    expect(created.status).toBe(201);

    expect(await listCharacters(alice.uid)).toHaveLength(1);
    expect(await listCharacters(bob.uid)).toEqual([]);

    // Файл лежит в каталоге владельца, а не в общем.
    const alicePaths = userPaths(dataDir, alice.uid);
    expect(
      fs.existsSync(
        path.join(alicePaths.charactersDir, `${created.body.id}.json`),
      ),
    ).toBe(true);

    // Список Боба пуст и не создаёт ему каталог: чтение не оставляет следов
    // на диске (каталог появляется с первым листом).
    expect(fs.existsSync(userPaths(dataDir, bob.uid).charactersDir)).toBe(
      false,
    );
  });
});

// ──────────────── DH1: обязательное поле только имя ───────────────────────
