import { expect, test } from '@playwright/test';

import { PRIVACY_VERSION } from '@/lib/legal/privacy';

import {
  expectNoRawI18nKeys,
  openApp,
  prepare,
  screenshotPage,
  signInViaUI,
} from './helpers';

/**
 * Страница `/archive`: вкладки «Архив» и «Корзина», карточки со сроком и
 * действиями. Листы создаются через API во временном аккаунте, чтобы не
 * менять seeded-данные других сценариев.
 */
async function registerTempAccount(
  page: import('@playwright/test').Page,
  label: string,
): Promise<{ username: string; password: string }> {
  const username = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const password = 'archive-password-1';
  const registered = await page.request.post('/api/auth/register', {
    data: {
      username,
      password,
      displayName: label,
      recoveryPhrase: 'amber cobalt lantern silver ember frost',
      consent: true,
      privacyVersion: PRIVACY_VERSION,
    },
  });
  expect([200, 201], 'регистрация аккаунта').toContain(registered.status());
  return { username, password };
}

async function seedArchive(page: import('@playwright/test').Page) {
  const archived = await page.request.post('/api/characters', {
    data: { systemId: 'dnd5e', name: 'Archived Hero' },
  });
  expect([200, 201], 'создание архивного листа').toContain(archived.status());
  const archivedId = ((await archived.json()) as { id: string }).id;
  const moved = await page.request.post(
    `/api/characters/${encodeURIComponent(archivedId)}/archive`,
  );
  expect(moved.status(), 'перенос в архив').toBe(200);

  const deleted = await page.request.post('/api/characters', {
    data: { systemId: 'dnd5e', name: 'Deleted Hero' },
  });
  expect([200, 201], 'создание удалённого листа').toContain(deleted.status());
  const deletedId = ((await deleted.json()) as { id: string }).id;
  const trashed = await page.request.delete(
    `/api/characters/${encodeURIComponent(deletedId)}`,
  );
  expect(trashed.status(), 'перенос в корзину').toBe(200);

  return { archivedId, deletedId };
}

test.describe('архив и корзина', () => {
  test(
    'desktop: архив и корзина (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const account = await registerTempAccount(page, 'archive');
      const { archivedId, deletedId } = await seedArchive(page);

      await signInViaUI(page, account);
      await openApp(page, '/archive');

      await expect(page.getByTestId('archive-page')).toBeVisible();
      await expect(
        page.getByTestId(`archive-item-${archivedId}`),
      ).toBeVisible();
      await expectNoRawI18nKeys(page, 'архив (en)');
      await screenshotPage(page, 'archive-desktop-en.png');

      await page.getByTestId('trash-tab').click();
      await expect(page.getByTestId(`archive-item-${deletedId}`)).toBeVisible();
      await expectNoRawI18nKeys(page, 'корзина (en)');
      await screenshotPage(page, 'archive-trash-desktop-en.png');
    },
  );

  test('mobile: архив (en)', { tag: '@mobile' }, async ({ page, context }) => {
    await prepare(context);
    const account = await registerTempAccount(page, 'archive-mobile');
    const { archivedId } = await seedArchive(page);

    await signInViaUI(page, account);
    await openApp(page, '/archive');

    await expect(page.getByTestId(`archive-item-${archivedId}`)).toBeVisible();
    await expectNoRawI18nKeys(page, 'архив mobile (en)');
    await screenshotPage(page, 'archive-mobile-en.png');
  });
});
