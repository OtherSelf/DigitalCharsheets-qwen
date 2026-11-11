import { expect, test, type Page } from '@playwright/test';

import { prepare, registerViaUI, signInViaUI } from './helpers';

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
): Promise<void> {
  await page.getByRole('link', { name: 'Create New Character' }).click();
  await page.waitForURL(/\/new$/, { timeout: 15_000 });

  if (system === 'Dungeons & Dragons') {
    await page.getByTestId('create-game-dnd').click();
    await page.getByTestId('create-edition-dnd5e').click();
  } else {
    await page.getByTestId('create-game-darkHeresy').click();
    // Старый флоу создавал DH без edition — это 1-я редакция (📌 D3).
    await page.getByTestId('create-edition-dh1').click();
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
  const id = new URL(page.url()).pathname.replace(/^\//, '');
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

    await expect(page.getByText('Incorrect password.')).toBeVisible();
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
      page.getByText('Name must be at least 2 characters.'),
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
      // Дефолты формы DH1.
      wounds: { current: 10, max: 10 },
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
    const createdId = new URL(page.url()).pathname.replace(/^\//, '');
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

    const createdId = new URL(page.url()).pathname.replace(/^\//, '');
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
