import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import {
  CHARACTER_SCHEMA_VERSION,
  normalizeCharacterRecord,
} from '@/lib/character-version';
import { isUid } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import { isRecoveryPhraseHash } from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';

import { readJson, removeDir, userPaths, useTempDataDir } from './helpers';

/**
 * Сквозные сценарии «регистрация → вход → создание персонажа» для КАЖДОЙ
 * игровой системы (D&D 5e и Dark Heresy).
 *
 * Отличие от tests/unit/api-routes.test.ts: там роуты проверяются по одному на
 * минимальных данных, а здесь каждый сценарий проходит путь целиком и с теми
 * payload'ами, которые реально собирают формы создания
 * (src/games/<id>/create-form.tsx): те же поля, те же
 * дефолты, те же системные ветки D&D/DH. Если форма перестанет класть
 * системное поле (spells, fatePoints, statUpgrades…), эти тесты упадут.
 */

type AnyCharacter = Record<string, any>;

const AUTH_URL = 'http://localhost/api/auth';
const REGISTER_URL = 'http://localhost/api/auth/register';
const PHRASE_URL = 'http://localhost/api/auth/phrase';
const CHARACTERS_URL = 'http://localhost/api/characters';
const EXPORT_URL = 'http://localhost/api/export';

const PASSWORD = 'secret-pass-1234';
const RECOVERY_PHRASE = 'amber cobalt lantern';

const jsonRequest = (
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const getRequest = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'GET', headers });

/** Сессионные cookie по uid: запросы к API авторизуются только ими. */
const cookiesByUid = new Map<string, string>();

function cookieFor(uid: string): Record<string, string> {
  const cookie = cookiesByUid.get(uid);
  expect(
    cookie,
    `нет сессии для uid ${uid} — сначала register/login`,
  ).toBeTruthy();
  return { cookie: cookie! };
}

async function login(username: string, password: string, displayName?: string) {
  const res = await loginRoute(
    jsonRequest(AUTH_URL, { username, password, displayName }),
  );
  const body = await res.json();
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (body?.user?.uid && cookie) cookiesByUid.set(body.user.uid, cookie);
  return { status: res.status, body };
}

/** Регистрирует аккаунт через отдельный роут (вход больше не создаёт его). */
async function register(username: string, displayName?: string) {
  const res = await registerRoute(
    jsonRequest(REGISTER_URL, {
      username,
      password: PASSWORD,
      displayName,
      recoveryPhrase: RECOVERY_PHRASE,
    }),
  );
  const body = await res.json();
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (body?.user?.uid && cookie) cookiesByUid.set(body.user.uid, cookie);
  expect(res.status, `регистрация ${username}: ${JSON.stringify(body)}`).toBe(
    200,
  );
  expect(body.success).toBe(true);
  return body.user as {
    uid: string;
    username: string;
    displayName: string;
    hasRecoveryPhrase: boolean;
  };
}

async function createCharacter(userId: string, payload: AnyCharacter) {
  const res = await charactersPost(
    jsonRequest(CHARACTERS_URL, payload, cookieFor(userId)),
  );
  const body = await res.json();
  return { status: res.status, body };
}

async function listCharacters(userId: string) {
  const res = await charactersGet(
    getRequest(CHARACTERS_URL, cookieFor(userId)),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as AnyCharacter[];
}

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

// ─── payload'ы: точная копия того, что собирает onSubmit в формах ───────────

/** D&D 5e, 7 уровень: значения совпадают с DndCharacterForm.onSubmit(). */
function dndPayload(overrides: AnyCharacter = {}): AnyCharacter {
  const level = 7;
  return {
    name: 'Seraphina Vael',
    characterClass: 'Wizard',
    race: 'High Elf',
    background: 'Sage',
    alignment: 'Neutral Good',
    experiencePoints: 23000,
    age: '146',
    eyes: 'Silver',
    skin: 'Pale',
    height: `5'7"`,
    weight: '128 lb',
    hair: 'Black',
    inspiration: '',
    proficiencyBonus: Math.floor((level - 1) / 4) + 2,
    level,
    gameSystem: 'Dungeons & Dragons',
    backstory: 'Archivist of the Emerald Spire.',
    notes: '',
    questLog: [],
    divineBoons: [],
    stats: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 18,
      wisdom: 13,
      charisma: 10,
    },
    savingThrows: [
      { name: 'Strength', proficient: false, value: -1 },
      { name: 'Dexterity', proficient: false, value: 2 },
      { name: 'Constitution', proficient: false, value: 1 },
      { name: 'Intelligence', proficient: true, value: 7 },
      { name: 'Wisdom', proficient: true, value: 4 },
      { name: 'Charisma', proficient: false, value: 0 },
    ],
    skills: [
      {
        name: 'arcana',
        label: 'Arcana (Int)',
        proficient: true,
        expertise: false,
        value: 7,
      },
      {
        name: 'history',
        label: 'History (Int)',
        proficient: true,
        expertise: false,
        value: 7,
      },
      {
        name: 'insight',
        label: 'Insight (Wis)',
        proficient: true,
        expertise: false,
        value: 4,
      },
      {
        name: 'perception',
        label: 'Perception (Wis)',
        proficient: false,
        value: 1,
      },
    ],
    armorClass: 15,
    speed: 30,
    hitPoints: { current: 45, max: 45 },
    temporaryHitPoints: 0,
    hitDice: `${level}d8`,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    otherProficienciesAndLanguages: ['Common', 'Elvish'],
    attacks: [
      {
        id: 'atk-1',
        name: 'Fire Bolt',
        ability: 'intelligence',
        useProficiencyBonus: true,
        damageDice: '2d10',
        damageModifier: '0',
        notes: '',
      },
    ],
    spellcastingAbility: 'intelligence',
    spellAttackBonus: '+7',
    spellSaveDifficulty: 15,
    spellcastingEntries: [
      {
        id: 'primary',
        ability: 'intelligence',
        attackBonus: '+7',
        saveDC: 15,
        notes: '',
      },
    ],
    personalityTraits: ['I use polysyllabic words.'],
    ideals: ['Knowledge.'],
    bonds: ['My life is a series of tomes.'],
    flaws: ['I am easily distracted.'],
    featuresAndTraits: ['Arcane Recovery'],
    equipment: [
      { id: 'eq-1', name: 'Spellbook', status: 'default', notes: '' },
    ],
    attunementItems: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 },
    inventory: [
      { id: 'inv-1', name: 'Potion of Healing', status: 'default', notes: '2' },
    ],
    spells: [
      { id: 'spell-1', name: 'Fireball', level: 3, notes: '8d6 fire' },
      { id: 'spell-2', name: 'Shield', level: 1, notes: '+5 AC' },
    ],
    ...overrides,
  };
}

/** Dark Heresy: значения совпадают с DarkHeresyCharacterForm.onSubmit(). */
function dhPayload(overrides: AnyCharacter = {}): AnyCharacter {
  const agility = 32;
  const agiBonus = Math.floor(agility / 10);
  const noUpgrade: [boolean, boolean, boolean, boolean] = [
    false,
    false,
    false,
    false,
  ];

  return {
    name: 'Lucius Varn',
    characterClass: 'Adept',
    gameSystem: 'Dark Heresy',
    backstory: 'Scribe of the Ordo Calixis.',
    homeWorld: 'Hive World',
    worldVariant: 'Hive World — Manufactorum',
    careerPath: 'Adept',
    rank: 'Adept',
    divination: 'Knowledge is power, guard it well.',
    divinationEffect: '+3 Intelligence.',
    quirk: 'Suspicious of psykers.',
    height: '1.8 m',
    weight: '75 kg',
    age: '34',
    skinColor: 'Pale',
    hairColor: 'Black',
    eyeColor: 'Grey',
    experience: 500,
    totalExpSpent: 250,
    alternatePath: null,
    advancedPath: null,
    notes: '',
    questLog: [],
    stats: {
      weaponSkill: 31,
      ballisticSkill: 35,
      strength: 30,
      toughness: 32,
      agility,
      intelligence: 45,
      perception: 34,
      willpower: 33,
      fellowship: 28,
      influence: 12,
    },
    statUpgrades: {
      weaponSkill: noUpgrade,
      ballisticSkill: noUpgrade,
      strength: noUpgrade,
      toughness: noUpgrade,
      agility: noUpgrade,
      intelligence: noUpgrade,
      perception: noUpgrade,
      willpower: noUpgrade,
      fellowship: noUpgrade,
      influence: noUpgrade,
    },
    statNotes: {},
    wounds: { current: 10, max: 10 },
    fatePoints: { current: 1, max: 1 },
    insanityPoints: { total: 0, notes: '' },
    corruptionPoints: { total: 0, notes: '' },
    wealth: { throneGelt: 120, monthlyIncome: 50 },
    movement: {
      walkHalf: agiBonus,
      walkFull: agiBonus * 2,
      charge: agiBonus * 3,
      run: agiBonus * 6,
    },
    equipment: {
      armor: {
        Head: null,
        Body: null,
        'Left arm': null,
        'Right arm': null,
        'Left leg': null,
        'Right leg': null,
      },
      weapons: { melee: [], ranged: [] },
    },
    inventory: [
      { id: 'inv-dh-1', name: 'Laspistol', status: 'default', notes: '' },
    ],
    skills: [
      {
        id: 'skill-1',
        name: 'Awareness',
        notes: '',
        type: 'basic',
        training: { skilled: true, plus10: false, plus20: false },
      },
    ],
    talents: [{ id: 'talent-1', name: 'Literacy', notes: '', description: '' }],
    customHouseRules: [],
    ...overrides,
  };
}

const SYSTEMS = [
  {
    name: 'Dungeons & Dragons',
    slug: 'dnd',
    build: dndPayload,
    /** Поля, которые есть только у этой системы. */
    ownFields: ['spells', 'savingThrows', 'spellcastingEntries', 'divineBoons'],
    foreignFields: ['fatePoints', 'statUpgrades', 'careerPath'],
  },
  {
    name: 'Dark Heresy',
    slug: 'dh',
    build: dhPayload,
    ownFields: ['fatePoints', 'statUpgrades', 'careerPath', 'wounds'],
    foreignFields: ['spells', 'savingThrows', 'spellcastingEntries'],
  },
] as const;

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

// ───────────────────────────── авторизация ─────────────────────────────────

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
    expect(bad.body).toMatchObject({
      success: false,
      error: 'Incorrect password.',
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

    // Вход длину не проверяет: короткий пароль — просто неверный, аккаунта нет.
    const shortOnLogin = await login('someone', '123');
    expect(shortOnLogin.status).toBe(404);

    // Регистрация с коротким паролем отклоняется политикой (12 символов).
    const shortOnRegister = await registerRoute(
      jsonRequest(REGISTER_URL, {
        username: `short-pass-${Date.now()}`,
        password: '123',
        displayName: 'Short',
        recoveryPhrase: 'amber cobalt',
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
        { phrase: 'amber cobalt lantern' },
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

// ──────── создание персонажа в каждой версии игры (матрица систем) ─────────

describe.each(SYSTEMS)(
  'создание персонажа — $name',
  ({ name, slug, build, ownFields, foreignFields }) => {
    it('POST создаёт лист (201) и не теряет ни одного поля', async () => {
      const user = await register(`gm-${slug}`);
      const payload = build();
      // Сервер нормализует лист до v2 (systemId, разделение DH-полей).
      const expectedPayload = normalizeCharacterRecord(payload).character;

      const { status, body } = await createCharacter(user.uid, payload);

      expect(status).toBe(201);
      expect(body.id).toBeTruthy();
      expect(body.userId).toBe(user.uid);
      expect(body.gameSystem).toBe(name);
      expect(body.name).toBe(payload.name);

      // Файл на диске — ровно то, что отправили, плюс id/userId от сервера.
      const filePath = path.join(
        userPaths(dataDir, user.uid).charactersDir,
        `${body.id}.json`,
      );
      expect(fs.existsSync(filePath)).toBe(true);
      expect(readJson(filePath)).toEqual({
        ...expectedPayload,
        id: body.id,
        userId: user.uid,
        schemaVersion: CHARACTER_SCHEMA_VERSION,
      });
    });

    it('системные поля персонажа сохраняются в своей ветке', async () => {
      const user = await register(`fields-${slug}`);
      const payload = build();
      const { body } = await createCharacter(user.uid, payload);

      const stored = readJson(
        path.join(
          userPaths(dataDir, user.uid).charactersDir,
          `${body.id}.json`,
        ),
      );

      const expected = normalizeCharacterRecord(payload)
        .character as unknown as Record<string, unknown>;
      for (const field of ownFields) {
        expect(stored, `поле ${field} должно быть у ${name}`).toHaveProperty(
          field,
        );
        expect(stored[field]).toEqual(expected[field]);
      }
      for (const field of foreignFields) {
        expect(
          stored,
          `поле ${field} не должно попадать в ${name}`,
        ).not.toHaveProperty(field);
      }

      // Ключевые для листа значения тоже на месте (с учётом миграции v2).
      expect(stored.stats).toEqual(expected.stats);
      expect(stored.name).toBe(payload.name);
    });

    it('лист попадает в список и доступен через /api/export?characterId', async () => {
      const user = await register(`export-${slug}`);
      const payload = build();
      const expectedPayload = normalizeCharacterRecord(payload).character;
      const { body: created } = await createCharacter(user.uid, payload);

      const list = await listCharacters(user.uid);
      expect(list.map((c) => c.id)).toContain(created.id);

      const res = await exportGet(
        getRequest(
          `${EXPORT_URL}?characterId=${encodeURIComponent(created.id)}`,
          cookieFor(user.uid),
        ),
      );
      expect(res.status).toBe(200);
      const exported = await res.json();
      // Экспорт — переносимый: служебный userId в него не попадает.
      expect(exported.userId).toBeUndefined();
      expect(exported).toEqual({
        ...expectedPayload,
        id: created.id,
        schemaVersion: CHARACTER_SCHEMA_VERSION,
      });
    });

    it('лист виден после повторного входа в аккаунт', async () => {
      const user = await register(`relogin-${slug}`);
      const payload = build();
      const { body: created } = await createCharacter(user.uid, payload);

      const again = await login(`relogin-${slug}`, PASSWORD);
      expect(again.body.isNewUser).toBe(false);
      expect(again.body.user.uid).toBe(user.uid);

      const list = await listCharacters(again.body.user.uid);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: created.id,
        name: payload.name,
        gameSystem: name,
      });
    });

    it('сервер выдаёт свой id и игнорирует id от клиента', async () => {
      const user = await register(`client-id-${slug}`);
      const payload = build({ id: 'client-chosen-id' });

      const { status, body } = await createCharacter(user.uid, payload);

      expect(status).toBe(201);
      expect(body.id).not.toBe('client-chosen-id');
      expect(body.id.length).toBeGreaterThan(0);

      // В каталоге ровно один файл — по серверному id, «клиентского» нет.
      const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
      expect(files).toEqual([`${body.id}.json`]);
    });

    it('без сессии создание отклоняется (401) и ничего не пишет', async () => {
      const payload = build();
      const res = await charactersPost(jsonRequest(CHARACTERS_URL, payload));

      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/unauthorized/i);
      expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
    });
  },
);

// ─────────────── две системы в одном аккаунте не смешиваются ───────────────

describe('две игровые системы в одном аккаунте', () => {
  it('D&D и Dark Heresy хранятся раздельно и не смешиваются', async () => {
    const user = await register('multi-system');

    const dnd = await createCharacter(user.uid, dndPayload());
    const dh = await createCharacter(user.uid, dhPayload());
    expect([dnd.status, dh.status]).toEqual([201, 201]);

    const list = await listCharacters(user.uid);
    expect(list).toHaveLength(2);

    const storedDnd = list.find((c) => c.gameSystem === 'Dungeons & Dragons');
    const storedDh = list.find((c) => c.gameSystem === 'Dark Heresy');

    expect(storedDnd?.name).toBe('Seraphina Vael');
    expect(storedDh?.name).toBe('Lucius Varn');
    expect(storedDnd?.spells).toHaveLength(2);
    expect(storedDnd?.fatePoints).toBeUndefined();
    expect(storedDh?.fatePoints).toEqual({ current: 1, max: 1 });
    expect(storedDh?.spells).toBeUndefined();

    // И на диске два независимых файла.
    const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
    expect(files).toHaveLength(2);
    expect(files.sort()).toEqual(
      [`${dnd.body.id}.json`, `${dh.body.id}.json`].sort(),
    );
  });
});
