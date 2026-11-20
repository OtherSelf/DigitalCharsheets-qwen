import { expect, test } from '@playwright/test';

import { getState, openApp, openDialog, prepare, sheetPath } from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/**
 * Модальные окна — отдельный класс регрессий: они позиционируются поверх
 * страницы и легко «уезжают» на мобильном.
 *
 * Здесь осталась только проверка **геометрии** окна (центр, вьюпорт) — это
 * поведение хоста. Содержимое и снимки диалогов принадлежат играм:
 * `src/games/<id>/tests/visual/dialogs.visual.spec.ts` (журнал заданий,
 * домашние правила, заметки, божественные дары D&D, журнал опыта DH1,
 * сохранение заметок из Sheet).
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
