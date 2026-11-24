import { expect, test } from '@playwright/test';

import { openApp, prepare, screenshotPage } from './helpers';

/**
 * ─── LANDMARK: DOCS VISUAL ──────────────────────────────────────────────────
 * Страница документации: корень (карта) и длинная статья. Ловит то, что не
 * видно в HTML-проверках: сайдбар с порядком из карты, оглавление, код-блоки и
 * собственный скролл-контейнер при `overflow: clip` на корне приложения.
 *
 * /docs публичный, поэтому `authenticated: false` проверяет ещё и доступ без
 * сессии.
 */
const isMobile = () => test.info().project.name === 'mobile';

test.describe('документация', () => {
  test('docs — корень с картой (en)', async ({ page, context }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/docs');

    await expect(
      page.getByRole('heading', { name: 'Documentation', level: 1 }),
    ).toBeVisible();
    // На телефоне сайдбар — шторка, поэтому ссылки проверяются только на
    // десктопе; мобильный кадр фиксирует шапку и саму статью.
    if (!isMobile()) {
      await expect(
        page.getByRole('link', { name: 'Architecture', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'API reference', exact: true }),
      ).toBeVisible();
    }
    await screenshotPage(page, 'docs-en.png');
  });

  test('docs — статья с оглавлением и скроллом (en)', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/docs/architecture');

    await expect(
      page.getByRole('heading', { name: 'Architecture', level: 1 }),
    ).toBeVisible();
    // Оглавление статьи видно только на широком экране; на телефоне это
    // поповер, который открывается кнопкой в шапке.
    if (!isMobile()) {
      await expect(page.getByText('On this page')).toBeVisible();
    }
    await screenshotPage(page, 'docs-architecture-en.png');

    // Корень приложения не скроллится (`overflow: clip`), поэтому длинная
    // статья обязана прокручиваться внутри своего контейнера.
    const scrolled = await page.evaluate(() => {
      const container = document.querySelector('.docs-scroll');
      if (!container) return null;
      container.scrollTop = container.scrollHeight;
      return { top: container.scrollTop, height: container.scrollHeight };
    });
    expect(scrolled, '.docs-scroll не найден').not.toBeNull();
    expect(scrolled?.top ?? 0).toBeGreaterThan(1000);
  });
});

test.describe('документация: «наверх»', () => {
  test('кнопка в конце статьи возвращает к началу @fast', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false });
    await openApp(page, '/docs/architecture');

    const scroller = page.locator('.docs-scroll');
    await scroller.evaluate((element) => element.scrollTo({ top: 5000 }));
    await expect
      .poll(async () => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const backToTop = page.getByTestId('docs-back-to-top');
    await backToTop.scrollIntoViewIfNeeded();
    await expect(backToTop).toHaveAccessibleName('Back to top');
    await backToTop.click();

    await expect
      .poll(async () => scroller.evaluate((element) => element.scrollTop), {
        timeout: 5_000,
      })
      .toBe(0);
  });
});
