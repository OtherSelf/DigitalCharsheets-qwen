import { expect, test, type Page } from '@playwright/test';

import {
  openApp,
  prepare,
  registerViaUI,
  sheetIdFromUrl,
  sheetPath,
  signInViaUI,
} from './helpers';

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

    // После создания лист один раз открывает «Заметки» с подсказками.
    await expect(
      page.getByRole('heading', { name: 'Creation hints' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

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
    expect(created.notes, 'подсказки создания уходят в заметки').toContain(
      '# Creation hints',
    );

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
    await expect(
      page.getByText('Ignores mundane horrors without gaining Insanity.'),
    ).toBeVisible();
    await expect(
      page.getByText('Use weapons of a chosen type without penalty.'),
    ).toBeVisible();
    await page.getByLabel('Starting skills 1', { exact: true }).click();
    await page.getByRole('option', { name: 'Inquiry', exact: true }).click();
    await page
      .getByLabel('Duplicate replacement: Perception', { exact: true })
      .click();
    await page.getByRole('option', { name: 'Strength', exact: true }).click();

    await page.getByRole('button', { name: 'Create Character' }).click();
    const id = await waitForSheetRedirect(page);

    await expect(
      page.getByRole('heading', { name: 'Creation hints' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

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
    expect(created.notes, 'подсказки создания уходят в заметки').toContain(
      '# Creation hints',
    );

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
    // Замена дубля выбрана при создании — в Info она заперта (D1): селекта
    // нет, значение показано read-only, выбор не переписывается.
    await expect(
      info.getByLabel('Duplicate replacement: Perception', { exact: true }),
    ).toHaveCount(0);
    await expect(
      info.getByText('Duplicate replacement: Perception', { exact: true }),
    ).toBeVisible();
    await expect(info.getByText('Strength', { exact: true })).toBeVisible();
    await info.getByTestId('save-button').click();
    expect((await fetchCharacters(page))[0].aptitudes.chosen).toMatchObject({
      'duplicate.perception': 'strength',
    });

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
    // пишется в журнал, удаление симметрично возвращает опыт (D7/D15).
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
    // Удаление симметрично (D7): элитное, его строка журнала и 300 опыта
    // возвращаются; остаётся только покупка пси-рейтинга за 200.
    await expect
      .poll(async () => (await fetchCharacters(page))[0].totalExpSpent)
      .toBe(200);
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experienceLog.length)
      .toBe(1);

    // Реквизиция: Influence + доступность + качество, без авто-броска.
    const equipment = page.locator('#equipment-section');
    if (!(await equipment.isVisible().catch(() => false))) {
      await page
        .getByRole('button', { name: 'Equipment', exact: true })
        .click();
    }
    await expect(
      equipment.getByText('Requisition', { exact: true }),
    ).toBeVisible();
    await expect(equipment.getByText(/Target test: 30/)).toBeVisible();
    await equipment.getByLabel('Availability', { exact: true }).click();
    await page.getByRole('option', { name: /^Scarce/ }).click();
    await expect(equipment.getByText(/Target test: 20/)).toBeVisible();
    await equipment.getByLabel('Craftsmanship', { exact: true }).click();
    await page.getByRole('option', { name: /^Good/ }).click();
    // Scarce (−10) + Good (−20): 30 − 10 − 20 = 0.
    await expect(equipment.getByText(/Target test: 0/)).toBeVisible();
  });
});

test.describe('создание персонажа — дополнения DH2', () => {
  test('опции Enemies создаются, показывают черты и покупают элитное', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh2-supp', 'DH2 SUPP');
    await signInViaUI(page, account);

    await openCreationForm(page, 'Dark Heresy', 'dh2');

    await page
      .getByLabel('Character Name', { exact: true })
      .fill('E2E Supp Acolyte');
    await page.getByLabel('Home World', { exact: true }).click();
    await page.getByRole('option', { name: 'Agri-World', exact: true }).click();
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Mutant/ }).click();
    await page.getByLabel('Role', { exact: true }).click();
    await page.getByRole('option', { name: /^Fanatic/ }).click();

    // Стартовые черты и Порча — подсказка, на лист вручную (D2/D11).
    await expect(page.getByText(/Starting traits: one of:/)).toBeVisible();
    await expect(page.getByText(/Starting Corruption: 10/)).toBeVisible();

    // Выборы из книги — обычные селекты: пустое значение не подсвечивается
    // (решение владельца), ошибку показывает общая валидация при отправке.
    const backgroundAptitude = page.getByLabel('Background aptitude: Mutant', {
      exact: true,
    });
    await expect(backgroundAptitude).not.toHaveAttribute('aria-invalid');

    await backgroundAptitude.click();
    await page.getByRole('option', { name: 'Fieldcraft', exact: true }).click();

    await page.getByLabel('Role talent: Fanatic', { exact: true }).click();
    await page
      .getByRole('option', { name: 'Deny the Witch', exact: true })
      .click();
    await page.getByLabel('Starting skills 1', { exact: true }).click();
    await page.getByRole('option', { name: 'Athletics', exact: true }).click();
    await page.getByLabel('Starting skills 2', { exact: true }).click();
    await page.getByRole('option', { name: 'Deceive', exact: true }).click();
    await page.getByLabel('Starting skills 2', { exact: true }).click();
    await page.getByRole('option', { name: 'Deceive', exact: true }).click();

    await page.getByRole('button', { name: 'Create Character' }).click();
    const id = await waitForSheetRedirect(page);

    await expect(
      page.getByRole('heading', { name: 'Creation hints' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const created = (await fetchCharacters(page))[0];
    expect(created).toMatchObject({
      id,
      homeWorld: 'agri-world',
      background: 'mutant',
      role: 'fanatic',
      startingChoices: {
        roleTalent: 'deny-the-witch',
        skills: ['athletics', 'deceive'],
      },
      aptitudes: { chosen: { background: 'fieldcraft' } },
    });
    expect(created.aptitudes.profile).toEqual(
      expect.arrayContaining(['strength', 'fieldcraft', 'offence']),
    );
    expect(created.notes).toContain('Starting Corruption: 10');
    expect(created.notes).toContain('Amphibious');

    await expect(page.locator('#info-section')).toBeVisible();
    if ((await page.locator('#progression-section').count()) === 0) {
      await page
        .getByRole('button', { name: 'Progression', exact: true })
        .click();
    }
    const progression = page.locator('#progression-section');
    await progression
      .getByRole('combobox', { name: 'Choose an elite advance' })
      .click();
    await page.getByRole('option', { name: /^Sister of Battle/ }).click();
    await expect(
      progression.getByText(
        /Influence 50; Willpower 40; Adepta Sororitas background/,
      ),
    ).toBeVisible();
    // Конфликт с бэкграундом/полом/характеристиками виден красным (D2), но
    // покупку не блокирует: мастер мог разрешить исключение.
    const eliteWarning = progression.getByTestId('elite-warning');
    await expect(eliteWarning).toBeVisible();
    await expect(eliteWarning).toContainText(
      'The character does not meet the requirements:',
    );
    await expect(eliteWarning).toContainText('Adepta Sororitas');
    await expect(eliteWarning).toContainText('Female');
    await expect(eliteWarning).toContainText('Influence 50');
    await expect(
      progression.getByRole('button', { name: 'Add elite advance' }),
    ).toBeEnabled();
    await progression
      .getByRole('button', { name: 'Add elite advance' })
      .click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].eliteAdvances)
      .toEqual(['sister-of-battle']);
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experienceLog[0])
      .toMatchObject({
        kind: 'elite-advance',
        cost: 750,
        ref: 'Sister of Battle',
      });
  });
});

test.describe('создание персонажа — пол и бэкграунд DH2', () => {
  test('Адептус Сороритас ставит female и запирает пол до смены бэкграунда', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh2-gender', 'DH2 GENDER');
    await signInViaUI(page, account);
    await openCreationForm(page, 'Dark Heresy', 'dh2');

    await page.getByLabel('Home World', { exact: true }).click();
    await page.getByRole('option', { name: 'Agri-World', exact: true }).click();

    const genderSelect = page.getByLabel('Gender', { exact: true });
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Adepta Sororitas/ }).click();

    // Бэкграунд фиксирует пол: значение female, выбор недоступен (D4).
    await expect(genderSelect).toBeDisabled();
    await expect(genderSelect).toHaveText('Female');
    await expect(
      page.getByText("The background fixes the character's gender."),
    ).toBeVisible();

    // Подсказка стартового пакета перечисляет варианты выбора, но не
    // подставляет в текст UI-плейсхолдер «Choose…».
    await expect(page.getByText(/Choose… Medicae/)).toHaveCount(0);
    await expect(page.getByText(/Medicae \/ Parry/).first()).toBeVisible();

    // Смена бэкграунда до сохранения снимает блок, значение остаётся.
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Mutant/ }).click();
    await expect(genderSelect).toBeEnabled();
    await expect(genderSelect).toHaveText('Female');

    // Возвращаем Сороритас и создаём персонажа: в данных — код female.
    await page.getByLabel('Background', { exact: true }).click();
    await page.getByRole('option', { name: /^Adepta Sororitas/ }).click();
    await expect(genderSelect).toBeDisabled();

    await page
      .getByLabel('Character Name', { exact: true })
      .fill('E2E Sororitas');
    await page.getByLabel('Role', { exact: true }).click();
    await page.getByRole('option', { name: /^Chirurgeon/ }).click();
    await page.getByRole('button', { name: 'Create Character' }).click();
    const id = await waitForSheetRedirect(page);

    const created = (await fetchCharacters(page)).find(
      (character) => character.id === id,
    );
    expect(created?.gender).toBe('female');

    // После создания пол только читается: в Info нет селекта пола, есть замок.
    // Сначала закрываем подсказки создания — иначе их оверлей перекрывает лист.
    const hints = page.getByRole('dialog');
    await expect(hints).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hints).toHaveCount(0);

    const info = page.locator('#info-section');
    await expect(info.getByText('Female', { exact: true })).toBeVisible();
    await info.getByTestId('edit-button').first().click();
    await expect(info.getByText('Female', { exact: true })).toBeVisible();
    await expect(info.getByLabel('Gender', { exact: true })).toHaveCount(0);
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
    await page.getByLabel('Gender', { exact: true }).click();
    await page.getByRole('option', { name: 'Female', exact: true }).click();
    await page.getByLabel('Insanity', { exact: true }).fill('4');
    await page.getByLabel('Corruption', { exact: true }).fill('2');
    await page.getByLabel('Experience', { exact: true }).fill('1200');
    await expect(
      page.getByText(
        /At creation you may take up to Influence bonus acquisitions: 3/,
      ),
    ).toBeVisible();

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
      gender: 'female',
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
      gender: 'female',
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

/**
 * ─── LANDMARK: WEAPON ADD REGRESSION ───────────────────────────────────────
 * Кнопку добавления вынесли из аккордеона «Not equipped» (b1b797a), а новый
 * элемент рендерится только в раскрытом контенте: при свёрнутом списке клик
 * выглядел как «ничего не произошло». Проверяем именно ВИДИМОСТЬ поля —
 * проверка через evaluateAll по value прошла бы и для контрола, которого нет
 * в DOM.
 */
test.describe('добавление оружия на листе DH', () => {
  async function openEmptyEquipment(
    page: Page,
    account: { username: string; password: string },
    systemId: 'dh1' | 'dh2',
    name: string,
  ) {
    const created = await page.request.post('/api/characters', {
      data: { systemId, name },
    });
    expect([200, 201], 'создание пустого листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));

    const equipment = page.locator('#equipment-section');
    if (!(await equipment.isVisible().catch(() => false))) {
      // На мобильном секция скрыта за компактной навигацией.
      await page
        .getByRole('button', { name: 'Equipment', exact: true })
        .click();
    }
    await expect(equipment).toBeVisible();
    return equipment;
  }

  async function expectSavedWeapon(
    page: Page,
    slot: 'melee' | 'ranged',
    name: string,
  ) {
    await expect
      .poll(async () => {
        const [character] = await fetchCharacters(page);
        return (character?.equipment?.weapons?.[slot] ?? []).some(
          (weapon: { name: string; equipped: boolean }) =>
            weapon.name === name && weapon.equipped === false,
        );
      })
      .toBe(true);
  }

  test('DH1: новое оружие сразу видно после добавления', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh1-weapons', 'DH1 Weapons');
    const equipment = await openEmptyEquipment(
      page,
      account,
      'dh1',
      'DH1 Weapons',
    );

    const melee = equipment.getByTestId('melee-weapons');
    await melee.getByTestId('edit-button').click();
    await melee.getByTestId('add-melee-weapon').click();

    // Аккордеон раскрылся, поле нового оружия доступно и видимо.
    await expect(melee.getByTestId('unequipped-melee-trigger')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const newMelee = melee.locator('input').first();
    await expect(newMelee).toBeVisible();
    await expect(newMelee).toHaveValue('New melee weapon');

    await melee.getByTestId('save-button').click();
    await expectSavedWeapon(page, 'melee', 'New melee weapon');

    const ranged = equipment.getByTestId('ranged-weapons');
    await ranged.getByTestId('edit-button').click();
    await ranged.getByTestId('add-ranged-weapon').click();

    await expect(
      ranged.getByTestId('unequipped-ranged-trigger'),
    ).toHaveAttribute('aria-expanded', 'true');
    const newRanged = ranged.locator('input').first();
    await expect(newRanged).toBeVisible();
    await expect(newRanged).toHaveValue('New ranged weapon');

    await ranged.getByTestId('save-button').click();
    await expectSavedWeapon(page, 'ranged', 'New ranged weapon');
  });

  test('DH2: новое оружие ближнего боя сразу видно', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh2-weapons', 'DH2 Weapons');
    const equipment = await openEmptyEquipment(
      page,
      account,
      'dh2',
      'DH2 Weapons',
    );

    const melee = equipment.getByTestId('melee-weapons');
    await melee.getByTestId('edit-button').click();
    await melee.getByTestId('add-melee-weapon').click();

    await expect(melee.getByTestId('unequipped-melee-trigger')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const newMelee = melee.locator('input').first();
    await expect(newMelee).toBeVisible();
    await expect(newMelee).toHaveValue('New melee weapon');

    await melee.getByTestId('save-button').click();
    await expectSavedWeapon(page, 'melee', 'New melee weapon');
  });
});

/**
 * ─── LANDMARK: XP AWARD ───────────────────────────────────────────────────
 * Кнопка «Добавить ОП» рядом со «Spend EXP»: положительное число — награда,
 * отрицательное — штраф. Начисление пишется в журнал опыта и увеличивает
 * `experience`; удаление записи из журнала отменяет начисление ровно на её
 * стоимость.
 */
test.describe('начисление опыта на листе DH', () => {
  async function openProgression(page: Page) {
    const progression = page.locator('#progression-section');
    if (!(await progression.isVisible().catch(() => false))) {
      await page
        .getByRole('button', { name: 'Progression', exact: true })
        .click();
    }
    await expect(progression).toBeVisible();
    return progression;
  }

  async function awardExp(
    page: Page,
    amount: string,
    note: string,
    labels: { button: string; amount: string; what: string; confirm: string },
  ) {
    await page
      .getByRole('button', { name: labels.button, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Пресет по умолчанию — 100, поле свободное.
    await expect(dialog.getByLabel(labels.amount)).toHaveValue('100');
    await dialog.getByLabel(labels.amount).fill(amount);
    await dialog.getByLabel(labels.what).fill(note);
    await dialog.getByRole('button', { name: labels.confirm }).click();
    await expect(dialog).toHaveCount(0);
  }

  async function expectExperience(page: Page, expected: number) {
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experience)
      .toBe(expected);
  }

  test('DH1: награда и штраф пишутся в журнал и отменяются', async ({
    page,
  }) => {
    await prepare(page.context(), { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh1-award', 'DH1 Award');
    const created = await page.request.post('/api/characters', {
      data: { systemId: 'dh1', name: 'DH1 Award' },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };
    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));
    const progression = await openProgression(page);

    const labels = {
      button: 'Add EXP',
      amount: 'XP amount',
      what: 'What was it for',
      confirm: 'Add',
    };
    const before = (await fetchCharacters(page))[0].experience as number;

    await awardExp(page, '100', 'Session 1', labels);
    await expectExperience(page, before + 100);
    await expect
      .poll(async () =>
        (await fetchCharacters(page))[0].experienceLog.find(
          (entry: { label: string }) => entry.label === 'Session 1',
        ),
      )
      .toMatchObject({ cost: 100, kind: 'award' });

    // Запись видна в журнале опыта.
    await progression
      .getByRole('button', { name: 'XP log', exact: true })
      .click();
    const journal = page.getByRole('dialog');
    await expect(journal.getByText('Session 1')).toBeVisible();
    await expect(journal.getByText('100', { exact: true })).toBeVisible();

    // Удаление записи снимает начисленное.
    await journal.getByRole('button', { name: 'Delete entry' }).click();
    await expectExperience(page, before);
    await page.keyboard.press('Escape');

    // Отрицательное число — штраф; удаление возвращает опыт.
    await awardExp(page, '-50', 'Penalty', labels);
    await expectExperience(page, before - 50);
    await progression
      .getByRole('button', { name: 'XP log', exact: true })
      .click();
    const penaltyJournal = page.getByRole('dialog');
    await expect(penaltyJournal.getByText('Penalty')).toBeVisible();
    await penaltyJournal.getByRole('button', { name: 'Delete entry' }).click();
    await expectExperience(page, before);
  });

  test('DH2: награда пишется в журнал и отменяется', async ({ page }) => {
    await prepare(page.context(), { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh2-award', 'DH2 Award');
    const created = await page.request.post('/api/characters', {
      data: { systemId: 'dh2', name: 'DH2 Award' },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };
    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));
    const progression = await openProgression(page);

    const labels = {
      button: 'Add XP',
      amount: 'XP amount',
      what: 'What was it for',
      confirm: 'Add',
    };

    await awardExp(page, '100', 'Session 1', labels);
    await expect
      .poll(async () =>
        (await fetchCharacters(page))[0].experienceLog.find(
          (entry: { ref: string }) => entry.ref === 'Session 1',
        ),
      )
      .toMatchObject({ cost: 100, kind: 'award' });

    await progression
      .getByRole('button', { name: 'XP log', exact: true })
      .click();
    const journal = page.getByRole('dialog');
    await expect(journal.getByText('Session 1')).toBeVisible();
    await expect(journal.getByText('XP award')).toBeVisible();
    await journal.getByRole('button', { name: 'Delete entry' }).click();
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experience)
      .toBe(1000);
  });
});
