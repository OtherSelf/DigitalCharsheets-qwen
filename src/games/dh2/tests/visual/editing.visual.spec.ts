import { expect, test, type Page } from '@playwright/test';

import {
  openApp,
  sheetPath,
  signInViaUI,
  startEditing,
} from '../../../../../tests/visual/helpers';

/**
 * Режим редактирования Dark Heresy 2-й редакции: пустое creation-поле
 * заполняется и запирается, свободный опыт считается и сохраняется.
 * Эталонов у сценариев нет (D11) — проверки ассертами на временном аккаунте,
 * чтобы не раздувать матрицу PNG.
 */

/**
 * ─── LANDMARK: CREATION EDIT POLICY ────────────────────────────────────────
 * Двухуровневая политика (D4): описательные поля редактируются всегда,
 * creation-поля — только пока пустые. Заполненный мир/роль/пророчество
 * read-only с замком «выбрано при создании». Производные не пересчитываются
 * (D15), поэтому тест проверяет только сам факт записи поля.
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
            recoveryPhrase: 'amber cobalt lantern',
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
 * должно быть красным (D6). В dh1 «Текущий» и «Потрачено» вне Edit — текст,
 * править их можно только из input в режиме правки (D11).
 *
 * Эталоны здесь не снимаем (D11): состояние проверяется ассертами на
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
        recoveryPhrase: 'amber cobalt lantern',
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
