import { expect, test } from '@playwright/test';

import { LANGUAGE_COOKIE } from '@/lib/language';

import { prepare, servedUrl } from './helpers';

/**
 * ─── LANDMARK: FIRST-FRAME LANGUAGE ────────────────────────────────────────
 * Язык обязан быть известен серверу: `<html lang>` и тексты приходят в первом
 * же HTML, а не появляются после гидратации. Поэтому проверки идут без
 * браузерного JS (`request`), а переключение — на живой странице: смена языка
 * не должна перезагружать документ.
 */

const RU_DEMO_TITLE = 'Попробуйте без регистрации';

test.describe('язык первого кадра', () => {
  test('cookie ru отдаёт русский HTML без гидратации @fast', async ({
    request,
  }) => {
    const response = await request.get('/demo', {
      headers: { cookie: `${LANGUAGE_COOKIE}=ru` },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toMatch(/<html[^>]*\blang="ru"/);
    expect(html).not.toMatch(/<html[^>]*\blang="en"/);
    expect(html).toContain(RU_DEMO_TITLE);
  });

  test('без cookie язык берётся из Accept-Language @fast', async ({
    request,
  }) => {
    const response = await request.get('/demo', {
      headers: { 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.5' },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toMatch(/<html[^>]*\blang="ru"/);
    expect(html).toContain(RU_DEMO_TITLE);
  });

  test('явный выбор важнее языка браузера @fast', async ({ request }) => {
    const response = await request.get('/demo', {
      headers: {
        cookie: `${LANGUAGE_COOKIE}=en`,
        'accept-language': 'ru-RU,ru;q=0.9',
      },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toMatch(/<html[^>]*\blang="en"/);
    expect(html).not.toContain(RU_DEMO_TITLE);
  });

  test('переключение не перезагружает страницу и пишет cookie @fast', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: LANGUAGE_COOKIE, value: 'en', url: servedUrl() },
    ]);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Маркер переживёт переключение только без навигации.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__dcsNoReload = true;
    });

    await page.getByRole('button', { name: 'EN', exact: true }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__dcsNoReload,
      ),
    ).toBe(true);
    await expect(page.getByText(RU_DEMO_TITLE)).toBeVisible();

    const cookies = await context.cookies(servedUrl());
    expect(
      cookies.find((cookie) => cookie.name === LANGUAGE_COOKIE)?.value,
    ).toBe('ru');
  });

  test('выбор языка сохраняется в профиле @fast', async ({ page, context }) => {
    await prepare(context, { language: 'en' });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    try {
      await page.getByRole('button', { name: 'EN', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

      // Сохранение уходит отдельным запросом: дождёмся профиля, а не кадра.
      await expect
        .poll(
          async () => {
            const response = await context.request.get('/api/auth/session');
            if (!response.ok()) return null;
            const body = (await response.json()) as {
              user?: { language?: string };
            };
            return body.user?.language;
          },
          { timeout: 10_000 },
        )
        .toBe('ru');
    } finally {
      /*
        Аккаунт воркера общий для нескольких файлов: вход через UI переносит
        язык профиля в cookie и в провайдер. Возвращаем `en`, иначе следующий
        сценарий этого воркера неожиданно окажется на русском.
      */
      await context.request.put('/api/auth/preferences', {
        data: { language: 'en' },
      });
    }
  });
});
