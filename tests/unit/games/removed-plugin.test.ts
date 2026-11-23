import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET as charactersGet } from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveSheetReadOnly,
} from '@/games/character-system';
import { registerUser } from '@/lib/server-auth';
import { saveCharacterToServer } from '@/lib/server-storage';

import {
  makeCharacter,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from '@tests/support';
import { req } from '@tests/support/http';

/**
 * ─── LANDMARK: REMOVED PLUGIN ──────────────────────────────────────────────
 * Игру удалили из проекта, а её листы остались в data-dir. Сервер не падает
 * и не удаляет данные: лист виден в списке, помечен как «плагин не
 * установлен» (UI — UnknownSheetView) и экспортируется как переносимый JSON.
 *
 * Это контракт «добавление/удаление игры не ломает сервер»: проверяем
 * серверные функции, которые выбирают модуль, а не вёрстку.
 */

describe('игра удалена, листы остались', () => {
  let dataDir: string;
  let uid: string;
  const character = {
    ...makeCharacter('dnd5e', { id: 'ghost-1', userId: 'ghost-user' }),
    name: 'Ghost of a Removed Game',
    systemId: 'removed-game',
    gameSystem: 'Removed Game',
  };

  beforeEach(async () => {
    dataDir = useTempDataDir();
    const registered = await registerUser(
      'ghost-user',
      'ghost-pass-1234',
      'Ghost',
      'amber cobalt lantern',
    );
    expect(registered.success).toBe(true);
    uid = registered.user!.uid;
    await saveCharacterToServer(uid, character as never);
  });

  afterEach(() => {
    removeDir(dataDir);
  });

  it('не угадывает редакцию по legacy-полям, если плагина нет', () => {
    expect(resolveCharacterSystemId(character)).toBeUndefined();
    expect(getCharacterModule(character)).toBeUndefined();
  });

  it('лист открывается в режиме plugin_missing, а не 500', () => {
    expect(resolveSheetReadOnly(character, [])).toEqual({
      readOnly: true,
      reason: 'plugin_missing',
    });
  });

  it('список листов не теряет лист удалённой игры', async () => {
    const res = await charactersGet(
      req('http://localhost/api/characters', 'GET', await sessionHeaders(uid)),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.characters ?? body;
    expect(list.map((item: { id: string }) => item.id)).toContain('ghost-1');
  });

  it('экспорт отдаёт переносимый JSON без служебных полей', async () => {
    const res = await exportGet(
      req(
        'http://localhost/api/export?characterId=ghost-1',
        'GET',
        await sessionHeaders(uid),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Ghost of a Removed Game');
    expect(body.systemId).toBe('removed-game');
    expect(body.userId).toBeUndefined();
    expect(body.migratedFrom).toBeUndefined();
  });

  it('бэкап всех листов тоже не падает', async () => {
    const res = await exportGet(
      req('http://localhost/api/export', 'GET', await sessionHeaders(uid)),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});
