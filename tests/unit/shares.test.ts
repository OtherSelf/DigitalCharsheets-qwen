import fs from 'fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getSharesFile, getUserDir } from '@/lib/data-dir';
import { newUid } from '@/lib/ids';
import { deleteUserAccount, registerUser } from '@/lib/server-auth';
import {
  createUserFolder,
  deleteCharacterFromServer,
  saveCharacterToServer,
} from '@/lib/server-storage';
import {
  getShareForCharacter,
  hashShareToken,
  isShareToken,
  issueShareToken,
  resolveShareToken,
  revokeShareForCharacter,
  revokeSharesForUser,
} from '@/lib/shares';

import {
  makeDndCharacter,
  readJson,
  removeDir,
  useTempDataDir,
} from './helpers';

const CHARACTER_ID = 'char-1';
const NOW = Date.parse('2026-05-12T18:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let dataDir: string;
let uid: string;

function seed(): void {
  uid = newUid();
  createUserFolder(uid, 'share-user', 'Share User');
  saveCharacterToServer(uid, makeDndCharacter({ id: CHARACTER_ID }));
}

function readShares(): {
  shares: Record<string, Record<string, unknown>>;
} {
  return readJson<{ shares: Record<string, Record<string, unknown>> }>(
    getSharesFile(),
  );
}

beforeEach(() => {
  dataDir = useTempDataDir();
  seed();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('issueShareToken', () => {
  it('возвращает токен, хранит только его хэш и одну запись на лист', () => {
    const first = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });

    expect(isShareToken(first.token)).toBe(true);
    expect(first.expiresAt).toBe(new Date(NOW + 30 * DAY).toISOString());

    const file = readShares();
    const hash = hashShareToken(first.token);
    expect(Object.keys(file.shares)).toEqual([hash]);
    expect(JSON.stringify(file)).not.toContain(first.token);
    expect(file.shares[hash]).toMatchObject({
      uid,
      characterId: CHARACTER_ID,
      createdAt: new Date(NOW).toISOString(),
      expiresAt: first.expiresAt,
      includeHistory: false,
    });

    const second = issueShareToken(uid, CHARACTER_ID, {
      expiresInDays: 7,
      nowMs: NOW + 1000,
    });

    const afterRotate = readShares();
    expect(Object.keys(afterRotate.shares)).toEqual([
      hashShareToken(second.token),
    ]);
    expect(resolveShareToken(first.token, { nowMs: NOW + 2000 })).toBeNull();
    expect(
      resolveShareToken(second.token, { nowMs: NOW + 2000 }),
    ).toMatchObject({ uid, characterId: CHARACTER_ID });
  });

  it('поддерживает срок «до отзыва»', () => {
    const { token, expiresAt } = issueShareToken(uid, CHARACTER_ID, {
      expiresInDays: null,
      nowMs: NOW,
    });

    expect(expiresAt).toBeNull();
    expect(
      resolveShareToken(token, { nowMs: NOW + 10 * 365 * DAY }),
    ).not.toBeNull();
  });

  it('истекает по сроку, не удаляя запись при чтении', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, {
      expiresInDays: 7,
      nowMs: NOW,
    });

    expect(resolveShareToken(token, { nowMs: NOW + 7 * DAY })).toBeNull();
    expect(
      getShareForCharacter(uid, CHARACTER_ID, { nowMs: NOW + 7 * DAY }),
    ).toBeNull();
    // Чтение не переписывает файл: запись остаётся до следующей записи/prune.
    expect(Object.keys(readShares().shares)).toHaveLength(1);
  });
});

describe('resolveShareToken', () => {
  it('возвращает владельца и id листа', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });

    expect(resolveShareToken(token, { nowMs: NOW })).toMatchObject({
      uid,
      characterId: CHARACTER_ID,
      includeHistory: false,
    });
  });

  it('не подтверждает мусорный токен', () => {
    expect(resolveShareToken('', { nowMs: NOW })).toBeNull();
    expect(resolveShareToken('a'.repeat(43), { nowMs: NOW })).toBeNull();
  });

  it('перестаёт работать для заблокированного владельца', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });
    const userFile = `${getUserDir(uid)}/user.json`;
    const user = readJson(userFile);
    fs.writeFileSync(
      userFile,
      JSON.stringify({ ...user, isBlocked: true }, null, 2),
    );

    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
  });

  it('перестаёт работать после удаления профиля', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });
    fs.rmSync(getUserDir(uid), { recursive: true, force: true });

    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
  });

  it('переживает битый shares.json как fail closed', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });
    fs.writeFileSync(getSharesFile(), '{ broken', 'utf8');

    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
    expect(getShareForCharacter(uid, CHARACTER_ID)).toBeNull();

    // Следующая выдача восстанавливает файл, а не падает на нём навсегда.
    const recovered = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW + 1 });
    expect(
      resolveShareToken(recovered.token, { nowMs: NOW + 1 }),
    ).toMatchObject({ uid, characterId: CHARACTER_ID });
  });
});

describe('getShareForCharacter', () => {
  it('не отдаёт токен и возвращает только метаданные', () => {
    const { token, createdAt, expiresAt } = issueShareToken(uid, CHARACTER_ID, {
      nowMs: NOW,
    });

    const share = getShareForCharacter(uid, CHARACTER_ID, { nowMs: NOW });
    expect(share).toEqual({
      createdAt,
      expiresAt,
      includeHistory: false,
    });
    expect(JSON.stringify(share)).not.toContain(token);
  });

  it('возвращает null для чужого листа', () => {
    issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });
    expect(getShareForCharacter(newUid(), CHARACTER_ID)).toBeNull();
  });
});

describe('revoke', () => {
  it('отзывает ссылку листа и не падает повторно', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });

    expect(revokeShareForCharacter(uid, CHARACTER_ID)).toBe(1);
    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
    expect(revokeShareForCharacter(uid, CHARACTER_ID)).toBe(0);
  });

  it('отзывает все ссылки пользователя', () => {
    const secondCharacter = 'char-2';
    saveCharacterToServer(uid, makeDndCharacter({ id: secondCharacter }));
    const first = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });
    const second = issueShareToken(uid, secondCharacter, { nowMs: NOW });

    expect(revokeSharesForUser(uid)).toBe(2);
    expect(resolveShareToken(first.token, { nowMs: NOW })).toBeNull();
    expect(resolveShareToken(second.token, { nowMs: NOW })).toBeNull();
  });
});

describe('cleanup hooks', () => {
  it('удаление листа отзывает его ссылку', () => {
    const { token } = issueShareToken(uid, CHARACTER_ID, { nowMs: NOW });

    expect(deleteCharacterFromServer(uid, CHARACTER_ID)).toBe(true);
    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
    expect(Object.keys(readShares().shares)).toHaveLength(0);
  });

  it('удаление аккаунта отзывает его ссылки', () => {
    const registered = registerUser(
      'share-delete-account',
      'test-pass-1234',
      'Share Delete',
      'amber cobalt lantern',
    );
    const ownerUid = registered.user?.uid;
    expect(ownerUid).toBeTruthy();
    saveCharacterToServer(
      ownerUid as string,
      makeDndCharacter({ id: 'char-delete' }),
    );
    const { token } = issueShareToken(ownerUid as string, 'char-delete', {
      nowMs: NOW,
    });

    const deleted = deleteUserAccount(ownerUid as string, 'test-pass-1234');
    expect(deleted.success).toBe(true);
    expect(resolveShareToken(token, { nowMs: NOW })).toBeNull();
  });
});
