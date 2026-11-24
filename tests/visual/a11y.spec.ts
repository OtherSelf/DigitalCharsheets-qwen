import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { getState, openApp, prepare, sheetPath } from './helpers';

/**
 * ─── LANDMARK: A11Y GATE (axe) ─────────────────────────────────────────────
 * Автоматический прогон ключевых экранов: падаем на `serious`/`critical`,
 * остальное печатаем в отчёт. Это не замена ручной проверке фокуса и
 * скринридера, а регрессионный гейт (UI-5).
 *
 * Разрешённые нарушения — только через `ALLOWLIST` с причиной и ссылкой на
 * находку аудита: «известный долг», а не «правило неудобное».
 */

interface AxeAllowEntry {
  rule: string;
  /** Путь, к которому относится правило; `*` — везде. */
  page: string;
  reason: string;
}

const ALLOWLIST: AxeAllowEntry[] = [];

/**
 * Потолок безымянных кнопок на листе (UI-1, см. _BACKLOG.md): у мобильного
 * компактного листа набор кнопок другой, поэтому бюджеты разные.
 */
const SHEET_BUTTON_NAME_BUDGET: Record<string, number> = {
  desktop: 52,
  mobile: 0,
};

const PAGES: {
  name: string;
  path: string;
  account: 'worker' | 'admin' | 'guest';
}[] = [
  { name: 'dashboard', path: '/', account: 'worker' },
  { name: 'demo', path: '/demo', account: 'guest' },
  { name: 'login', path: '/login', account: 'guest' },
  { name: 'settings', path: '/settings', account: 'worker' },
  { name: 'admin', path: '/admin', account: 'admin' },
  { name: 'docs', path: '/docs', account: 'guest' },
];

test.describe('axe: ключевые экраны', { tag: '@fast' }, () => {
  for (const entry of PAGES) {
    test(`${entry.name}: нет serious/critical`, async ({ page, context }) => {
      await prepare(context, {
        authenticated: entry.account !== 'guest',
        account: entry.account === 'admin' ? 'admin' : 'worker',
      });
      await openApp(page, entry.path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const allowed = (rule: string) =>
        ALLOWLIST.some(
          (item) =>
            item.rule === rule &&
            (item.page === '*' || item.page === entry.path),
        );

      const blocking = results.violations
        .filter(
          (violation) =>
            violation.impact === 'serious' || violation.impact === 'critical',
        )
        .filter((violation) => !allowed(violation.id))
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes
            .map((node) => node.target.join(' '))
            .slice(0, 5),
        }));

      expect(blocking, `${entry.path}: axe serious/critical`).toEqual([]);
    });
  }

  /**
   * Листы плагинов — известный долг: счётчики хитов/ячеек/патронов и поповеры
   * рисуются иконочными кнопками без имени (UI-1). Вместо «разрешаем правило
   * везде» держим потолок: он падает, если таких кнопок станет больше, и его
   * опускают по мере починки. Остальные serious/critical на листе — гейт.
   */
  test('лист персонажа: гейт serious/critical с потолком button-name', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, sheetPath(getState().dndId));

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const buttonName = results.violations.find(
      (violation) => violation.id === 'button-name',
    );
    const unnamed = buttonName?.nodes.length ?? 0;
    const budget = SHEET_BUTTON_NAME_BUDGET[test.info().project.name] ?? 0;
    const targets = buttonName?.nodes.map((node) => node.target.join(' '));
    expect(
      unnamed,
      `лист: безымянных иконочных кнопок ${unnamed} (потолок ${budget}, UI-1): ${JSON.stringify(targets)}`,
    ).toBeLessThanOrEqual(budget);

    const blocking = results.violations
      .filter((violation) => violation.id !== 'button-name')
      .filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      )
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
      }));
    expect(blocking, 'лист: axe serious/critical').toEqual([]);
  });
});

test.describe('axe: русская локаль', { tag: '@fast' }, () => {
  test('dashboard (ru): нет serious/critical', async ({ page, context }) => {
    await prepare(context, { language: 'ru' });
    await openApp(page, '/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const blocking = results.violations
      .filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      )
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
      }));
    expect(blocking, '/ (ru): axe serious/critical').toEqual([]);
  });
});
