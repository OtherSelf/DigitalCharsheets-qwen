import { expect, test, type Page } from '@playwright/test';

import {
  fetchCharacters,
  openApp,
  prepare,
  registerAccount,
  registerViaUI,
  sheetIdFromUrl,
  signInViaUI,
} from './helpers';

/**
 * Хостовые сценарии «авторизация → создание персонажа»: вход через форму,
 * гостевой черновик и его судьба после входа в аккаунт. Игровые шаги
 * (форма создания конкретной редакции, дефолты листа, оружие, опыт) живут в
 * спеках плагинов: src/games/<id>/tests/visual/*.visual.spec.ts.
 *
 * Каждый тест работает со СВОИМ аккаунтом (регистрируется через API, имя
 * уникально на прогон), поэтому seeded-аккаунт «visual-tests» и его листы не
 * трогаются.
 *
 * Recovery phrase ставится через API сразу после регистрации — иначе после
 * входа всплывает модалка «настройте фразу» и перекрывает форму создания.
 */

test.describe('авторизация через UI', () => {
  test('неверный пароль отклоняется, верный — пускает в дашборд', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'auth-e2e', 'Auth E2E');

    await openApp(page, '/login');
    await page
      .getByLabel('Username or Email', { exact: true })
      .fill(account.username);
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');

    // Ждём именно ответ 401: клик до гидратации не вызывает обработчик,
    // а без ответа тест проверяет тост, которого ещё нет.
    const wrongPassword = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth' &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    expect((await wrongPassword).status()).toBe(401);

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

test.describe('регистрация: вход и переход на главную', () => {
  test('после регистрации без черновика открыта главная, сессия активна', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, language: 'en' });
    const username = `reg-home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await registerViaUI(page, {
      username,
      password: 'register-pass-1234',
      displayName: 'Register Home',
      recoveryPhrase: 'register home phrase',
    });

    await expect(page).toHaveURL((url) => url.pathname === '/', {
      timeout: 30_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Existing Characters' }),
    ).toBeVisible();

    // Вход действительно выполнен: та же cookie-сессия отдаёт профиль, а в
    // шапке нет гостевой кнопки «Login / Register».
    const session = await page.request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    const body = (await session.json()) as { success?: boolean };
    expect(body.success).toBe(true);
    await expect(
      page.getByRole('link', { name: 'Login / Register' }),
    ).toHaveCount(0);
  });
});
