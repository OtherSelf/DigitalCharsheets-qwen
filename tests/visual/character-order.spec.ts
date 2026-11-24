import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: CHARACTER ORDER ─────────────────────────────────────────────
 * Порядок карточек задаётся с клавиатуры (та же ручка, что и для мыши),
 * сохраняется в профиле и переживает перезагрузку. После проверки порядок
 * возвращается как был: аккаунт воркера общий с другими тестами дашборда.
 */

async function cardNames(page: import('@playwright/test').Page) {
  return page
    .getByTestId('character-card')
    .evaluateAll((cards) =>
      cards.map(
        (card) =>
          card.querySelector('.font-headline')?.textContent?.trim() ?? '',
      ),
    );
}

async function cardIds(page: import('@playwright/test').Page) {
  return page
    .getByTestId('character-card')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-character-id') ?? ''),
    );
}

test.describe('порядок карточек', { tag: ['@fast', '@desktop'] }, () => {
  test('перестановка с клавиатуры сохраняется после перезагрузки', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    const names = await cardNames(page);
    const ids = await cardIds(page);
    expect(names.length, 'в фикстуре несколько карточек').toBeGreaterThan(1);

    const handles = page.getByRole('button', { name: 'Drag to reorder' });
    await expect(handles).toHaveCount(names.length);
    await handles.first().focus();
    // Space — взять, стрелка — переместить, Space — отпустить (dnd-kit).
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes('/api/characters/order') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    );
    await page.keyboard.press('Space');
    await saved;

    const expected = [names[1], names[0], ...names.slice(2)];
    await expect.poll(() => cardNames(page)).toEqual(expected);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect.poll(() => cardNames(page)).toEqual(expected);

    // Возвращаем исходный порядок, чтобы не менять данные других тестов.
    const restored = await page.request.put('/api/characters/order', {
      data: { order: ids },
    });
    expect(restored.status()).toBe(200);
  });
});
