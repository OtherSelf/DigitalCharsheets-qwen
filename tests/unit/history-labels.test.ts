import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dh1History } from '@/games/dh1/history';
import { dh2History } from '@/games/dh2/history';
import { listGameModules } from '@/games/registry';
import type { GameHistoryConfig } from '@/games/types';
import { diffCharacterRecords } from '@/lib/history-diff';
import {
  formatHistoryDate,
  formatHistoryValue,
  HISTORY_SHARED_KEYS,
  humanizeHistoryPath,
  resolveHistoryLabel,
} from '@/lib/history-labels';
import type { HistoryChange } from '@/lib/history-types';
import { translations } from '@/lib/i18n';

function t(key: string): string {
  return key;
}

const tRu = (key: string) => translations.ru[key] ?? key;

const IGNORED_FIELDS = new Set([
  'id',
  'userId',
  'systemId',
  'schemaVersion',
  'gameSystem',
  'createdAt',
  'updatedAt',
]);

/** t, который помечает переведённые сегменты: остаток без меток — fallback. */
const marker = (key: string) => `«${key}»`;

function untranslatedPart(label: string): string {
  return label.replace(/«[^»]+»/g, '').replace(/[·\s]/g, '');
}

/** Демо и дефолты покрывают почти все поля листа; пустые массивы пропускаются. */
function historyChecks(mod: {
  createDemo(): unknown;
  createDefaults(): unknown;
}): HistoryChange[] {
  const changes: HistoryChange[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      changes.push({ kind: 'added', path, key: 'k', label: '«item»' });
      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        for (const field of Object.keys(item)) {
          if (IGNORED_FIELDS.has(field) || field.startsWith('__')) continue;
          changes.push({
            kind: 'changed',
            path,
            key: 'k',
            label: '«item»',
            field,
          });
        }
      }
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (IGNORED_FIELDS.has(key) || key.startsWith('__')) continue;
        visit(child, path ? `${path}.${key}` : key);
      }
      return;
    }
    changes.push({ kind: 'changed', path });
  };
  for (const draft of [mod.createDemo(), mod.createDefaults()]) {
    for (const [key, child] of Object.entries(
      draft as Record<string, unknown>,
    )) {
      if (IGNORED_FIELDS.has(key) || key.startsWith('__')) continue;
      visit(child, key);
    }
  }
  return changes;
}

function mutate(value: unknown): unknown {
  if (typeof value === 'string') return value ? `${value} X` : 'X';
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (value === null) return 'X';
  if (Array.isArray(value)) {
    if (value.length === 0) return ['X'];
    if (value.every((item) => item === null || typeof item !== 'object')) {
      return [...value, 'X'];
    }
    return [...value, { ...(value[0] as object), id: 'new-item', name: 'New' }];
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, mutate(child)]),
    );
  }
  return value;
}

describe('history labels', () => {
  it('все ключи подписей плагинов есть в en и ru', () => {
    for (const gameModule of listGameModules()) {
      const config = gameModule.history;
      if (!config) continue;
      const keys = [
        ...Object.values(config.labels ?? {}),
        ...Object.values(config.collections ?? {}),
      ];
      for (const key of keys) {
        expect(
          translations.en[key],
          `${gameModule.id}: en ${key}`,
        ).toBeTruthy();
        expect(
          translations.ru[key],
          `${gameModule.id}: ru ${key}`,
        ).toBeTruthy();
      }
    }
  });

  it('точная карта плагина важнее человекочитаемого пути', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'stats.strength',
      before: { value: 10 },
      after: { value: 12 },
    };

    expect(
      resolveHistoryLabel(
        change,
        {
          labels: { 'stats.strength': 'common.statStrAbbr' },
        },
        t,
      ),
    ).toBe('common.statStrAbbr');
  });

  it('для keyed-элемента собирает коллекцию, подпись и поле', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'inventory',
      key: 'i1',
      label: 'Sword',
      field: 'notes',
      before: { value: '' },
      after: { value: 'sharp' },
    };

    expect(
      resolveHistoryLabel(
        change,
        {
          collections: { inventory: 'common.inventory' },
          labels: { 'inventory.notes': 'common.notes' },
        },
        t,
      ),
    ).toBe('common.inventory · Sword · common.notes');
  });

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

  it('падает в человекочитаемый путь без подписей', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'hitPoints.current',
      before: { value: 1 },
      after: { value: 2 },
    };

    expect(resolveHistoryLabel(change, undefined, t)).toBe(
      'hit points · current',
    );
    expect(humanizeHistoryPath('some_custom_field.deepValue')).toBe(
      'some custom field · deep value',
    );
  });

  it('сводный bulk и значения форматируются предсказуемо', () => {
    expect(
      resolveHistoryLabel({ kind: 'bulk', path: '', count: 10 }, undefined, t),
    ).toBe('history.tooManyChanges');

    expect(formatHistoryValue({ value: 'note' })).toBe('note');
    expect(
      formatHistoryValue({
        truncated: true,
        preview: 'long…',
        length: 1000,
      }),
    ).toBe('long…');
    expect(formatHistoryValue({ value: 42 })).toBe('42');
    expect(formatHistoryValue({ value: null })).toBe('—');
  });

  it('форматирует дату без падения на мусоре', () => {
    expect(formatHistoryDate('2026-05-12T18:04:11.000Z', 'en')).toContain(
      '2026',
    );
    expect(formatHistoryDate('not-a-date', 'ru')).toBe('not-a-date');
  });
});

/**
 * История не должна показывать сырые ключи, коды и JSON: подписи полей
 * переводятся всеми тремя плагинами, значения-коды — через `formatValue`.
 */
describe('history: подписи и значения всех игр', () => {
  it('valueLabels ссылаются на существующие ключи в en и ru', () => {
    for (const mod of listGameModules()) {
      const config = mod.history;
      for (const [path, labels] of Object.entries(config?.valueLabels ?? {})) {
        for (const [code, key] of Object.entries(labels)) {
          expect(
            translations.en[key],
            `${mod.id}: ${path}.${code} (en)`,
          ).toBeTruthy();
          expect(
            translations.ru[key],
            `${mod.id}: ${path}.${code} (ru)`,
          ).toBeTruthy();
        }
      }
    }
  });

  it('у каждого поля демо-листа и элемента коллекции есть перевод', () => {
    for (const mod of listGameModules()) {
      const config = mod.history;
      if (!config) continue;
      const bad: string[] = [];
      for (const change of historyChecks(mod)) {
        const label = resolveHistoryLabel(change, config, marker);
        if (untranslatedPart(label)) {
          bad.push(
            `${change.path}${change.field ? `.${change.field}` : ''} => ${label}`,
          );
        }
      }
      expect([...new Set(bad)], `${mod.id}: непереведённые подписи`).toEqual(
        [],
      );
    }
  });

  it('не показывает сырой JSON, булевы и null на демо-данных', () => {
    for (const mod of listGameModules()) {
      const config = mod.history;
      const before = mod.createDemo() as Record<string, unknown>;
      const after = mutate(before) as Record<string, unknown>;
      const diff = diffCharacterRecords(before, after, { maxChanges: 500 });
      expect(diff, mod.id).toBeTruthy();
      for (const change of diff!.changes) {
        const fieldPath = change.field
          ? `${change.path}.${change.field}`
          : change.path;
        const rendered = [change.before, change.after, ...(change.values ?? [])]
          .filter((value) => value !== undefined)
          .map((value) =>
            formatHistoryValue(value, { config, path: fieldPath, t: tRu }),
          )
          .join(' | ');
        expect(rendered, `${mod.id}: ${fieldPath}`).not.toMatch(
          /[[{]]|\b(true|false|null)\b/,
        );
      }
    }
  });

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

  it('конфиг истории ссылается только на словарь плагина или allowlist', () => {
    for (const mod of listGameModules()) {
      const config = mod.history;
      if (!config) continue;
      const pluginKeys = new Set<string>();
      for (const locale of ['en', 'ru']) {
        const file = path.join(
          process.cwd(),
          'src/games',
          mod.id,
          'i18n',
          `${locale}.json`,
        );
        expect(fs.existsSync(file), `${mod.id}: нет ${file}`).toBe(true);
        for (const key of Object.keys(
          JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>,
        )) {
          pluginKeys.add(key);
        }
      }
      const tokenKeys: string[] = Object.values(config.tokens ?? {}).flatMap(
        (value) => {
          if (typeof value === 'string') return [value];
          if (value && typeof value === 'object') {
            return Object.values(value) as string[];
          }
          return [];
        },
      );
      const referenced: string[] = [
        ...Object.values(config.labels ?? {}),
        ...Object.values(config.collections ?? {}),
        ...Object.values(config.valueLabels ?? {}).flatMap((map) =>
          Object.values(map),
        ),
        ...tokenKeys,
      ];
      const outside = referenced.filter((key) => !pluginKeys.has(key));
      const foreign = outside.filter((key) => !HISTORY_SHARED_KEYS.has(key));
      expect(foreign, `${mod.id}: игровые ключи должны быть в словаре`).toEqual(
        [],
      );
      for (const key of outside) {
        expect(translations.en[key], `${mod.id}: ${key} (en)`).toBeTruthy();
        expect(translations.ru[key], `${mod.id}: ${key} (ru)`).toBeTruthy();
      }
    }
  });
});
