import { expect, test } from '@playwright/test';

import {
  gameCharacterId,
  openApp,
  prepare,
  sheetPath,
} from '../../../../../tests/visual/helpers';

/**
 * ─── LANDMARK: POSITIVE CONDITIONS ────────────────────────────────────────
 * Имплант и благословение — состояния наравне с расстройствами и мутациями:
 * их видно в блоке «Состояние», бейдж не красный, а сам лист с такими
 * записями открывается и переживает сохранение.
 *
 * Записи кладутся через API: фикстура воркера общая с другими снимками, и
 * менять её постоянно нельзя — после проверки `conditions` возвращаются.
 */

interface ApiCondition {
  id: string;
  kind: string;
  name: string;
  severity?: string;
  effect?: string;
  notes?: string;
  source?: string;
}

async function readConditions(
  page: import('@playwright/test').Page,
  id: string,
) {
  const response = await page.request.get('/api/characters');
  expect(response.status(), 'GET /api/characters').toBe(200);
  const all = (await response.json()) as Array<{
    id: string;
    conditions?: ApiCondition[];
  }>;
  const sheet = all.find((character) => character.id === id);
  expect(sheet, 'лист из фикстуры виден в API').toBeTruthy();
  return sheet!.conditions ?? [];
}

test.describe('положительные состояния dh1', { tag: '@plugin:dh1' }, () => {
  test(
    'имплант и благословение видны в блоке «Состояние»',
    { tag: ['@fast', '@desktop'] },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      const original = await readConditions(page, id);

      const seeded: ApiCondition[] = [
        {
          id: 'condition-implant-1',
          kind: 'implant',
          name: 'Cortical implant',
          source: 'manual',
        },
        {
          id: 'condition-blessing-1',
          kind: 'blessing',
          name: 'Emperor’s blessing',
          source: 'manual',
        },
      ];
      const seededResponse = await page.request.put(`/api/characters/${id}`, {
        data: { conditions: [...original, ...seeded] },
      });
      expect(seededResponse.status(), 'подготовка состояний').toBe(200);

      await openApp(page, sheetPath(id));

      const section = page.locator('#info-section');
      const implant = section.getByText('Implant', { exact: true }).first();
      const blessing = section.getByText('Blessing', { exact: true }).first();
      await expect(implant).toBeVisible();
      await expect(blessing).toBeVisible();
      await expect(
        section.getByText('Cortical implant', { exact: true }),
      ).toBeVisible();
      await expect(
        section.getByText('Emperor’s blessing', { exact: true }),
      ).toBeVisible();

      // Бейдж положительного типа — спокойный зелёный, а не «проблемный».
      await expect(implant).toHaveClass(/emerald/);
      await expect(blessing).toHaveClass(/emerald/);

      const restored = await page.request.put(`/api/characters/${id}`, {
        data: { conditions: original },
      });
      expect(restored.status(), 'возврат состояний').toBe(200);
    },
  );
});
