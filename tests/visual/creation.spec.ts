import { expect, test, type Page } from '@playwright/test';
import { prepare, signInViaUI } from './helpers';

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

  const auth = await page.request.post('/api/auth', {
    data: { username, password: PASSWORD, displayName },
  });
  expect(auth.status(), 'регистрация аккаунта через /api/auth').toBe(200);
  const body = await auth.json();
  expect(body.success).toBe(true);

  const phrase = await page.request.post('/api/auth/phrase', {
    data: { phrase: RECOVERY_PHRASE },
  });
  expect(phrase.status(), 'установка recovery phrase').toBe(200);

  return { username, password: PASSWORD, uid: body.user.uid as string };
}

async function fetchCharacters(page: Page): Promise<any[]> {
  // Владелец определяется сессионной cookie контекста.
  const res = await page.request.get('/api/characters');
  expect(res.status()).toBe(200);
  return (await res.json()) as any[];
}

/** Путь реального пользователя: дашборд → «Create New Character» → выбор системы. */
async function openCreationForm(
  page: Page,
  system: 'Dungeons & Dragons' | 'Dark Heresy',
): Promise<void> {
  await page.getByRole('link', { name: 'Create New Character' }).click();
  await page.waitForURL(/\/new\/manual/, { timeout: 15_000 });

  // На странице выбора системы это единственный combobox.
  await page.getByRole('combobox').first().click();
  await page
    .getByRole('option', {
      name:
        system === 'Dungeons & Dragons'
          ? 'Dungeons & Dragons'
          : 'Warhammer 40k: Dark Heresy',
      exact: true,
    })
    .click();

  await expect(page.getByRole('button', { name: 'Create Character' })).toBeVisible();
}

/** Дожидается редиректа на лист /<id> и возвращает id. */
async function waitForSheetRedirect(page: Page): Promise<string> {
  await page.waitForURL((url) => !url.pathname.startsWith('/new'), { timeout: 30_000 });
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
    await page.getByPlaceholder('e.g., your@email.com or username').fill(account.username);
    await page.locator('input[type="password"]').fill('definitely-wrong');
    await page.getByRole('button', { name: /sign up \/ log in/i }).click();

    await expect(page.getByText('Incorrect password.')).toBeVisible();
    expect(new URL(page.url()).pathname, 'остаёмся на /login').toBe('/login');
    expect(
      await page.evaluate(() => localStorage.getItem('digital_charsheets_user')),
      'сессия не создаётся при неверном пароле',
    ).toBeNull();

    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole('button', { name: /sign up \/ log in/i }).click();
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
    expect(new URL(page.url()).pathname, 'остаёмся в форме').toBe('/new/manual');
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
      gameSystem: 'Dark Heresy',
      characterClass: 'Adept',
      careerPath: 'Adept',
      homeWorld: 'Hive World',
      // Дефолты формы DH.
      wounds: { current: 10, max: 10 },
      fatePoints: { current: 1, max: 1 },
    });
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
      influence: 30,
    });
    expect(created.divination, 'пророчество выбрано').toBeTruthy();
    expect(Object.keys(created.statUpgrades)).toHaveLength(10);

    // Персонаж виден в дашборде (карточка листа).
    await page.goto('/');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});
