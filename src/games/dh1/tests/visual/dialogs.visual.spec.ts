import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  openDialog,
  prepare,
  registerAccount,
  screenshotPage,
  seededCharacterPayload,
  sheetPath,
  signInViaUI,
} from '../../../../../tests/visual/helpers';
import { PRIVACY_VERSION } from '../../../../lib/legal/privacy';

/**
 * Диалоги листа Dark Heresy 1e — собственные эталоны игры.
 *
 * Здесь же живут две поведенческие проверки, которым нужен именно DH-лист:
 * журнал опыта (правый Sheet из «Прогресса») и сохранение заметок из Sheet.
 * Обе создают собственный аккаунт, чтобы не менять фикстуры воркеров.
 */
// В плагинных проектах имена `desktop-games`/`mobile-games`, поэтому
// проверяем префикс, а не точное имя host-проекта.
const isMobile = () => test.info().project.name.includes('mobile');

test.describe('диалоги DH1 — журнал заданий', { tag: '@plugin:dh1' }, () => {
  test('журнал заданий — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(gameCharacterId('dh')));

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(
      dialog.getByText('The Reliquary of Saint Veren'),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-quest-journal-en.png');
  });

  test(
    'журнал заданий — ru',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'Журнал заданий', false);
      await expect(
        dialog.getByText('The Reliquary of Saint Veren'),
      ).toBeVisible();

      await screenshotPage(page, 'dialog-dh-quest-journal-ru.png');
    },
  );

  /**
   * Раскрытая карточка задания: здесь живут редактируемое название и заметки.
   * Снимок держит оба поля и высоту «Заметок» (три строки по умолчанию).
   */
  test(
    'журнал заданий — раскрытая карточка (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'Quest Journal', false);
      await dialog
        .getByRole('button')
        .filter({ hasText: 'The Reliquary of Saint Veren' })
        .first()
        .click();

      const title = dialog.getByLabel('Name', { exact: true });
      await expect(title).toBeVisible();
      await expect(title).toHaveValue('The Reliquary of Saint Veren');
      const notes = dialog.getByLabel('Notes', { exact: true });
      await expect(notes).toBeVisible();
      // Раскрытие аккордеона анимировано: снимок берём после того, как
      // содержимое перестало менять высоту.
      await page.waitForTimeout(400);

      await screenshotPage(page, 'dialog-dh-quest-journal-expanded-en.png');
    },
  );
});

test.describe('диалоги DH1 — домашние правила', { tag: '@plugin:dh1' }, () => {
  test(
    'домашние правила — en (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'House Rules', false);
      await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

      await screenshotPage(page, 'dialog-dh-house-rules-en.png');
    },
  );

  /**
   * Правила сохраняются без отдельной кнопки: «Добавить правило» и корзина
   * пишут в лист сразу. Тест закрывает и заново открывает диалог — так видно,
   * что это не локальный черновик.
   */
  test(
    'домашние правила: добавление и удаление применяются сразу',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const listResponse = await page.request.get('/api/characters');
      const all = (await listResponse.json()) as Array<{
        id: string;
        customHouseRules?: Array<{ name: string; description: string }>;
      }>;
      const original =
        all.find((entry) => entry.id === id)?.customHouseRules ?? [];

      await openApp(page, sheetPath(id));
      let dialog = await openDialog(page, 'House Rules', false);
      await dialog
        .getByPlaceholder('e.g., Critical Fumbles')
        .fill('Probe rule');
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      await dialog.getByRole('button', { name: 'Add Custom Rule' }).click();
      await saved;
      await expect(dialog.getByText('Probe rule')).toBeVisible();

      await dialog.getByRole('button', { name: 'Close' }).first().click();
      dialog = await openDialog(page, 'House Rules', false);
      await expect(
        dialog.getByText('Probe rule'),
        'правило сохранено без кнопки «Сохранить»',
      ).toBeVisible();

      const removed = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      // Удаляем именно наше правило: в фикстуре может быть своё.
      await dialog
        .getByText('Probe rule')
        .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
        .getByRole('button', { name: 'Delete' })
        .click();
      await removed;
      await expect(dialog.getByText('Probe rule')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Close' }).first().click();

      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { customHouseRules: original },
      });
      expect(restored.status(), 'возврат домашних правил').toBe(200);
    },
  );

  test(
    'домашние правила — en (mobile)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'House Rules', true);
      await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

      await screenshotPage(page, 'dialog-dh-mobile-house-rules-en.png');
    },
  );
});

test.describe('диалоги DH1 — заметки', { tag: '@plugin:dh1' }, () => {
  test(
    'заметки — en (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'Notes', false);
      await expect(dialog.getByText(/Keep the sealed dossier/)).toBeVisible();

      await screenshotPage(page, 'dialog-dh-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Keep the sealed dossier/,
      );
    },
  );

  test(
    'заметки — en (mobile)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'Notes', true);
      await expect(dialog.getByText(/Keep the sealed dossier/)).toBeVisible();

      await screenshotPage(page, 'dialog-dh-mobile-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Keep the sealed dossier/,
      );
    },
  );

  test(
    'заметки — ru (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context, { language: 'ru' });
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const dialog = await openDialog(page, 'Заметки', false);
      await expect(
        dialog.getByRole('heading', { name: 'Заметки персонажа' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Редактировать' }),
      ).toBeVisible();

      await screenshotPage(page, 'dialog-dh-notes-ru.png');
    },
  );
});

/**
 * ─── LANDMARK: EXPERIENCE LOG SHEET ───────────────────────────────────────
 * Журнал опыта — правый Sheet из «Прогресса», как журнал заданий.
 * Отдельный аккаунт и лист: удаление записи пишется на сервер, фикстуры
 * визуальных тестов не трогаем.
 */
test.describe('журнал опыта DH1', { tag: '@plugin:dh1' }, () => {
  test(
    'правый Sheet, строки и удаление записи (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const dhPayload = await seededCharacterPayload('dh');
      const username = `xp-log-${Date.now()}`;
      const password = 'xp-log-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'XP Log',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: {
          ...dhPayload,
          name: 'XP Log',
          experienceLog: [
            {
              id: 'xp-1',
              label: 'Dodge',
              cost: 100,
              createdAt: '2026-01-02T10:00:00.000Z',
            },
            {
              id: 'xp-2',
              label: 'Awareness',
              cost: 150,
              createdAt: '2026-01-03T10:00:00.000Z',
            },
          ],
        },
      });
      expect([200, 201], 'создание листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));

      await page.getByRole('button', { name: 'XP log' }).click();
      const sheet = page.getByRole('dialog');
      await expect(
        sheet.getByRole('heading', { name: 'XP log' }),
      ).toBeVisible();
      await expect(sheet.getByTestId('experience-row')).toHaveCount(2);
      await screenshotPage(page, 'sheet-dh-experience-log-en.png');

      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT',
      );
      await sheet.getByRole('button', { name: 'Delete entry' }).first().click();
      await expect(sheet.getByTestId('experience-row')).toHaveCount(1);
      await saved;

      await openApp(page, sheetPath(id));
      await page.getByRole('button', { name: 'XP log' }).click();
      await expect(
        page.getByRole('dialog').getByTestId('experience-row'),
      ).toHaveCount(1);
    },
  );
});

/**
 * ─── LANDMARK: NARRATIVE SMART SAVE ───────────────────────────────────────
 * Умный режим: непустые заметки открываются в просмотре, «Редактировать»
 * даёт textarea, «Сохранить» пишет в лист. Отдельный аккаунт, чтобы не
 * менять фикстуры визуальных тестов.
 */
test.describe(
  'заметки DH1: сохранение из Sheet',
  { tag: '@plugin:dh1' },
  () => {
    test(
      'Edit → Save → перезагрузка показывает новый текст (en)',
      { tag: '@desktop' },
      async ({ page }) => {
        const dhPayload = await seededCharacterPayload('dh');
        const username = `notes-save-${Date.now()}`;
        const password = 'notes-save-password-1';
        const registered = await page.request.post('/api/auth/register', {
          data: {
            username,
            password,
            displayName: 'Notes Save',
            recoveryPhrase: 'amber cobalt lantern silver ember frost',
            consent: true,
            privacyVersion: PRIVACY_VERSION,
          },
        });
        expect([200, 201], 'регистрация аккаунта').toContain(
          registered.status(),
        );

        const created = await page.request.post('/api/characters', {
          data: {
            ...dhPayload,
            name: 'Notes Save',
            notes: 'Старая заметка',
          },
        });
        expect([200, 201], 'создание листа').toContain(created.status());
        const { id } = (await created.json()) as { id: string };

        await signInViaUI(page, { username, password });
        await openApp(page, sheetPath(id));

        await page
          .getByTestId('app-header')
          .getByRole('button', { name: 'Notes', exact: true })
          .click();
        let sheet = page.getByRole('dialog');
        await expect(sheet.getByText('Старая заметка')).toBeVisible();

        await sheet.getByRole('button', { name: 'Edit' }).click();
        const textarea = sheet.locator('textarea');
        await textarea.fill('Новая заметка из Sheet');
        const saved = page.waitForResponse((response) => {
          if (!response.url().includes(`/api/characters/${id}`)) return false;
          if (response.request().method() !== 'PUT') return false;
          return (response.request().postData() ?? '').includes(
            'Новая заметка из Sheet',
          );
        });
        await sheet.getByRole('button', { name: 'Save' }).click();
        await saved;

        await openApp(page, sheetPath(id));
        await page
          .getByTestId('app-header')
          .getByRole('button', { name: 'Notes', exact: true })
          .click();
        sheet = page.getByRole('dialog');
        await expect(sheet.getByText('Новая заметка из Sheet')).toBeVisible();
        await expect(sheet.getByText('Старая заметка')).toHaveCount(0);
      },
    );
  },
);

/**
 * Продвинутый путь DH1: диалог выбора обязан закрываться Esc и кликом мимо,
 * а выбранный путь — оставаться заблокированным. Раньше Radix намеренно
 * отменял оба способа закрытия, и игрок не мог выйти без выбора.
 */
test.describe('DH1: выбор продвинутого пути', { tag: '@plugin:dh1' }, () => {
  test('Esc и клик мимо закрывают диалог, путь остаётся выбранным', async ({
    page,
  }) => {
    test.skip(isMobile(), 'Esc/backdrop проверяются в desktop-проекте');
    await prepare(page.context(), { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh1-path', 'DH1 Path');
    const created = await page.request.post('/api/characters', {
      data: {
        systemId: 'dh1',
        name: 'DH1 Path',
        careerPath: 'Adept',
        totalExpSpent: 6000,
      },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));

    const progression = page.locator('#progression-section');
    await expect(progression).toBeVisible();
    await progression.getByTestId('edit-button').click();

    const select = progression.getByRole('button', {
      name: 'Select Advanced Path',
      exact: true,
    });
    await expect(select).toBeVisible();

    await select.click();
    const dialog = page.getByTestId('advanced-path-dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await select.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);

    // Выбор фиксируется сразу и больше не предлагает «изменить».
    await select.click();
    await dialog.getByTestId('choice-Comptroller').click();
    await expect(dialog).toHaveCount(0);
    await expect(
      progression.getByText('Comptroller', { exact: true }),
    ).toBeVisible();
    await expect(
      progression.getByRole('button', { name: 'Change Advanced Path' }),
    ).toHaveCount(0);
  });
});
