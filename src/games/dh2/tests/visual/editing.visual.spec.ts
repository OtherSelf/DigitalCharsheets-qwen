import { expect, test, type Page } from '@playwright/test';

import {
  openApp,
  openMobileSection,
  sheetPath,
  signInViaUI,
  startEditing,
} from '../../../../../tests/visual/helpers';
import { PRIVACY_VERSION } from '../../../../lib/legal/privacy';
import { TERMS_VERSION } from '../../../../lib/legal/terms';

/**
 * Режим редактирования Dark Heresy 2-й редакции: пустое creation-поле
 * заполняется и запирается, свободный опыт считается и сохраняется.
 * Эталонов у сценариев нет — проверки ассертами на временном аккаунте,
 * чтобы не раздувать матрицу PNG.
 */

/**
 * ─── LANDMARK: CREATION EDIT POLICY ────────────────────────────────────────
 * Двухуровневая политика: описательные поля редактируются всегда,
 * creation-поля — только пока пустые. Заполненный мир/роль/пророчество
 * read-only с замком «выбрано при создании». Производные не пересчитываются
 *, поэтому тест проверяет только сам факт записи поля.
 */
test.describe(
  'политика редактирования после создания',
  { tag: '@plugin:dh2' },
  () => {
    test(
      'DH2: пустое creation-поле заполняется и блокируется (en)',
      { tag: '@desktop' },
      async ({ page }) => {
        // Свежий лист dh2 без creation-полей: фикстуры визуальных тестов
        // не трогаем, иначе поедут эталоны листа.
        const username = `policy-dh2-${Date.now()}`;
        const password = 'policy-password-1';
        const registered = await page.request.post('/api/auth/register', {
          data: {
            username,
            password,
            displayName: 'Policy DH2',
            recoveryPhrase: 'amber cobalt lantern silver ember frost',
            consent: true,
            privacyVersion: PRIVACY_VERSION,
            termsVersion: TERMS_VERSION,
          },
        });
        expect([200, 201], 'регистрация аккаунта').toContain(
          registered.status(),
        );

        const created = await page.request.post('/api/characters', {
          data: { systemId: 'dh2', name: 'Policy DH2' },
        });
        expect([200, 201], 'создание пустого dh2-листа').toContain(
          created.status(),
        );
        const { id } = (await created.json()) as { id: string };

        await signInViaUI(page, { username, password });
        await openApp(page, sheetPath(id));

        const info = page.locator('#info-section:visible').first();
        await startEditing(info);

        // Пустое поле открывает выбор; заполняем мир.
        const homeWorld = info.getByRole('combobox', { name: 'Home World' });
        await expect(homeWorld).toBeVisible();
        const saved = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/characters/${id}`) &&
            response.request().method() === 'PUT',
        );
        await homeWorld.click();
        await page.getByRole('option', { name: 'Feral World' }).click();
        await saved;
        await expect(
          info.getByText('Feral World', { exact: true }),
        ).toBeVisible();

        // Gender — описательное поле: input доступен в правке.
        await expect(info.getByLabel('Gender')).toBeVisible();

        await info.getByTestId('save-button').first().click();
        await openApp(page, sheetPath(id));

        const reloaded = page.locator('#info-section:visible').first();
        await startEditing(reloaded);
        // Мир задан: выбор исчез, появился замок «выбрано при создании».
        await expect(
          reloaded.getByRole('combobox', { name: 'Home World' }),
        ).toHaveCount(0);
        await expect(reloaded.getByTestId('creation-lock')).toHaveCount(1);
        await expect(
          reloaded.getByText('Feral World', { exact: true }),
        ).toBeVisible();
      },
    );
  },
);

/**
 * ─── LANDMARK: EXPERIENCE BLOCK ────────────────────────────────────────────
 * «Свободный опыт» — вычисляемое число: при перерасходе оно отрицательное и
 * должно быть красным. В dh1 «Текущий» и «Потрачено» вне Edit — текст,
 * править их можно только из input в режиме правки.
 *
 * Эталоны здесь не снимаем: состояние проверяется ассертами на
 * временном аккаунте, чтобы не раздувать матрицу PNG.
 */
test.describe('блок опыта', { tag: '@plugin:dh2' }, () => {
  async function createAccountSheet(
    page: Page,
    systemId: 'dh1' | 'dh2',
    values: { experience: number; totalExpSpent: number },
  ): Promise<string> {
    const username = `xp-${systemId}-${Date.now()}`;
    const password = 'xp-password-1';
    const registered = await page.request.post('/api/auth/register', {
      data: {
        username,
        password,
        displayName: `XP ${systemId}`,
        recoveryPhrase: 'amber cobalt lantern silver ember frost',
        consent: true,
        privacyVersion: PRIVACY_VERSION,
        termsVersion: TERMS_VERSION,
      },
    });
    expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

    const created = await page.request.post('/api/characters', {
      data: { systemId, name: `XP ${systemId}`, ...values },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await signInViaUI(page, { username, password });
    return id;
  }

  test(
    'DH2: отрицательный свободный опыт красный и сохраняется после Edit (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const id = await createAccountSheet(page, 'dh2', {
        experience: 100,
        totalExpSpent: 250,
      });
      await openApp(page, sheetPath(id));

      const progression = page.locator('#progression-section:visible').first();
      const available = progression.getByTestId('available-exp');
      await expect(available).toHaveText('-150');
      await expect(available).toHaveClass(/text-destructive/);

      await startEditing(progression);
      const spent = progression.locator('input[type="number"]').nth(1);
      await expect(spent).toHaveValue('250');

      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT',
      );
      await spent.fill('40');
      await spent.blur();
      await saved;
      await expect(available).toHaveText('60');
      await expect(available).toHaveClass(/text-primary/);

      await progression.getByTestId('save-button').first().click();
      await expect(progression.getByTestId('total-exp-spent-value')).toHaveText(
        '40',
      );
      await page.reload();
      await expect(
        page
          .locator('#progression-section:visible')
          .first()
          .getByTestId('total-exp-spent-value'),
      ).toHaveText('40');
    },
  );
});

/**
 * ─── LANDMARK: SIMPLE POINTS STEPPER ──────────────────────────────────────
 * DH2 повторяет поведение DH1: Порча меняется плюсом/минусом на 1, без
 * модалки, сразу сохраняется и не уходит ниже нуля.
 */
test.describe('Безумие и Порча: плюс и минус', { tag: '@plugin:dh2' }, () => {
  test(
    'DH2: Порча меняется на 1 и сохраняется',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `points2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const password = 'points-password-2';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Points DH2',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());
      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh2', name: 'Points DH2' },
      });
      expect([200, 201], 'создание dh2-листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));

      const increase = page.locator(
        '[data-testid="corruption-points-increase"]:visible',
      );
      const box = increase.locator(
        'xpath=ancestor::div[contains(@class,"flex h-full flex-col")][1]',
      );
      await expect(increase).toHaveCount(1);
      await expect(box.locator('input')).toHaveCount(0);

      await increase.click();
      await expect
        .poll(() =>
          page
            .locator('[data-testid="corruption-points-increase"]:visible')
            .locator('xpath=..')
            .locator('span')
            .innerText(),
        )
        .toBe('1');

      await expect
        .poll(async () => {
          const response = await page.request.get('/api/characters');
          const list = (await response.json()) as Array<{
            id: string;
            corruptionPoints?: { total: number };
          }>;
          return list.find((character) => character.id === id)?.corruptionPoints
            ?.total;
        })
        .toBe(1);
    },
  );
});

/**
 * ─── LANDMARK: HIT LOCATIONS IN INFO ──────────────────────────────────────
 * DH2 повторяет DH1: на телефоне локации попаданий видны во вкладке
 * «Информация», а не спрятаны.
 */
test.describe('локации попаданий на мобильном', { tag: '@plugin:dh2' }, () => {
  test(
    'DH2: мобильный показывает локации во вкладке «Информация»',
    { tag: '@mobile' },
    async ({ page }) => {
      const username = `hits-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const password = 'hits-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Hits QA',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());
      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh2', name: 'Hits QA' },
      });
      expect([200, 201], 'создание dh2-листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      await page.setViewportSize({ width: 390, height: 844 });
      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));

      await openMobileSection(page, 'Info', 'info-section');
      const info = page.locator('#info-section:visible').first();
      await expect(info.getByText('(1-10)')).toBeVisible();
      await expect(info.getByText('(86-00)')).toBeVisible();
    },
  );
});

/**
 * ─── LANDMARK: CUSTOM RESOURCES IN ITEMS ──────────────────────────────────
 * DH2: те же счётчики внутри вкладки «Предметы».
 */
test.describe(
  'пользовательские ресурсы внутри «Предметов»',
  { tag: '@plugin:dh2' },
  () => {
    test(
      'DH2: ресурсы рендерятся в инвентаре',
      { tag: '@desktop' },
      async ({ page }) => {
        const username = `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const password = 'res-password-1';
        const registered = await page.request.post('/api/auth/register', {
          data: {
            username,
            password,
            displayName: 'Resources QA',
            recoveryPhrase: 'amber cobalt lantern silver ember frost',
            consent: true,
            privacyVersion: PRIVACY_VERSION,
            termsVersion: TERMS_VERSION,
          },
        });
        expect([200, 201], 'регистрация аккаунта').toContain(
          registered.status(),
        );
        const created = await page.request.post('/api/characters', {
          data: { systemId: 'dh2', name: 'Resources QA' },
        });
        expect([200, 201], 'создание dh2-листа').toContain(created.status());
        const { id } = (await created.json()) as { id: string };

        await signInViaUI(page, { username, password });
        await openApp(page, sheetPath(id));

        const inventory = page.locator('#inventory-section:visible').first();
        await expect(
          inventory.getByText('Custom Resources', { exact: true }),
        ).toBeVisible();
      },
    );
  },
);
