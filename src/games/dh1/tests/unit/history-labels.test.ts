import { describe, expect, it } from 'vitest';

import { dh1History } from '@/games/dh1/history';
import { formatHistoryValue, resolveHistoryLabel } from '@/lib/history-labels';
import type { HistoryChange } from '@/lib/history-types';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 HISTORY LABELS TESTS ──────────────────────────────────
 * История 1e показывает подписи, а не пути и коды: точная карта плагина
 * важнее человекочитаемого пути, элемент коллекции собирается как
 * «Коллекция · Элемент · Поле», а доменные коды (мир, пророчество, пол,
 * тренировка навыка) переводятся через `formatValue`.
 *
 * Проверки 1e живут рядом с редакцией: свой словарь и своя карта
 * истории проверяются здесь, dh2 в файле не упоминается. Общие проверки
 * (карта важнее пути, коллекция, человекочитаемый fallback, даты) остались в
 * `tests/unit/history-labels.test.ts`.
 */

function t(key: string): string {
  return key;
}

const tRu = (key: string) => translations.ru[key] ?? key;

describe('history labels: DH1', () => {
  it('подписывает вложенные пути DH точной картой плагина', () => {
    const tKey = (key: string) => key;
    expect(
      resolveHistoryLabel(
        {
          kind: 'changed',
          path: 'identity.gender',
          before: { value: '' },
          after: { value: 'f' },
        },
        dh1History,
        tKey,
      ),
    ).toBe('dh1.gender');
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

    expect(resolveHistoryLabel(change, dh1History, t)).toBe(
      'dh1.conditions.title · Bleeding · dh1.conditions.severity',
    );
  });

  it('подписывает последний сегмент пути и элемент коллекции', () => {
    const tKey = (key: string) => key;
    expect(
      resolveHistoryLabel(
        {
          kind: 'changed',
          path: 'equipment.armor.Head.ap',
          before: { value: 2 },
          after: { value: 3 },
        },
        dh1History,
        tKey,
      ),
    ).toBe('dh1.equipment.armor · dh1.armorAp');

    expect(
      resolveHistoryLabel(
        {
          kind: 'changed',
          path: 'equipment.armor',
          key: 'Head',
          label: 'Head',
          field: 'ap',
          before: { value: 2 },
          after: { value: 3 },
        },
        dh1History,
        tKey,
      ),
    ).toBe('dh1.equipment.armor · Head · dh1.armorAp');
  });
});

describe('history: подписи и значения DH1', () => {
  it('переводит коды DH1', () => {
    expect(
      formatHistoryValue(
        { value: 'Hive World' },
        { config: dh1History, path: 'homeWorld', t: tRu },
      ),
    ).toBe(translations.ru['dh1.homeWorldHive']);
    expect(
      formatHistoryValue(
        { value: 'painOfBullet' },
        { config: dh1History, path: 'divination', t: tRu },
      ),
    ).toBe(translations.ru['dh1.data.divination.painOfBullet']);
    expect(
      formatHistoryValue(
        { value: 'Common' },
        { config: dh1History, path: 'equipment.armor.Head.quality', t: tRu },
      ),
    ).toBe(translations.ru['dh1.armorQualityCommon']);
    expect(
      formatHistoryValue(
        { value: 'male' },
        { config: dh1History, path: 'identity.gender', t: tRu },
      ),
    ).toBe(translations.ru['dh1.genderMale']);
    expect(
      formatHistoryValue(
        { value: [false, true, false, false] },
        { config: dh1History, path: 'statUpgrades.weaponSkill', t: tRu },
      ),
    ).toBe('1/4');
    expect(
      formatHistoryValue(
        {
          value: { skilled: true, plus10: true, plus20: false, plus30: false },
        },
        { config: dh1History, path: 'skills.training', t: tRu },
      ),
    ).toBe(`${translations.ru['dh1.skilled']}, +10`);
    expect(formatHistoryValue({ value: null })).toBe('—');
  });

  it('переводит общие коды задач, инвентаря и булевы', () => {
    expect(
      formatHistoryValue(
        { value: 'active' },
        { config: dh1History, path: 'questLog.status', t: tRu },
      ),
    ).toBe(tRu('common.questActive'));
    expect(
      formatHistoryValue(
        { value: 'completed' },
        { config: dh1History, path: 'questLog.status', t: tRu },
      ),
    ).toBe(tRu('common.questDone'));
    expect(
      formatHistoryValue(
        { value: 'lost' },
        { config: dh1History, path: 'inventory.status', t: tRu },
      ),
    ).toBe(tRu('dh1.itemStatusLost'));
    expect(
      formatHistoryValue(
        { value: 'default' },
        { config: dh1History, path: 'inventory.status', t: tRu },
      ),
    ).toBe(tRu('dh1.itemStatusDefault'));
    expect(
      formatHistoryValue(
        { value: true },
        {
          config: dh1History,
          path: 'equipment.weapons.melee.equipped',
          t: tRu,
        },
      ),
    ).toBe(tRu('dh1.historyYes'));
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
        dh1History,
        tRu,
      ),
    ).toBe(`${tRu('dh1.meleeWeapons')} · Chainsword`);
  });
});
