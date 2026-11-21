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

const isMobile = () => test.info().project.name === 'mobile';

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

  test(
    'mobile: игры — карточки и доступные переключатели',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context, {
        account: 'admin',
        theme: 'light',
        language: 'en',
      });
      await openApp(page, '/admin');

      const cards = page.locator('[data-testid^="admin-game-card-"]');
      await expect(cards.first()).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Таблица в 820 px на телефоне уезжала за экран вместе с селектом
      // статуса и галочкой видимости; в карточке всё должно быть в пределах
      // вьюпорта.
      const offscreen = await cards.first().evaluate((card) => {
        const width = window.innerWidth;
        return Array.from(
          card.querySelectorAll('button, input, [role="combobox"], label'),
        )
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.right > width + 1 || box.left < -1);
          })
          .map((element) => element.outerHTML.slice(0, 80));
      });
      expect(offscreen, 'в карточке нет элементов за экраном').toEqual([]);

      await expect(cards.first().getByRole('combobox')).toBeVisible();
      await expect(cards.first().getByRole('checkbox')).toBeVisible();
    },
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
    // Короткий код игры из реестра: nameKey даёт только редакцию, код
    // не переводится и не зависит от локали.
    await expect(dialog.getByText('dnd5e', { exact: true })).toBeVisible();
    await expect(dialog.getByText('dh1e', { exact: true })).toBeVisible();

    // Подпись листа собирает плагин слотом `CardSummary`: ядро не знает ни
    // уровня, ни ранга, поэтому ждём загрузки слота, а не появления текста
    // конкретной игры.
    const details = dialog.getByTestId('admin-sheet-details');
    await expect(details.nth(0)).not.toHaveText('—');
    await expect(details.nth(1)).not.toHaveText('—');

    // Tooltip — полное имя игры и редакция из i18n.
    await dialog.getByText('dh1e', { exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText(
      'Dark Heresy · 1st Edition',
    );
    await page.mouse.move(0, 0);

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

/**
 * Настройки редакции: первая колонка показывает семейство, вторая — редакцию,
 * а шестерёнка открывает окно тонких настроек (пока одно — стили ядра).
 * Переключатель здесь не дёргаем: каталог общий на весь прогон.
 */
test.describe('admin — игры и редакции', () => {
  test.skip(
    !admin,
    'нет админского аккаунта в .visual-state.json — запустите npm run test:visual',
  );

  test('семейство в «Игра», шестерёнка открывает настройки (en)', async ({
    page,
    context,
  }) => {
    await prepare(context, { account: 'admin', theme: 'light' });
    await openApp(page, '/admin');

    const heading = page.getByText('Games & editions').first();
    await heading.scrollIntoViewIfNeeded();
    const settingsButton = page
      .getByRole('button', { name: /Game settings:/ })
      .first();

    if (isMobile()) {
      // На телефоне таблица заменена карточками: проверяем содержимое
      // карточки, а не колонки.
      const card = settingsButton.locator(
        'xpath=ancestor::*[@data-testid][starts-with(@data-testid,"admin-game-card-")]',
      );
      await expect(card).toHaveCount(1);
      await expect(card.getByRole('combobox')).toBeVisible();
      await expect(card.getByRole('checkbox')).toBeVisible();
    } else {
      await expect(
        page.getByRole('columnheader', { name: 'Game' }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Edition' }),
      ).toBeVisible();
      const gameRow = settingsButton.locator('xpath=ancestor::tr');
      await expect(gameRow.locator('td').nth(0)).not.toBeEmpty();
      await expect(gameRow.locator('td').nth(1)).not.toBeEmpty();
    }

    await settingsButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('checkbox', { name: "Use the game's theme" }),
    ).toBeChecked();
    await expect(dialog.getByRole('link', { name: /Open demo/ })).toBeVisible();

    await screenshotPage(page, 'admin-game-settings-en.png');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
