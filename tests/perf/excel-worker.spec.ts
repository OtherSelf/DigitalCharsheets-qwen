import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * @perf: worker-сборка xlsx действительно запускается в браузере. Turbopack
 * отдаёт воркер отдельным asset'ом, поэтому проверяем именно собранный файл:
 * он должен загрузить vendor-бандл SheetJS и вернуть непустой xlsx-buffer.
 */
test('@perf Excel: воркер собирает xlsx без главного потока', async ({
  page,
}) => {
  const media = path.join(process.cwd(), '.next', 'static', 'media');
  const workerFile = fs
    .readdirSync(media)
    .find((file) => /^excel-export\.worker\..*\.js$/.test(file));
  expect(workerFile, 'нет собранного excel-export.worker*.js').toBeTruthy();

  await page.goto('/login', { waitUntil: 'networkidle' });
  const result = await page.evaluate(
    async (workerPath) =>
      new Promise<{ ok: boolean; bytes?: number; error?: string }>(
        (resolve) => {
          try {
            const worker = new Worker(workerPath);
            const timer = setTimeout(() => {
              worker.terminate();
              resolve({ ok: false, error: 'timeout' });
            }, 20_000);
            worker.onmessage = (
              event: MessageEvent<{
                ok: boolean;
                buffer?: ArrayBuffer;
                error?: string;
              }>,
            ) => {
              clearTimeout(timer);
              worker.terminate();
              resolve({
                ok: event.data.ok,
                bytes: event.data.buffer?.byteLength,
                error: event.data.error,
              });
            };
            worker.onerror = (event) => {
              clearTimeout(timer);
              worker.terminate();
              resolve({ ok: false, error: String(event.message ?? event) });
            };
            worker.postMessage({
              rows: [
                ['Строка', 1],
                ['Ещё', 2],
              ],
              sheetName: 'Персонаж',
              columns: [{ wch: 20 }],
            });
          } catch (error) {
            resolve({ ok: false, error: String(error) });
          }
        },
      ),
    `/_next/static/media/${workerFile}`,
  );

  console.log(
    `[perf] excel worker: ok=${result.ok}, bytes=${result.bytes ?? 0}${result.error ? `, error=${result.error}` : ''}`,
  );
  expect(result.ok).toBe(true);
  expect(result.bytes ?? 0).toBeGreaterThan(1000);
});
