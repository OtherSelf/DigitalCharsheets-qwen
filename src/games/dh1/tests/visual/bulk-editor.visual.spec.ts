import { expect, test } from '@playwright/test';

import {
  openApp,
  prepare,
  screenshotPage,
} from '../../../../../tests/visual/helpers';

/** Вкладка DH Vitals в массовом редакторе; страница `/stats-editor` — host. */
test.describe('массовый редактор Dark Heresy', { tag: '@plugin:dh1' }, () => {
  test(
    'stats-editor — вкладка DH Vitals (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, '/stats-editor');

      await page.getByRole('button', { name: /^Dark Heresy Vitals/ }).click();
      await expect(page.getByText('Max Wounds').first()).toBeVisible();

      await screenshotPage(page, 'stats-editor-dh-vitals-en.png');
    },
  );
});
