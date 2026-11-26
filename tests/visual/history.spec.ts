import { expect, test } from '@playwright/test';

import { PRIVACY_VERSION } from '../../src/lib/legal/privacy';
import {
  expectNoRawI18nKeys,
  getState,
  openApp,
  prepare,
  screenshotPage,
  signInViaUI,
} from './helpers';

const historyUrl = (id: string) => `/character/${id}/history`;

/**
 * Экран истории изменений. История засеяна global-setup фиксированными
 * датами: две сессии, создание, статы, инвентарь и заметки. Очистка
 * проверяется отдельно и идёт последней, чтобы не ломать снимок таймлайна.
 */
test.describe('история изменений', () => {
  test(
    'desktop: таймлайн сессий (en)',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, historyUrl(getState().dndId));

      await expect(page.getByTestId('history-page')).toBeVisible();
      await expect(page.getByTestId('history-session')).toHaveCount(2);
      await expect(page.getByTestId('history-change').first()).toBeVisible();
      await expect(page.getByText('Change history')).toBeVisible();
      await expectNoRawI18nKeys(page, 'история (en)');
      await screenshotPage(page, 'history-timeline-en.png');
    },
  );

  test(
    'mobile: таймлайн (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, historyUrl(getState().dndId));

      await expect(page.getByTestId('history-page')).toBeVisible();
      await expect(page.getByTestId('history-session')).toHaveCount(2);
      await expectNoRawI18nKeys(page, 'история mobile (en)');
      await screenshotPage(page, 'history-mobile-en.png');
    },
  );

  test(
    'desktop: пустая история после очистки (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      const state = getState();
      await prepare(context);
      const cleared = await context.request.delete(
        `/api/characters/${encodeURIComponent(state.dndId)}/history`,
      );
      expect(cleared.status()).toBe(200);

      await openApp(page, historyUrl(state.dndId));
      await expect(page.getByTestId('history-empty')).toBeVisible();
      await expectNoRawI18nKeys(page, 'пустая история (en)');
      await screenshotPage(page, 'history-empty-en.png');
    },
  );
});

/**
 * ─── LANDMARK: HISTORY I18N ALL GAMES ─────────────────────────────────────
 * DH1/DH2 не имеют засеянных фикстур истории, поэтому создаём временный
 * аккаунт и пишем изменения через API. Проверяем, что сырые коды (id
 * пророчества, склонностей, пола) и JSON массивов не попадают в таймлайн.
 */
async function registerTempAccount(
  page: import('@playwright/test').Page,
  label: string,
): Promise<{ username: string; password: string }> {
  const username = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const password = 'history-password-1';
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

test.describe('история DH: подписи и значения без кодов', () => {
  test(
    'DH1: пророчество и продвижения характеристик (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const account = await registerTempAccount(page, 'history-dh1');
      const created = await page.request.post('/api/characters', {
        data: {
          systemId: 'dh1',
          name: 'History DH1',
          homeWorld: 'Hive World',
          careerPath: 'Adept',
          divination: 'painOfBullet',
        },
      });
      expect([200, 201], 'создание листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      const updated = await page.request.put(`/api/characters/${id}`, {
        data: {
          divination: 'sinsHidden',
          statUpgrades: { weaponSkill: [false, true, false, false] },
        },
      });
      expect(updated.status(), 'правка листа').toBe(200);

      await signInViaUI(page, account);
      await openApp(page, historyUrl(id));
      await expectNoRawI18nKeys(page, 'история DH1');
      await expect(page.getByText('Divination', { exact: true })).toBeVisible();
      await expect(page.getByText(/What is hidden rots faster/)).toBeVisible();
      await expect(page.getByText('painOfBullet')).toHaveCount(0);
      await expect(page.getByText('sinsHidden')).toHaveCount(0);
      await expect(
        page.getByText('Characteristic advances · Weapon Skill'),
      ).toBeVisible();
      await expect(page.getByText('0/4', { exact: true })).toBeVisible();
      await expect(page.getByText('1/4', { exact: true })).toBeVisible();
      await expect(page.locator('pre', { hasText: '[false' })).toHaveCount(0);
      await expect(page.locator('pre', { hasText: 'true' })).toHaveCount(0);
    },
  );

  test(
    'DH2: пол, склонности и стартовые выборы (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const account = await registerTempAccount(page, 'history-dh2');
      const created = await page.request.post('/api/characters', {
        data: {
          systemId: 'dh2',
          name: 'History DH2',
          homeWorld: 'hive-world',
          background: 'adeptus-arbites',
          role: 'warrior',
          gender: 'male',
        },
      });
      expect([200, 201], 'создание листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      const updated = await page.request.put(`/api/characters/${id}`, {
        data: {
          gender: 'female',
          eliteAdvances: ['psyker'],
          startingChoices: {
            roleTalent: 'iron-jaw',
            skills: ['inquiry'],
            talents: [],
          },
        },
      });
      expect(updated.status(), 'правка листа').toBe(200);

      await signInViaUI(page, account);
      await openApp(page, historyUrl(id));
      await expectNoRawI18nKeys(page, 'история DH2');
      await expect(page.getByText('Gender', { exact: true })).toBeVisible();
      // Пол в диффе — строка «+Female», поэтому ищем подстроку, а не точный текст.
      await expect(page.getByText('Female', { exact: false })).toBeVisible();
      await expect(
        page.getByText('Elite Advances', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Psyker', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Role talent', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Iron Jaw', { exact: true })).toBeVisible();
      await expect(page.getByText('Inquiry', { exact: true })).toBeVisible();
      await expect(page.getByText(/^psyker$/)).toHaveCount(0);
      await expect(page.getByText(/^iron-jaw$/)).toHaveCount(0);
      await expect(page.getByText(/^inquiry$/)).toHaveCount(0);
      await expect(page.locator('pre', { hasText: '["' })).toHaveCount(0);
    },
  );
});
