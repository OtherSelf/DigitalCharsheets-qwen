import { expect, test } from '@playwright/test';

import {
  getState,
  openApp,
  openDialog,
  openMobileSection,
  prepare,
  sheetPath,
  swipeSheet,
} from './helpers';

/**
 * ─── LANDMARK: SHEET SWIPE CLOSE ──────────────────────────────────────────
 * Правые шторки (заметки, журнал, нарратив, журнал опыта) закрываются
 * свайпом вправо. Жест живёт в одном `SheetContent`, поэтому проверяем его
 * на всех четырёх потребителях, а не в каждой шторке отдельно.
 *
 * Короткий свайп панель не закрывает — иначе любое случайное касание
 * выкидывало бы из редактора.
 */
test.describe('правые шторки — свайп', { tag: '@mobile' }, () => {
  test('заметки: короткий свайп не закрывает, длинный закрывает', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Notes', true);

    await swipeSheet(page, { distance: 40, steps: 4 });
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('после свайпа шторка открывается снова', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Notes', true);

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Notes', exact: true })
      .click();
    await expect(dialog).toBeVisible();
    // Регресс: после закрытия свайпом панель оставалась за краем экрана —
    // затемнение появлялось, а шторки не было.
    await expect(dialog).toBeInViewport();
  });

  test('длинный свайп не возвращает шторку в кадр до закрытия', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Notes', true);
    const box = await dialog.boundingBox();
    expect(box, 'у шторки есть геометрия').not.toBeNull();

    const client = await page.context().newCDPSession(page);
    const fromX = box!.x + 24;
    const y = box!.y + box!.height / 2;
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: fromX, y }],
      });
      for (let step = 1; step <= 6; step += 1) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: fromX + (220 * step) / 6, y }],
        });
        await page.waitForTimeout(20);
      }
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    } finally {
      await client.detach();
    }

    // Сразу после отпускания панель должна уезжать только вправо. Если
    // сбросить drag до нуля раньше close, кадр показывает рывок назад.
    //
    // Сэмплируем геометрию из страницы, а не через `locator.boundingBox()`:
    // после закрытия локатор ждёт видимости и упирается в таймаут (~15 с на
    // кадр), из-за чего сценарий висел 90 с. `getBoundingClientRect` в
    // requestAnimationFrame читает кадр без ожиданий.
    await page.waitForTimeout(30);
    const samples = await page.evaluate(async () => {
      const values: number[] = [];
      const started = performance.now();
      while (performance.now() - started < 260) {
        const element = document.querySelector('[role="dialog"]');
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) values.push(rect.x);
        }
        await new Promise(requestAnimationFrame);
      }
      return values;
    });
    expect(samples.some((x) => x > box!.x + 40)).toBe(true);
    expect(
      samples.filter((x) => x <= box!.x + 5),
      'панель не должна возвращаться к исходной позиции',
    ).toHaveLength(0);

    await expect(dialog).not.toBeVisible();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Notes', exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();
  });

  test('журнал заданий закрывается свайпом', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    const dialog = await openDialog(page, 'Quest Journal', true);

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('журнал опыта закрывается свайпом', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    await openMobileSection(page, 'Experience', 'progression-section');

    await page.getByRole('button', { name: 'XP log' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });

  test('нарратив (Backstory) закрывается свайпом', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dhId));
    await openMobileSection(page, 'Info', 'info-section');

    const backstory = page.getByRole('button', { name: 'Backstory' }).first();
    await backstory.scrollIntoViewIfNeeded();
    await backstory.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await swipeSheet(page);
    await expect(dialog).not.toBeVisible();
  });
});
