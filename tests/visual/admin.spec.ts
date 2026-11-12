import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  openApp,
  prepare,
  screenshotPage,
} from './helpers';
import { readAdminState } from './state';

/**
 * ─── LANDMARK: ADMIN VISUAL SPEC ───────────────────────────────────────────
 * Снимки страницы /admin: список пользователей, диалоги редактирования,
 * листов, блокировки и удаления.
 *
 * Детерминизм:
 *   • global-setup сеет три демо-аккаунта `visual-admin-*` с фиксированными
 *     датами, ролями, блокировками и листами (см. tests/visual/global-setup.ts);
 *   • поиск `visual-admin-` в таблице скрывает canonical/воркерские аккаунты,
 *     поэтому число воркеров на снимок не влияет;
 *   • числа в карточках статистики глобальные (зависят от числа аккаунтов),
 *     поэтому они маскируются во всех снимках.
 *
 * Запуск: только через `npm run test:visual` (scripts/visual.sh). В режиме
 * `--base-url` и при прямом `playwright test` global-setup не имеет доступа
 * к data-dir, поэтому тесты честно пропускаются.
 */

const admin = readAdminState();

/** Открыть /admin под служебным админом и отфильтровать демо-аккаунты. */
async function openAdminUsers(
  page: Page,
  context: BrowserContext,
  language: 'en' | 'ru' = 'en',
): Promise<void> {
  await prepare(context, { account: 'admin', theme: 'light', language });
  await openApp(page, '/admin');

  await expect(page.getByTestId('admin-search')).toBeVisible();
  await page.getByTestId('admin-search').fill('visual-admin-');
  await expect(page.getByTestId('admin-user-row')).toHaveCount(3);
}

function rowByUsername(page: Page, username: string) {
  return page.locator(`tr[data-username="${username}"]`);
}

test.describe('admin', () => {
  test.skip(
    !admin,
    'нет админского аккаунта в .visual-state.json — запустите npm run test:visual',
  );

  test('admin — список пользователей (en)', async ({ page, context }) => {
    await openAdminUsers(page, context, 'en');

    await expect(
      page.getByRole('heading', { name: 'Administration' }),
    ).toBeVisible();

    const table = page.getByRole('table');
    await expect(table.getByText('Alice Ashford')).toBeVisible();
    await expect(table.getByText('Bob Brannigan')).toBeVisible();
    await expect(table.getByText('Carol Voss')).toBeVisible();
    // Бейджи есть и в колонках (desktop), и в мобильной сводке под именем;
    // проверяем именно видимую копию.
    await expect(
      table.getByText('Blocked', { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      table
        .getByText('Administrator', { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();

    // Таблица со скроллом не должна растягивать страницу по горизонтали.
    await expectNoHorizontalOverflow(page);

    await screenshotPage(page, 'admin-users-en.png');
  });

  test('admin — список пользователей (ru)', async ({ page, context }) => {
    await openAdminUsers(page, context, 'ru');

    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Пользователь' }),
    ).toBeVisible();
    await expect(page.getByTestId('admin-user-row')).toHaveCount(3);

    await screenshotPage(page, 'admin-users-ru.png');
  });

  test('admin — диалог редактирования (en)', async ({ page, context }) => {
    await openAdminUsers(page, context);

    await rowByUsername(page, 'visual-admin-alice')
      .getByRole('button', { name: /Edit user/i })
      .click();

    const dialog = page.getByTestId('admin-edit-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Display Name')).toHaveValue(
      'Alice Ashford',
    );
    await expect(dialog.getByLabel('Login')).toHaveValue('visual-admin-alice');

    await screenshotPage(page, 'admin-edit-en.png');
  });

  test('admin — диалог листов персонажа (en)', async ({ page, context }) => {
    await openAdminUsers(page, context);

    await rowByUsername(page, 'visual-admin-alice')
      .getByRole('button', { name: /View character sheets/i })
      .click();

    const dialog = page.getByTestId('admin-sheets-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Seraphina Vael')).toBeVisible();
    await expect(dialog.getByText('Lucius Varn')).toBeVisible();
    // Бейдж игры берётся из реестра плагинов (nameKey), а не из gameSystem.
    await expect(
      dialog.getByText('5th Edition', { exact: true }),
    ).toBeVisible();

    await screenshotPage(page, 'admin-sheets-en.png');
  });

  test('admin — диалог блокировки (en)', async ({ page, context }) => {
    await openAdminUsers(page, context);

    await rowByUsername(page, 'visual-admin-alice')
      .getByRole('button', { name: /^Block:/ })
      .click();

    const dialog = page.getByTestId('admin-block-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Block user?')).toBeVisible();

    await screenshotPage(page, 'admin-block-en.png');
  });

  test('admin — диалог удаления (en)', async ({ page, context }) => {
    await openAdminUsers(page, context);

    await rowByUsername(page, 'visual-admin-bob')
      .getByRole('button', { name: /^Delete:/ })
      .click();

    const dialog = page.getByTestId('admin-delete-dialog');
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel(/Type visual-admin-bob to confirm/)
      .fill('visual-admin-bob');
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await screenshotPage(page, 'admin-delete-en.png');
  });
});
