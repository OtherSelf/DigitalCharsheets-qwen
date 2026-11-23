import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

/** Вкладка D&D Vitals в массовом редакторе; страница `/stats-editor` — host. */
test.describe('массовый редактор D&D', { tag: '@plugin:dnd5e' }, () => {
  test(
    'stats-editor — вкладка D&D Vitals (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/stats-editor');

      await page.getByRole('button', { name: /^D&D Vitals/ }).click();
      await expect(page.getByText('Max HP').first()).toBeVisible();

      await screenshotPage(page, 'stats-editor-dnd-vitals-en.png');
    },
  );
});
