import { describe, expect, it } from 'vitest';

import { dh2History } from '@/games/dh2/history';
import { formatHistoryValue, resolveHistoryLabel } from '@/lib/history-labels';
import type { HistoryChange } from '@/lib/history-types';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH2 HISTORY LABELS TESTS ──────────────────────────────────
 * История 2e показывает подписи, а не пути и коды: точная карта плагина
 * важнее человекочитаемого пути, элемент коллекции собирается как
 * «Коллекция · Элемент · Поле», а доменные коды (мир, фон, пророчество,
 * аптитюды, элитные продвижения) переводятся через `formatValue`.
 *
 * Проверки 2e живут рядом с редакцией: свой словарь и своя карта
 * истории проверяются здесь, dh1 в файле не упоминается. Общие проверки
 * (карта важнее пути, коллекция, человекочитаемый fallback, даты) остались в
 * `tests/unit/history-labels.test.ts`.
 */

function t(key: string): string {
  return key;
}

const tRu = (key: string) => translations.ru[key] ?? key;

describe('history labels: DH2', () => {
  it('подписывает вложенные пути DH точной картой плагина', () => {
    const tKey = (key: string) => key;
    expect(
      resolveHistoryLabel(
        {
          kind: 'changed',
          path: 'aptitudes.profile',
          before: { value: [] },
          after: { value: ['toughness'] },
        },
        dh2History,
        tKey,
      ),
    ).toBe('dh2.aptitudes');
  });

  it('подписывает элементы состояний коллекцией и полями', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'conditions',
      key: 'c1',
      label: 'Bleeding',
      field: 'severity',
      before: { value: 1 },
      after: { value: 2 },
    };

    expect(resolveHistoryLabel(change, dh2History, t)).toBe(
      'dh2.conditions.title · Bleeding · dh2.conditions.severity',
    );
  });
});

describe('history: подписи и значения DH2', () => {
  it('переводит коды DH2, включая массивы и объекты', () => {
    const label = (key: string) => translations.ru[key];
    expect(
      formatHistoryValue(
        { value: 'hive-world' },
        { config: dh2History, path: 'homeWorld', t: tRu },
      ),
    ).toBe(label('dh2.catalog.world.hive-world'));
    expect(
      formatHistoryValue(
        { value: 'adeptus-arbites' },
        { config: dh2History, path: 'background', t: tRu },
      ),
    ).toBe(label('dh2.catalog.background.adeptus-arbites'));
    expect(
      formatHistoryValue(
        { value: 'd100-10' },
        { config: dh2History, path: 'divination', t: tRu },
      ),
    ).toBe(label('dh2.catalog.divination.d100-10'));
    expect(
      formatHistoryValue(
        { value: ['perception', 'toughness'] },
        { config: dh2History, path: 'aptitudes.profile', t: tRu },
      ),
    ).toBe(
      `${label('dh2.catalog.aptitude.perception')}, ${label('dh2.catalog.aptitude.toughness')}`,
    );
    expect(
      formatHistoryValue(
        { value: ['psyker'] },
        { config: dh2History, path: 'eliteAdvances', t: tRu },
      ),
    ).toBe(label('dh2.catalog.elite.psyker'));
    expect(
      formatHistoryValue(
        { value: 'iron-jaw' },
        { config: dh2History, path: 'startingChoices.roleTalent', t: tRu },
      ),
    ).toBe(label('dh2.catalog.talent.iron-jaw'));
    expect(
      formatHistoryValue(
        { value: ['inquiry'] },
        { config: dh2History, path: 'startingChoices.skills', t: tRu },
      ),
    ).toBe(label('dh2.catalog.skill.inquiry'));
    expect(
      formatHistoryValue(
        { value: { background: 'offence' } },
        { config: dh2History, path: 'aptitudes.chosen', t: tRu },
      ),
    ).toBe(label('dh2.catalog.aptitude.offence'));
    expect(
      formatHistoryValue(
        { value: [true, false, false, false, false] },
        { config: dh2History, path: 'statUpgrades.influence', t: tRu },
      ),
    ).toBe('1/5');
  });

  it('переводит общие коды задач, инвентаря и булевы', () => {
    expect(
      formatHistoryValue(
        { value: 'active' },
        { config: dh2History, path: 'questLog.status', t: tRu },
      ),
    ).toBe(tRu('common.questActive'));
    expect(
      formatHistoryValue(
        { value: 'completed' },
        { config: dh2History, path: 'questLog.status', t: tRu },
      ),
    ).toBe(tRu('common.questDone'));
    expect(
      formatHistoryValue(
        { value: 'lost' },
        { config: dh2History, path: 'inventory.status', t: tRu },
      ),
    ).toBe(tRu('dh2.itemStatusLost'));
    expect(
      formatHistoryValue(
        { value: 'default' },
        { config: dh2History, path: 'inventory.status', t: tRu },
      ),
    ).toBe(tRu('dh2.itemStatusDefault'));
    expect(
      formatHistoryValue(
        { value: true },
        {
          config: dh2History,
          path: 'equipment.weapons.melee.equipped',
          t: tRu,
        },
      ),
    ).toBe(tRu('dh2.historyYes'));
    expect(
      formatHistoryValue(
        { value: ['A', 'B'] },
        { path: 'personalityTraits', t: tRu },
      ),
    ).toBe('A, B');
    expect(
      formatHistoryValue(
        { value: { text: 'Find the relic', completed: true } },
        { path: 'questLog.objectives', t: tRu },
      ),
    ).toBe('✓ Find the relic');
    expect(
      resolveHistoryLabel(
        {
          kind: 'added',
          path: 'equipment.weapons.melee',
          key: 'm1',
          label: 'Chainsword',
        },
        dh2History,
        tRu,
      ),
    ).toBe(`${tRu('dh2.meleeWeapons')} · Chainsword`);
  });
});
