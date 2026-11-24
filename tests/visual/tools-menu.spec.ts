import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: TOOLS MENU ──────────────────────────────────────────────────
 * Один вход в инструменты в шапке (UI-3): редактор характеристик и резервная
 * копия. Дубли на дашборде (нижняя панель и группа кнопок `sm+`) убраны,
 * поэтому меню должно работать и открываться с клавиатуры.
 */
test.describe('меню инструментов', () => {
  test('открывается с клавиатуры и ведёт в редактор @fast', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    const trigger = page.getByTestId('tools-menu-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleName('Tools');

    await trigger.focus();
    await page.keyboard.press('Enter');

    const statsItem = page.getByRole('menuitem', { name: 'Stats Editor' });
    await expect(statsItem).toBeVisible();
    await expect(page.getByTestId('tools-backup')).toBeVisible();

    await statsItem.click();
    await page.waitForURL('**/stats-editor');
  });

  test('бренд-ссылка «на главную» — домик, а не щит @fast', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    const brand = page.getByRole('link', { name: 'Back to Dashboard' });
    await expect(brand).toBeVisible();
    await expect(brand.locator('svg.lucide-house')).toHaveCount(1);
  });
});
