import { describe, expect, it } from 'vitest';

import type { GeneratedPluginRegistration } from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';

/**
 * ─── LANDMARK: DERIVE CONFORMANCE ─────────────────────────────────────────
 * Контракт пересчёта производных проверяется на всех обнаруженных плагинах, а
 * не на списке игр в тесте: новый плагин с `derive` попадает сюда сам.
 *
 * Инварианты (D11/D14):
 *   • функция не мутирует вход (вход заморожен — запись бросит TypeError);
 *   • идемпотентна: `derive(derive(d))` совпадает с `derive(d)`;
 *   • не меняет `schemaVersion` и состав полей верхнего уровня;
 *   • не зависит от порядка ключей;
 *   • результат проходит схему плагина;
 *   • каждое поле из `manifest.derived` существует в документе.
 */

type Derive = (doc: any) => any;

const plugins = gamePlugins as readonly GeneratedPluginRegistration[];

function withDerive(): {
  plugin: GeneratedPluginRegistration;
  derive: Derive;
}[] {
  return plugins
    .filter((plugin) => typeof plugin.derive === 'function')
    .map((plugin) => ({ plugin, derive: plugin.derive as Derive }));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/** Стабильная сериализация: порядок ключей не влияет на сравнение. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Тот же документ, но ключи объектов в обратном порядке. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    const reversed: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    ).reverse()) {
      reversed[key] = reverseKeys(child);
    }
    return reversed;
  }
  return value;
}

function demo(plugin: GeneratedPluginRegistration): Record<string, unknown> {
  return {
    id: `${plugin.manifest.id}-derive-demo`,
    ...plugin.module.createDemo(),
  };
}

/** Значения по пути манифеста: `skills[].value` разворачивается в массив. */
function resolvePath(doc: unknown, path: string): unknown[] {
  const [head, ...rest] = path.split('.');
  const isArray = head.endsWith('[]');
  const key = isArray ? head.slice(0, -2) : head;
  const value = (doc as Record<string, unknown>)?.[key];
  // Необязательные поля (`spellcastingEntries`, `spellSaveDifficulty`)
  // отсутствуют в свежем листе — путь объявлен, но проверять нечего.
  if (value === undefined) return [];
  if (isArray) {
    expect(Array.isArray(value), `${path}: ${key} не массив`).toBe(true);
    // Пустой массив — тоже существующее поле: у свежего листа может не быть ни
    // одного спасброска, но путь от этого не перестаёт быть объявленным.
    const items = value as unknown[];
    if (rest.length === 0) return items;
    return items.flatMap((item) => resolvePath(item, rest.join('.')));
  }
  if (rest.length === 0) return [value];
  return resolvePath(value, rest.join('.'));
}

describe('derive: манифест и реестр', () => {
  it('dnd5e объявляет derive и перечисляет производные поля', () => {
    const entry = plugins.find((plugin) => plugin.manifest.id === 'dnd5e');
    expect(entry?.derive).toBeTypeOf('function');
    expect(entry?.manifest.derived?.length ?? 0).toBeGreaterThan(0);
    expect(entry?.manifest.derived).toContain('proficiencyBonus');
    expect(entry?.manifest.derived).toContain('savingThrows[].value');
    expect(entry?.manifest.derived).toContain('skills[].value');
  });

  it('derive есть ровно у тех плагинов, что объявили его в манифесте', () => {
    for (const plugin of plugins) {
      const declared = plugin.manifest.derive !== undefined;
      expect(typeof plugin.derive === 'function', plugin.manifest.id).toBe(
        declared,
      );
    }
  });
});

describe('derive: инварианты', () => {
  for (const { plugin, derive } of withDerive()) {
    const id = plugin.manifest.id;

    it(`${id}: не мутирует вход`, () => {
      const input = demo(plugin);
      const snapshot = canonical(input);
      derive(deepFreeze(structuredClone(input)));
      expect(canonical(input)).toBe(snapshot);
    });

    it(`${id}: идемпотентна`, () => {
      const once = derive(demo(plugin));
      const twice = derive(derive(demo(plugin)));
      expect(canonical(twice)).toBe(canonical(once));
    });

    it(`${id}: не меняет schemaVersion и состав полей верхнего уровня`, () => {
      const input = demo(plugin);
      const output = derive(input);
      expect(output.schemaVersion).toBe(input.schemaVersion);
      expect(Object.keys(output).sort()).toEqual(Object.keys(input).sort());
    });

    it(`${id}: не зависит от порядка ключей`, () => {
      const input = demo(plugin);
      const straight = derive(input);
      const reversed = derive(reverseKeys(input));
      expect(canonical(reversed)).toBe(canonical(straight));
    });

    it(`${id}: результат проходит схему плагина`, () => {
      const output = derive(demo(plugin));
      expect(() => plugin.module.schema.parse(output)).not.toThrow();
    });

    it(`${id}: объявленные производные поля существуют в документе`, () => {
      const output = derive(demo(plugin));
      for (const path of plugin.manifest.derived ?? []) {
        expect(() => resolvePath(output, path), path).not.toThrow();
      }
    });
  }
});

describe('derive: dnd5e считает по правилам 5e', () => {
  const plugin = plugins.find((item) => item.manifest.id === 'dnd5e')!;
  const derive = plugin.derive as Derive;

  function dnd(overrides: Record<string, unknown> = {}) {
    return {
      ...demo(plugin),
      level: 1,
      proficiencyBonus: 2,
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      savingThrows: [
        { name: 'Strength', proficient: false, value: 0 },
        { name: 'Dexterity', proficient: true, value: 0 },
      ],
      skills: [
        {
          name: 'athletics',
          label: 'Athletics (Str)',
          proficient: false,
          expertise: false,
          value: 0,
        },
        {
          name: 'stealth',
          label: 'Stealth (Dex)',
          proficient: true,
          expertise: true,
          value: 0,
          manualModifier: 1,
        },
      ],
      ...overrides,
    };
  }

  it('бонус мастерства растёт с уровнем', () => {
    expect(derive(dnd({ level: 1 })).proficiencyBonus).toBe(2);
    expect(derive(dnd({ level: 4 })).proficiencyBonus).toBe(2);
    expect(derive(dnd({ level: 5 })).proficiencyBonus).toBe(3);
    expect(derive(dnd({ level: 9 })).proficiencyBonus).toBe(4);
    expect(derive(dnd({ level: 17 })).proficiencyBonus).toBe(6);
    expect(derive(dnd({ level: 20 })).proficiencyBonus).toBe(6);
  });

  it('мусорный бонус мастерства заменяется вычисленным', () => {
    expect(
      derive(dnd({ level: 5, proficiencyBonus: 99 })).proficiencyBonus,
    ).toBe(3);
  });

  it('спасбросок = мод характеристики + мастерство', () => {
    const output = derive(
      dnd({
        level: 5,
        stats: {
          strength: 20,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
      }),
    );
    const byName = Object.fromEntries(
      output.savingThrows.map((save: { name: string; value: number }) => [
        save.name,
        save.value,
      ]),
    );
    expect(byName.Strength).toBe(5);
    expect(byName.Dexterity).toBe(3);
  });

  it('навык учитывает мастерство, экспертизу и ручную поправку', () => {
    const output = derive(dnd({ level: 5 }));
    const byName = Object.fromEntries(
      output.skills.map((skill: { name: string; value: number }) => [
        skill.name,
        skill.value,
      ]),
    );
    // Мод +0, без мастерства.
    expect(byName.athletics).toBe(0);
    // Мод +0, мастерство +3, экспертиза +3, ручная поправка +1.
    expect(byName.stealth).toBe(7);
  });

  it('DC спасения от заклинаний считается из характеристики', () => {
    const output = derive(
      dnd({
        level: 5,
        spellcastingAbility: 'intelligence',
        spellSaveDifficulty: 8,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 18,
          wisdom: 10,
          charisma: 10,
        },
      }),
    );
    expect(output.spellSaveDifficulty).toBe(8 + 3 + 4);
  });

  it('ручные поля не трогает', () => {
    const input = dnd({ armorClass: 19, speed: 25, spellAttackBonus: '+9' });
    const output = derive(input);
    expect(output.armorClass).toBe(19);
    expect(output.speed).toBe(25);
    expect(output.spellAttackBonus).toBe('+9');
  });
});
