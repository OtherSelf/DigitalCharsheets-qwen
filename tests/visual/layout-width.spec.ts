import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: CONTENT WIDTH ───────────────────────────────────────────────
 * Ширина контента ограничена `--content-max` (1760), а карточки занимают
 * столько колонок, сколько помещается при минимальной ширине 18rem. Тест
 * фиксирует обе границы: на 1440 и уже раскладка прежняя (4/3/2/1), на 1760+
 * появляется пятая колонка и дальше контент не растёт.
 */

/** Сколько колонок в первом ряду сетки карточек. */
async function columnCount(page: import('@playwright/test').Page) {
  return page
    .getByTestId('archive-character')
    .first()
    .evaluate((element) => {
      let node = element.parentElement;
      while (node && getComputedStyle(node).display !== 'grid') {
        node = node.parentElement;
      }
      if (!node) return 0;
      return getComputedStyle(node)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length;
    });
}

async function contentWidth(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const shell = main?.firstElementChild;
    return shell instanceof HTMLElement
      ? Math.round(shell.getBoundingClientRect().width)
      : 0;
  });
}

test.describe('ширина контента и сетка карточек', { tag: '@desktop' }, () => {
  test('колонки по месту, ширина ограничена @fast', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    const cases: { width: number; columns: number }[] = [
      { width: 1920, columns: 5 },
      { width: 1760, columns: 5 },
      { width: 1440, columns: 4 },
      { width: 1024, columns: 3 },
      { width: 768, columns: 2 },
    ];

    for (const entry of cases) {
      await page.setViewportSize({ width: entry.width, height: 900 });
      await expect
        .poll(() => columnCount(page), { timeout: 5_000 })
        .toBe(entry.columns);
      const shell = await contentWidth(page);
      expect(shell, `${entry.width}: контейнер ≤ 1760`).toBeLessThanOrEqual(
        1760,
      );
      // До 1760 контейнер занимает всю доступную ширину, после — стоит по
      // центру и не растёт.
      if (entry.width > 1760) {
        expect(shell, `${entry.width}: поля симметричны`).toBe(1760);
      }
    }
  });

  test('на телефоне карточки в одну колонку', async ({ page, context }) => {
    await prepare(context);
    await openApp(page, '/');
    await page.setViewportSize({ width: 393, height: 800 });
    await expect.poll(() => columnCount(page), { timeout: 5_000 }).toBe(1);
  });
});
