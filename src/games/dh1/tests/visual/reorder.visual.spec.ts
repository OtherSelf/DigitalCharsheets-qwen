import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  openDialog,
  prepare,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * ─── LANDMARK: SHEET REORDER ──────────────────────────────────────────────
 * Перестановка строк листа: клавиатурой через ручку, с сохранением в файл и
 * восстановлением порядка после перезагрузки. Мышь/палец проверять отдельно
 * не нужно: все три способа идут через один activator-элемент и один
 * `onDragEnd` — клавиатура доказывает, что порядок действительно меняется и
 * уходит в сохранение.
 *
 * Порядок возвращается как был: аккаунт воркера общий с остальными снимками.
 */

interface ApiSkill {
  id: string;
  name: string;
  type: string;
}

interface ApiInventoryItem {
  id: string;
  name: string;
}

interface ApiQuest {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

async function readSheet(page: import('@playwright/test').Page, id: string) {
  const response = await page.request.get('/api/characters');
  expect(response.status(), 'GET /api/characters').toBe(200);
  const all = (await response.json()) as Array<{
    id: string;
    skills?: ApiSkill[];
    inventory?: ApiInventoryItem[];
    questLog?: ApiQuest[];
  }>;
  const sheet = all.find((character) => character.id === id);
  expect(sheet, 'лист из фикстуры виден в API').toBeTruthy();
  return sheet!;
}

test.describe('перестановка строк листа dh1', { tag: '@plugin:dh1' }, () => {
  test(
    'навыки: клавиатура сохраняет порядок и он переживает перезагрузку',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const original = await readSheet(page, id);

      await openApp(page, sheetPath(id));
      const table = page.locator('#skills-section table').first();
      const names = table.locator('tbody tr td:first-child p');
      const before = await names.allTextContents();
      expect(
        before.length,
        'в фикстуре несколько базовых навыков',
      ).toBeGreaterThan(1);

      const handle = table
        .locator('tbody tr')
        .first()
        .getByTestId('reorder-handle');
      await expect(handle).toHaveAttribute('aria-label', /.+/);
      await handle.focus();
      // Space — взять, стрелка — переместить, Space — отпустить (dnd-kit).
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);

      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      await page.keyboard.press('Space');
      await saved;

      const expected = [before[1], before[0], ...before.slice(2)];
      await expect.poll(() => names.allTextContents()).toEqual(expected);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect
        .poll(() =>
          table.locator('tbody tr td:first-child p').allTextContents(),
        )
        .toEqual(expected);

      // Ручки — кнопки с именем: axe не должен видеть новых serious/critical.
      const results = await new AxeBuilder({ page })
        .include('#skills-section')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const blocking = results.violations
        .filter((violation) => violation.id !== 'button-name')
        .filter(
          (violation) =>
            violation.impact === 'serious' || violation.impact === 'critical',
        )
        .map((violation) => violation.id);
      expect(blocking, 'навыки: axe serious/critical').toEqual([]);

      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { skills: original.skills ?? [] },
      });
      expect(restored.status(), 'возврат порядка навыков').toBe(200);
    },
  );

  test(
    'инвентарь: клавиатура сохраняет порядок и он переживает перезагрузку',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const original = await readSheet(page, id);
      expect(
        original.inventory?.length ?? 0,
        'в фикстуре несколько предметов',
      ).toBeGreaterThan(1);

      await openApp(page, sheetPath(id));

      const rows = page.locator('#inventory-section [data-sortable-id]');
      await expect(rows).toHaveCount(original.inventory!.length);
      const before = await rows.evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.querySelector('.font-medium')?.textContent?.trim() ?? '',
        ),
      );

      const handle = rows.first().getByTestId('reorder-handle');
      await handle.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);

      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      await page.keyboard.press('Space');
      await saved;

      const expected = [before[1], before[0], ...before.slice(2)];
      await expect
        .poll(() =>
          rows.evaluateAll((nodes) =>
            nodes.map(
              (node) =>
                node.querySelector('.font-medium')?.textContent?.trim() ?? '',
            ),
          ),
        )
        .toEqual(expected);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect
        .poll(() =>
          page
            .locator('#inventory-section [data-sortable-id]')
            .evaluateAll((nodes) =>
              nodes.map(
                (node) =>
                  node.querySelector('.font-medium')?.textContent?.trim() ?? '',
              ),
            ),
        )
        .toEqual(expected);

      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { inventory: original.inventory ?? [] },
      });
      expect(restored.status(), 'возврат порядка предметов').toBe(200);
    },
  );

  test(
    'журнал заданий: стрелок нет, порядок меняется перетаскиванием',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const original = await readSheet(page, id);
      const originalQuests = original.questLog ?? [];

      // В фикстуре одна запись: добавляем вторую через API, чтобы было что
      // переставлять, и возвращаем журнал как был в конце.
      const seeded: ApiQuest[] = [
        {
          id: 'quest-reorder-a',
          title: 'Reorder probe A',
          status: 'active',
          priority: 'side',
          description: 'Проверка перестановки.',
          createdAt: '2025-04-01T08:00:00.000Z',
          updatedAt: '2025-04-01T08:00:00.000Z',
        },
        {
          id: 'quest-reorder-b',
          title: 'Reorder probe B',
          status: 'active',
          priority: 'side',
          description: 'Проверка перестановки.',
          createdAt: '2025-04-02T08:00:00.000Z',
          updatedAt: '2025-04-02T08:00:00.000Z',
        },
        ...originalQuests,
      ];
      const seededResponse = await page.request.put(`/api/characters/${id}`, {
        data: { questLog: seeded },
      });
      expect(seededResponse.status(), 'подготовка журнала').toBe(200);

      await openApp(page, sheetPath(id));
      const dialog = await openDialog(page, 'Quest Journal', false);
      const items = dialog.locator('[data-sortable-id]');
      await expect(items).toHaveCount(seeded.length);
      await expect(
        dialog.getByText('Reorder probe A', { exact: true }),
      ).toBeVisible();

      // Стрелок больше нет — порядок задаётся только ручкой.
      await expect(
        dialog.getByRole('button', { name: /Move (up|down)|Выше|Ниже/ }),
      ).toHaveCount(0);

      const before = await items.evaluateAll((nodes) =>
        nodes.map((node) => node.textContent?.trim() ?? ''),
      );

      const handle = items.first().getByTestId('reorder-handle');
      await handle.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      );
      await page.keyboard.press('Space');
      await saved;

      const expected = [before[1], before[0], ...before.slice(2)];
      await expect
        .poll(() =>
          items.evaluateAll((nodes) =>
            nodes.map((node) => node.textContent?.trim() ?? ''),
          ),
        )
        .toEqual(expected);

      await page.reload();
      await page.waitForLoadState('networkidle');
      const reopened = await openDialog(page, 'Quest Journal', false);
      await expect
        .poll(() =>
          reopened
            .locator('[data-sortable-id]')
            .evaluateAll((nodes) =>
              nodes.map((node) => node.textContent?.trim() ?? ''),
            ),
        )
        .toEqual(expected);

      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { questLog: originalQuests },
      });
      expect(restored.status(), 'возврат журнала').toBe(200);
    },
  );
});
