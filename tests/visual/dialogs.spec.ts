import { expect, test } from '@playwright/test';

import { dhCharacter } from './fixtures';
import {
  expectNoHorizontalOverflow,
  getState,
  openApp,
  openDialog,
  prepare,
  screenshotPage,
  sheetPath,
  signInViaUI,
} from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Модальные окна — отдельный класс регрессий: они позиционируются поверх
 * страницы и легко «уезжают» на мобильном.
 *
 * Покрыты все диалоги обеих систем: журнал заданий, домашние правила,
 * заметки и уникальный для D&D диалог добавления божественного дара.
 */

test.describe('диалоги — геометрия окна', () => {
  test('окно открывается по центру и не вылетает из левого верхнего угла', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    // Домашние правила — настоящий Dialog на обоих проектах (журнал заданий
    // на desktop открывается правым Sheet, его геометрия другая).
    const dialog = await openDialog(page, 'House Rules', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'House Rules' }),
    ).toBeVisible();
    // Даём отработать открытию (duration-200) и снимаем геометрию.
    await page.waitForTimeout(300);
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'у окна есть геометрия').not.toBeNull();
    expect(viewport).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    expect(Math.abs(centerX - viewport!.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(centerY - viewport!.height / 2)).toBeLessThanOrEqual(2);
    // Окно целиком во вьюпорте: без вылета за верх/низ и по ширине.
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });
});

test.describe('диалоги — журнал заданий', () => {
  test('D&D — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-quest-journal-en.png');
  });

  test('Dark Heresy — en', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));

    const dialog = await openDialog(page, 'Quest Journal', isMobile());
    await expect(
      dialog.getByRole('heading', { name: 'Quest Journal' }),
    ).toBeVisible();
    await expect(
      dialog.getByText('The Reliquary of Saint Veren'),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-quest-journal-en.png');
  });

  test('D&D — ru', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'Журнал заданий', false);
    await expect(dialog.getByText('The Missing Ninth Page')).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-quest-journal-ru.png');
  });

  test('Dark Heresy — ru', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, sheetPath(getState().dhId));

    const dialog = await openDialog(page, 'Журнал заданий', false);
    await expect(
      dialog.getByText('The Reliquary of Saint Veren'),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-quest-journal-ru.png');
  });
});

test.describe('диалоги — домашние правила', () => {
  test('D&D — en (desktop)', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'House Rules', false);
    await expect(
      dialog.getByRole('heading', { name: 'House Rules' }),
    ).toBeVisible();
    await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-house-rules-en.png');
  });

  test(
    'Dark Heresy — en (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

      const dialog = await openDialog(page, 'House Rules', false);
      await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

      await screenshotPage(page, 'dialog-dh-house-rules-en.png');
    },
  );

  test('D&D — en (mobile)', { tag: '@mobile' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'House Rules', true);
    await dialog.getByRole('tab', { name: 'Custom Rules' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-mobile-house-rules-en.png');
  });

  test(
    'Dark Heresy — en (mobile)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

      const dialog = await openDialog(page, 'House Rules', true);
      await expect(dialog.getByText('Critical hits on 96–00')).toBeVisible();

      await screenshotPage(page, 'dialog-dh-mobile-house-rules-en.png');
    },
  );

  test('D&D — ru', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'Домашние правила', false);
    await dialog.getByRole('tab', { name: 'Собственные правила' }).click();
    await expect(
      dialog.getByText('Feat at level 1', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-house-rules-ru.png');
  });
});

test.describe('диалоги — заметки', () => {
  test('D&D — en (desktop)', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'Notes', false);
    await expect(
      dialog.getByRole('heading', { name: 'Character Notes' }),
    ).toBeVisible();
    // Непустые заметки открываются в просмотре markdown (D3): textarea
    // появляется только после «Редактировать».
    await expect(
      dialog.getByText(/Owes a favour to the Lantern Guild/),
    ).toBeVisible();
    await expect(dialog.locator('textarea')).toHaveCount(0);

    await screenshotPage(page, 'dialog-dnd-notes-en.png');

    await dialog.getByRole('button', { name: 'Edit' }).click();
    await expect(dialog.locator('textarea')).toHaveValue(
      /Owes a favour to the Lantern Guild/,
    );
  });

  test(
    'Dark Heresy — en (desktop)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

      const dialog = await openDialog(page, 'Notes', false);
      await expect(dialog.getByText(/Keep the sealed dossier/)).toBeVisible();

      await screenshotPage(page, 'dialog-dh-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Keep the sealed dossier/,
      );
    },
  );

  test('D&D — en (mobile)', { tag: '@mobile' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const dialog = await openDialog(page, 'Notes', true);
    await expect(
      dialog.getByText(/Owes a favour to the Lantern Guild/),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await screenshotPage(page, 'dialog-dnd-mobile-notes-en.png');

    await dialog.getByRole('button', { name: 'Edit' }).click();
    await expect(dialog.locator('textarea')).toHaveValue(
      /Owes a favour to the Lantern Guild/,
    );
  });

  test(
    'Dark Heresy — en (mobile)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

      const dialog = await openDialog(page, 'Notes', true);
      await expect(dialog.getByText(/Keep the sealed dossier/)).toBeVisible();

      await screenshotPage(page, 'dialog-dh-mobile-notes-en.png');

      await dialog.getByRole('button', { name: 'Edit' }).click();
      await expect(dialog.locator('textarea')).toHaveValue(
        /Keep the sealed dossier/,
      );
    },
  );

  test('Dark Heresy — ru', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, sheetPath(getState().dhId));

    const dialog = await openDialog(page, 'Заметки', false);
    await expect(
      dialog.getByRole('heading', { name: 'Заметки персонажа' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Редактировать' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dh-notes-ru.png');
  });
});

test.describe('диалоги — божественные дары (только D&D)', () => {
  test('desktop — en', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Add Divine Boon' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-divine-boons-en.png');
  });

  test('mobile — en', { tag: '@mobile' }, async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Add Divine Boon' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-mobile-divine-boons-en.png');
  });

  test('desktop — ru', { tag: '@desktop' }, async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, sheetPath(getState().dndId));

    await page.getByTestId('add-boon-button').click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Добавить божественный дар' }),
    ).toBeVisible();

    await screenshotPage(page, 'dialog-dnd-divine-boons-ru.png');
  });
});

/**
 * ─── LANDMARK: EXPERIENCE LOG SHEET ───────────────────────────────────────
 * Журнал опыта — правый Sheet из «Прогресса» (D8), как журнал заданий.
 * Отдельный аккаунт и лист: удаление записи пишется на сервер, фикстуры
 * визуальных тестов не трогаем.
 */
test.describe('журнал опыта', () => {
  test(
    'DH1: правый Sheet, строки и удаление записи (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `xp-log-${Date.now()}`;
      const password = 'xp-log-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'XP Log',
          recoveryPhrase: 'amber cobalt lantern',
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: {
          ...dhCharacter,
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
 * Умный режим (D3): непустые заметки открываются в просмотре, «Редактировать»
 * даёт textarea, «Сохранить» пишет в лист. Отдельный аккаунт, чтобы не менять
 * фикстуры визуальных тестов.
 */
test.describe('заметки: сохранение из Sheet', () => {
  test(
    'DH1: Edit → Save → перезагрузка показывает новый текст (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `notes-save-${Date.now()}`;
      const password = 'notes-save-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Notes Save',
          recoveryPhrase: 'amber cobalt lantern',
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: {
          ...dhCharacter,
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
});
