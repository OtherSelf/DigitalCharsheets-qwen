import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * Импорт: ошибки приходят из парсера машинным reason-кодом, а текст — из
 * словаря. Проверяем оба языка, чтобы `result.error` (русская диагностика)
 * не просачивался в английский интерфейс.
 */
test.describe('импорт: переводы ошибок', () => {
  for (const [lang, expected] of [
    ['en', 'Unrecognized file: expected a Digital Character Sheets export.'],
    ['ru', 'Неизвестный файл: ожидался экспорт Digital Character Sheets.'],
  ] as const) {
    test(`неизвестный формат (${lang})`, async ({ page, context }) => {
      await prepare(context, { account: 'canonical', language: lang });
      await openApp(page, '/');

      await page
        .getByRole('button', { name: /Import Character|Импорт персонажа/ })
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from('[]'),
      });

      await expect(dialog.getByText(expected, { exact: true })).toBeVisible();
      await expect(dialog.getByText(/io\.importError/)).toHaveCount(0);
    });
  }

  test('невалидный персонаж: текст из словаря, без русской диагностики (en)', async ({
    page,
    context,
  }) => {
    await prepare(context, { account: 'canonical', language: 'en' });
    await openApp(page, '/');

    await page.getByRole('button', { name: /Import Character/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          metadata: {
            appName: 'DigitalCharsheets-qwen',
            format: 'dcs-export',
            version: '3.0',
            kind: 'character',
            exportDate: '2026-01-01T00:00:00.000Z',
            characterCount: 1,
          },
          character: { systemId: 'probe', name: '' },
        }),
      ),
    });

    await expect(
      dialog.getByText('The character data is invalid or incomplete.'),
    ).toBeVisible();
    await expect(dialog.getByText(/Персонаж/)).toHaveCount(0);
  });
});
