import { expect, test, type Page } from '@playwright/test';

import { prepare, registerViaUI, sheetIdFromUrl, signInViaUI } from './helpers';

/**
 * Функциональные (без эталонных PNG) сценарии «авторизация → создание
 * персонажа» для каждой версии игры: D&D 5e и Dark Heresy.
 *
 * Каждый тест работает со СВОИМ аккаунтом (регистрируется через API, уникальное
 * имя на прогон), поэтому:
 *   - seeded-аккаунт `visual-tests` и его два листа не трогаются;
 *   - скриншот-тесты дашборда/листов продолжают видеть ровно те данные,
 *     которые готовит global-setup.
 *
 * Recovery phrase ставится через API сразу после регистрации — иначе после
 * входа всплывает модалка «настройте фразу» и перекрывает форму создания.
 */

const PASSWORD = 'visual-pass-1234';
const RECOVERY_PHRASE = 'amber cobalt lantern';

interface Account {
  username: string;
  password: string;
  uid: string;
}

async function registerAccount(
  page: Page,
  prefix: string,
  displayName: string,
): Promise<Account> {
  const username = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const auth = await page.request.post('/api/auth/register', {
    data: {
      username,
      password: PASSWORD,
      displayName,
      recoveryPhrase: RECOVERY_PHRASE,
    },
  });
  expect(auth.status(), 'регистрация аккаунта через /api/auth/register').toBe(
    200,
  );
  const body = await auth.json();
  expect(body.success).toBe(true);
  expect(body.user.hasRecoveryPhrase, 'фраза задана при регистрации').toBe(
    true,
  );

  return { username, password: PASSWORD, uid: body.user.uid as string };
}

async function fetchCharacters(page: Page): Promise<any[]> {
  // Владелец определяется сессионной cookie контекста.
  const res = await page.request.get('/api/characters');
  expect(res.status()).toBe(200);
  return (await res.json()) as any[];
}

/** Путь реального пользователя: дашборд → «Create New Character» → игра → редакция. */
async function openCreationForm(
  page: Page,
  system: 'Dungeons & Dragons' | 'Dark Heresy',
  edition: 'dh1' | 'dh2' = 'dh1',
): Promise<void> {
  await page.getByRole('link', { name: 'Create New Character' }).click();
  await page.waitForURL(/\/new$/, { timeout: 15_000 });

  if (system === 'Dungeons & Dragons') {
    await page.getByTestId('create-game-dnd').click();
    await page.getByTestId('create-edition-dnd5e').click();
  } else {
    await page.getByTestId('create-game-darkHeresy').click();
    // Старый флоу создавал DH без edition — это 1-я редакция (D3).
    await page.getByTestId(`create-edition-${edition}`).click();
  }

  await expect(
    page.getByRole('button', { name: 'Create Character' }),
  ).toBeVisible();
}

/** Дожидается редиректа на лист /<id> и возвращает id. */
async function waitForSheetRedirect(page: Page): Promise<string> {
  await page.waitForURL((url) => !url.pathname.startsWith('/new'), {
    timeout: 30_000,
  });
  const id = sheetIdFromUrl(page);
  expect(id, 'после создания открывается лист /<id>').not.toBe('');
  return id;
}

test.describe('авторизация через UI', () => {
  test('неверный пароль отклоняется, верный — пускает в дашборд', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'auth-e2e', 'Auth E2E');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page
      .getByLabel('Username or Email', { exact: true })
      .fill(account.username);
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page.getByText('Invalid login or password.')).toBeVisible();
    expect(new URL(page.url()).pathname, 'остаёмся на /login').toBe('/login');
    expect(
      await page.evaluate(() =>
        localStorage.getItem('digital_charsheets_user'),
      ),
      'сессия не создаётся при неверном пароле',
    ).toBeNull();

    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 30_000,
    });

    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();

    // Сессия в localStorage относится именно к этому аккаунту.
    const session = await page.evaluate(() =>
      localStorage.getItem('digital_charsheets_user'),
    );
    expect(session).toContain(account.uid);
    expect(session).toContain(account.username);
  });
});

test.describe('создание персонажа — D&D 5e', () => {
  test('форма создаёт лист, данные и системные поля сохраняются', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dnd-e2e', 'D&D E2E');
    await signInViaUI(page, account);

    await openCreationForm(page, 'Dungeons & Dragons');

    const name = 'E2E Wizard';
    await page.getByLabel('Character Name', { exact: true }).fill(name);
    await page.getByLabel('Class', { exact: true }).click();
    await page.getByRole('option', { name: 'Wizard', exact: true }).click();
    await page.getByRole('button', { name: 'Create Character' }).click();

    const id = await waitForSheetRedirect(page);

    const characters = await fetchCharacters(page);
    expect(characters, 'ровно один лист у нового аккаунта').toHaveLength(1);

    const created = characters[0];
    expect(created).toMatchObject({
      id,
      name,
      gameSystem: 'Dungeons & Dragons',
      characterClass: 'Wizard',
      // Дефолты формы для 1 уровня.
      level: 1,
      proficiencyBonus: 2,
      armorClass: 10,
      speed: 30,
      hitPoints: { current: 8, max: 8 },
    });
    expect(created.stats).toEqual({
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    expect(created.spells).toEqual([]);
    expect(created.savingThrows).toHaveLength(6);

    // Персонаж виден в дашборде (карточка листа).
    await page.goto('/');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  test('без имени форма не отправляется и лист не создаётся', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dnd-invalid', 'D&D Invalid');
    await signInViaUI(page, account);

    await openCreationForm(page, 'Dungeons & Dragons');
    await page.getByRole('button', { name: 'Create Character' }).click();

    await expect(
      page
        .getByTestId('create-step-form')
        .getByText('Name must be at least 2 characters.'),
    ).toBeVisible();
    expect(new URL(page.url()).pathname, 'остаёмся в форме').toBe('/new');
    expect(await fetchCharacters(page), 'лист не создан').toEqual([]);
  });
});

test.describe('создание персонажа — Dark Heresy', () => {
  test('форма создаёт лист, данные и системные поля сохраняются', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh-e2e', 'DH E2E');
    await signInViaUI(page, account);

    await openCreationForm(page, 'Dark Heresy');

    const name = 'E2E Acolyte';
    await page.getByLabel('Character Name', { exact: true }).fill(name);

    await page.getByLabel('Home World', { exact: true }).click();
    await page.getByRole('option', { name: 'Hive World', exact: true }).click();

    await page.getByLabel('Career Path', { exact: true }).click();
    await page.getByRole('option', { name: 'Adept', exact: true }).click();

    // Список пророчеств — фиксированный справочник; берём первый пункт,
    // чтобы тест не зависел от формулировок перевода.
    await page.getByLabel('Divination', { exact: true }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: 'Create Character' }).click();

    const id = await waitForSheetRedirect(page);

    const characters = await fetchCharacters(page);
    expect(characters, 'ровно один лист у нового аккаунта').toHaveLength(1);

    const created = characters[0];
    expect(created).toMatchObject({
      id,
      name,
      systemId: 'dh1',
      gameSystem: 'Dark Heresy',
      characterClass: 'Adept',
      careerPath: 'Adept',
      homeWorld: 'Hive World',
      // Дефолты формы DH1: минимум диапазона Hive World (1d5+8 → 9–13).
      wounds: { current: 9, max: 9 },
      fatePoints: { current: 1, max: 1 },
      fatigue1st: { current: 0 },
    });
    expect(created.edition, 'поля edition больше нет').toBeUndefined();
    expect(created.fatigue2nd, 'у dh1 нет второй усталости').toBeUndefined();
    expect(created.stats).toMatchObject({
      weaponSkill: 30,
      ballisticSkill: 30,
      strength: 30,
      toughness: 30,
      agility: 30,
      intelligence: 30,
      perception: 30,
      willpower: 30,
      fellowship: 30,
    });
    expect(
      created.stats.influence,
      'influence есть только у dh2',
    ).toBeUndefined();
    expect(created.divination, 'пророчество выбрано').toBeTruthy();
    expect(Object.keys(created.statUpgrades)).toHaveLength(9);

    // Персонаж виден в дашборде (карточка листа).
    await page.goto('/');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});

test.describe('создание персонажа — Dark Heresy 2e', () => {
  test('выборы при создании сохраняются в персонаже и видны на листе', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh2-e2e', 'DH2 E2E');
    await signInViaUI(page, account);

    await openCreationForm(page, 'Dark Heresy', 'dh2');

    const name = 'E2E Assassin';
    await page.getByLabel('Character Name', { exact: true }).fill(name);
    await page.getByLabel('Home World', { exact: true }).click();
    await page.getByRole('option', { name: 'Hive World', exact: true }).click();
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Adeptus Arbites/ }).click();
    await page.getByLabel('Role', { exact: true }).click();
    await page.getByRole('option', { name: /^Assassin/ }).click();

    // Выборы правил (D11): бэкграунд, слот роли, талант роли, «одно из»
    // стартового навыка и замена дубля аптитюды.
    await page
      .getByLabel('Background aptitude: Adeptus Arbites', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Offence', exact: true }).click();
    await page.getByLabel('Role aptitude 2', { exact: true }).click();
    await page
      .getByRole('option', { name: 'Weapon Skill', exact: true })
      .click();
    await page.getByLabel('Role talent: Assassin', { exact: true }).click();
    await page.getByRole('option', { name: 'Jaded', exact: true }).click();
    await page.getByLabel('Starting skills 1', { exact: true }).click();
    await page.getByRole('option', { name: 'Inquiry', exact: true }).click();
    await page
      .getByLabel('Duplicate replacement: Perception', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Strength', exact: true }).click();

    await page.getByRole('button', { name: 'Create Character' }).click();
    const id = await waitForSheetRedirect(page);

    const characters = await fetchCharacters(page);
    expect(characters, 'ровно один лист у нового аккаунта').toHaveLength(1);
    const created = characters[0];
    expect(created).toMatchObject({
      id,
      name,
      systemId: 'dh2',
      homeWorld: 'hive-world',
      background: 'adeptus-arbites',
      role: 'assassin',
      // Минимумы мира: раны 8+1d5 → 9, Судьба 2.
      wounds: { current: 9, max: 9 },
      fatePoints: { current: 2, max: 2 },
      aptitudes: {
        chosen: {
          background: 'offence',
          'role.1': 'weapon-skill',
          'duplicate.perception': 'strength',
        },
      },
      startingChoices: {
        roleTalent: 'jaded',
        skills: ['inquiry'],
        talents: [],
      },
    });
    expect(created.aptitudes.profile).toEqual(
      expect.arrayContaining(['offence', 'weapon-skill', 'strength']),
    );
    expect(
      new Set(created.aptitudes.profile).size,
      'дубль аптитюды заменён, а не продублирован',
    ).toBe(created.aptitudes.profile.length);

    // Лист показывает выборы в info-секции.
    await expect(page.getByText('Role talent', { exact: true })).toBeVisible();
    await expect(page.getByText('Jaded', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Starting skills (chosen)', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Inquiry', { exact: true })).toBeVisible();

    // Аптитюды на листе: источники и выбор замены дубля пересобирают профиль.
    const info = page.locator('#info-section');
    await info.getByTestId('edit-button').click();
    await info
      .getByLabel('Duplicate replacement: Perception', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Toughness', exact: true }).click();
    await info.getByTestId('save-button').click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].aptitudes.chosen)
      .toMatchObject({ 'duplicate.perception': 'toughness' });
    await expect
      .poll(async () => (await fetchCharacters(page))[0].aptitudes.profile)
      .toContain('toughness');
    expect(
      (await fetchCharacters(page))[0].aptitudes.profile,
      'выбранная замена вытеснила прежнюю',
    ).not.toContain('strength');

    // Пси: повышение рейтинга подсказывает цену и пишет покупку в журнал;
    // дисциплины и силы вносятся свободным текстом (D3/D14).
    // На мобильном лист компактный: сначала открываем секцию прогрессии.
    if ((await page.locator('#progression-section').count()) === 0) {
      await page
        .getByRole('button', { name: 'Progression', exact: true })
        .click();
    }
    const progression = page.locator('#progression-section');
    await expect(progression).toBeVisible();
    await progression.getByRole('button', { name: 'Raise psy rating' }).click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].psy)
      .toEqual({ rating: 1, disciplines: [], powers: [] });
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experienceLog[0])
      .toMatchObject({ kind: 'psy-rating', cost: 200, ref: 'Psy rating 1' });
    await expect
      .poll(async () => (await fetchCharacters(page))[0].totalExpSpent)
      .toBe(200);

    await progression.getByTestId('edit-button').click();
    await progression.getByLabel('Psy rating').fill('2');
    await progression.getByLabel('Disciplines').fill('Telepathy, Divination');
    await progression
      .getByLabel('Psychic powers')
      .fill('Mind Link, Astral Tether');
    await progression.getByTestId('save-button').click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].psy)
      .toEqual({
        rating: 2,
        disciplines: ['Telepathy', 'Divination'],
        powers: ['Mind Link', 'Astral Tether'],
      });

    await progression.getByRole('button', { name: 'XP log' }).click();
    const journal = page.getByRole('dialog');
    await expect(
      journal.getByText('Psy rating 1', { exact: true }),
    ).toBeVisible();
    await expect(journal.getByText('200', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Элитное продвижение: пререквизиты и разрешение ГМ видны, покупка
    // пишется в журнал, удаление не откатывает опыт (D15).
    await progression
      .getByRole('combobox', { name: 'Choose an elite advance' })
      .click();
    await page.getByRole('option', { name: /^Psyker/ }).click();
    await expect(
      progression.getByText('Requires GM permission.', { exact: true }),
    ).toBeVisible();
    await expect(
      progression.getByText(/Willpower 40; A Beacon in the Warp/),
    ).toBeVisible();
    await progression
      .getByRole('button', { name: 'Add elite advance' })
      .click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].eliteAdvances)
      .toEqual(['psyker']);
    await expect
      .poll(async () => (await fetchCharacters(page))[0].totalExpSpent)
      .toBe(500);
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experienceLog[1])
      .toMatchObject({ kind: 'elite-advance', cost: 300, ref: 'Psyker' });

    await progression
      .getByRole('button', { name: 'Remove elite advance' })
      .click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].eliteAdvances)
      .toEqual([]);
    // Удаление не откатывает опыт: 200 (пси) + 300 (элитное) остаются.
    expect((await fetchCharacters(page))[0].totalExpSpent).toBe(500);
  });
});

test.describe('черновик гостя dh2 и навигация «назад/вперёд»', () => {
  test('черновик 2e переживает вход, навигацию и создаётся после регистрации', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await page.goto('/new/manual', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await page.getByTestId('create-game-darkHeresy').click();
    await page.getByTestId('create-edition-dh2').click();
    // D13: гостю видно, что черновик сохранится, и вход не блокирует форму.
    await expect(page.getByTestId('guest-draft-banner')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create Character' }),
    ).toBeVisible();

    const name = 'Guest DH2';
    await page.getByLabel('Character Name', { exact: true }).fill(name);
    await page.getByLabel('Home World', { exact: true }).click();
    await page.getByRole('option', { name: 'Hive World', exact: true }).click();
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Adeptus Arbites/ }).click();
    await page.getByLabel('Role', { exact: true }).click();
    await page.getByRole('option', { name: /^Assassin/ }).click();
    await page
      .getByLabel('Background aptitude: Adeptus Arbites', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Offence', exact: true }).click();
    await page.getByLabel('Role aptitude 2', { exact: true }).click();
    await page
      .getByRole('option', { name: 'Weapon Skill', exact: true })
      .click();
    await page.getByLabel('Role talent: Assassin', { exact: true }).click();
    await page.getByRole('option', { name: 'Jaded', exact: true }).click();
    await page.getByLabel('Starting skills 1', { exact: true }).click();
    await page.getByRole('option', { name: 'Inquiry', exact: true }).click();
    await page
      .getByLabel('Duplicate replacement: Perception', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Strength', exact: true }).click();
    await page.getByLabel('Gender', { exact: true }).fill('Female');
    await page.getByLabel('Insanity', { exact: true }).fill('4');
    await page.getByLabel('Corruption', { exact: true }).fill('2');
    await page.getByLabel('Experience', { exact: true }).fill('1200');

    const readDraft = () =>
      page.evaluate(() => {
        const raw = sessionStorage.getItem('pending_character');
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      });

    await page.getByRole('button', { name: 'Create Character' }).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });

    const draft = await readDraft();
    expect(draft, 'черновик гостя лежит в sessionStorage').toMatchObject({
      name,
      systemId: 'dh2',
      gender: 'Female',
      insanityPoints: { total: 4 },
      corruptionPoints: { total: 2 },
      experience: 1200,
      aptitudes: {
        chosen: {
          background: 'offence',
          'role.1': 'weapon-skill',
          'duplicate.perception': 'strength',
        },
      },
      startingChoices: { roleTalent: 'jaded', skills: ['inquiry'] },
    });

    // «Назад» возвращает в форму, «вперёд» — на логин; черновик не теряется,
    // бесконечной загрузки нет.
    await page.goBack();
    await expect(page.getByTestId('create-step-form')).toBeVisible({
      timeout: 15_000,
    });
    expect(await readDraft(), 'черновик пережил «назад»').toMatchObject({
      name,
    });
    await page.goForward();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(await readDraft(), 'черновик пережил «вперёд»').toMatchObject({
      name,
    });

    const username = `guest-dh2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await registerViaUI(page, {
      username,
      password: 'visual-pass-1234',
      displayName: 'Guest DH2',
      recoveryPhrase: 'amber cobalt lantern',
    });

    await page.waitForURL(
      (url) =>
        url.pathname !== '/' &&
        !url.pathname.startsWith('/new') &&
        !url.pathname.startsWith('/login'),
      { timeout: 30_000 },
    );
    const id = sheetIdFromUrl(page);
    const characters = await fetchCharacters(page);
    expect(characters, 'черновик стал единственным листом').toHaveLength(1);
    expect(characters[0]).toMatchObject({
      id,
      name,
      systemId: 'dh2',
      gender: 'Female',
      insanityPoints: { total: 4 },
      corruptionPoints: { total: 2 },
      experience: 1200,
      aptitudes: {
        chosen: {
          background: 'offence',
          'role.1': 'weapon-skill',
          'duplicate.perception': 'strength',
        },
      },
      startingChoices: {
        roleTalent: 'jaded',
        skills: ['inquiry'],
        talents: [],
      },
    });
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Jaded', { exact: true })).toBeVisible();

    // «Назад» после регистрации: не остаёмся на вечном спиннере, «вперёд»
    // возвращает на лист.
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Loading characters...')).toHaveCount(0);
    const backPath = new URL(page.url()).pathname;
    expect(
      backPath === '/' ||
        backPath.startsWith('/login') ||
        backPath.startsWith('/new'),
      `после «назад» ожидался дашборд/логин/форма, а не ${backPath}`,
    ).toBe(true);
    await page.goForward();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

/**
 * ─── LANDMARK: GUEST_DRAFT_ON_LOGIN ─────────────────────────────────────────
 * Гость, который начертил персонажа до входа, не должен «заводить» его в чужом
 * аккаунте молча: после входа в СУЩЕСТВУЮЩИЙ аккаунт черновик остаётся
 * черновиком и висит плашкой на дашборде, а листы аккаунта грузятся сразу
 * (раньше ветка с отложенным персонажем возвращалась до загрузки списка, и
 * казалось, что все персонажи потеряны).
 *
 * Проверяем три исхода:
 *   1. вход в существующий аккаунт: ничего не создано, старый лист на месте,
 *      плашка видна; кнопка создаёт персонажа и открывает его лист;
 *   2. кнопка «удалить черновик» убирает плашку и ничего не пишет на сервер;
 *   3. регистрация нового аккаунта: черновик сразу превращается в персонажа
 *      (единственный случай, когда автозаведение уместно).
 */

const GUEST_PASSWORD = 'visual-pass-1234';
const GUEST_PHRASE = 'amber cobalt lantern';

/** Минимальный D&D-лист, который уже есть у аккаунта до входа гостя. */
function existingDndCharacter(name: string) {
  return {
    name,
    gameSystem: 'Dungeons & Dragons' as const,
    characterClass: 'Fighter',
    race: 'Human',
    background: 'Soldier',
    level: 5,
    stats: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    savingThrows: [],
    skills: [],
    armorClass: 16,
    speed: 30,
    hitPoints: { current: 40, max: 40 },
    hitDice: '5d10',
    deathSaves: { successes: 0, failures: 0 },
    attacks: [],
    spells: [],
    inventory: [],
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    featuresAndTraits: [],
    equipment: [],
    attunementItems: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    backstory: 'Был здесь до входа гостя.',
    notes: '',
  };
}

/** Гость проходит форму создания и останавливается на /login с черновиком. */
async function createGuestDraft(page: Page, name: string): Promise<void> {
  await page.goto('/new/manual', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  await page.getByTestId('create-game-dnd').click();
  await page.getByTestId('create-edition-dnd5e').click();
  await page.getByLabel('Character Name', { exact: true }).fill(name);
  await page.getByLabel('Class', { exact: true }).click();
  await page.getByRole('option', { name: 'Wizard', exact: true }).click();
  await page.getByRole('button', { name: 'Create Character' }).click();

  await page.waitForURL(/\/login/, { timeout: 30_000 });
  expect(
    await page.evaluate(() => sessionStorage.getItem('pending_character')),
    'черновик гостя ждёт в sessionStorage',
  ).toBeTruthy();
}

/** Существующий аккаунт с одним листом; cookie снимаем — дальше гость. */
async function seedExistingAccount(page: Page, name = 'Old Hero') {
  const account = await registerAccount(page, 'guest-draft', 'Guest Draft');
  const created = await page.request.post('/api/characters', {
    data: existingDndCharacter(name),
  });
  expect(created.status(), 'лист до входа гостя').toBe(201);
  const { id } = await created.json();
  await page.context().clearCookies();
  return { account, existingId: id as string };
}

test.describe('черновик гостя и вход в аккаунт', () => {
  test('вход в существующий аккаунт: листы на месте, черновик ждёт кнопки', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const { account, existingId } = await seedExistingAccount(page);

    await createGuestDraft(page, 'Guest Hero');
    await signInViaUI(page, account);

    // Черновик НЕ создан автоматически, лист аккаунта виден сразу.
    expect(
      await fetchCharacters(page),
      'после входа в существующий аккаунт листов по-прежнему один',
    ).toHaveLength(1);
    await expect(page.getByTestId('pending-draft')).toBeVisible();
    await expect(
      page.getByText('Old Hero', { exact: true }).first(),
    ).toBeVisible();

    // Создание по кнопке: лист появляется и открывается.
    await page.getByTestId('pending-draft-create').click();
    await page.waitForURL(
      (url) => url.pathname !== '/' && !url.pathname.startsWith('/new'),
      { timeout: 30_000 },
    );
    const createdId = sheetIdFromUrl(page);
    expect(createdId, 'после кнопки открывается лист /<id>').not.toBe('');

    const characters = await fetchCharacters(page);
    expect(characters).toHaveLength(2);
    expect(characters.map((c) => c.id).sort()).toEqual(
      [existingId, createdId].sort(),
    );
    expect(characters.find((c) => c.id === createdId)).toMatchObject({
      name: 'Guest Hero',
    });

    // Плашки больше нет: черновик стал обычным листом.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('pending-draft')).toHaveCount(0);
    await expect(
      page.getByText('Guest Hero', { exact: true }).first(),
    ).toBeVisible();
  });

  test('черновик можно удалить: плашка исчезает и ничего не пишется', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const { account } = await seedExistingAccount(page);

    await createGuestDraft(page, 'Discarded Hero');
    await signInViaUI(page, account);

    await expect(page.getByTestId('pending-draft')).toBeVisible();
    await page.getByTestId('pending-draft-discard').click();
    await expect(page.getByTestId('pending-draft')).toHaveCount(0);
    expect(
      await page.evaluate(() => sessionStorage.getItem('pending_character')),
      'ключ черновика снят',
    ).toBeNull();
    expect(await fetchCharacters(page)).toHaveLength(1);

    // Перезагрузка не возвращает удалённый черновик.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('pending-draft')).toHaveCount(0);
  });

  test('регистрация: черновик гостя сразу становится персонажем', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    await createGuestDraft(page, 'Fresh Account Hero');

    const username = `guest-reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await registerViaUI(page, {
      username,
      password: GUEST_PASSWORD,
      displayName: 'Guest Reg',
      recoveryPhrase: GUEST_PHRASE,
    });

    const createdId = sheetIdFromUrl(page);
    expect(
      createdId,
      'после регистрации открывается лист черновика, а не дашборд',
    ).not.toBe('');

    const characters = await fetchCharacters(page);
    expect(characters, 'в новом аккаунте ровно один лист').toHaveLength(1);
    expect(characters[0]).toMatchObject({
      id: createdId,
      name: 'Fresh Account Hero',
      gameSystem: 'Dungeons & Dragons',
    });
    expect(
      await page.evaluate(() => sessionStorage.getItem('pending_character')),
      'черновик снят после создания',
    ).toBeNull();
  });
});
