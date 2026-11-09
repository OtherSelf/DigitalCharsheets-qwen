import { describe, expect, it } from 'vitest';

import {
  CAREER_KEYS,
  DIVINATIONS,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  QUIRKS_BY_HOMEWORLD,
  VARIANT_KEYS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from '@/lib/dark-heresy-data';
import { AdvancedPathsByCareer, RanksByCareer } from '@/lib/dark-heresy-ranks';
import { translations } from '@/lib/translations';
import { DarkHeresyCareerPaths, DarkHeresyHomeWorlds } from '@/lib/types';

/**
 * Сверка справочных данных Dark Heresy с базовой книгой правил
 * (rus.1.7, файл books/Базовая Книга Правил ... .pdf).
 *
 * Здесь зафиксированы факты из книги, чтобы регрессии в данных приложения
 * (пропавший родной мир, перепутанный эффект пророчества, лишний вариант
 * мира) падали тестом, а не обнаруживались вручную на листе персонажа.
 *
 * Источники (номера страниц — по колонцифре книги):
 *   • родные миры — Таблица 1-1, стр. 10;
 *   • приметы — Таблица 1-13, стр. 58;
 *   • «прошлое» (табу/касты/планеты/традиции) — Таблицы 1-14…1-17, стр. 58–60;
 *   • пророчества — Таблица 1-18, стр. 60–61;
 *   • профессии — Таблица 2-1, стр. 66 (Сороритас — опциональная, вне
 *     стандартной генерации, поэтому в списке профессий её нет).
 */

const CORE_HOME_WORLDS = [
  'Feral World',
  'Hive World',
  'Imperial World',
  'Void Born',
  'Forge World',
] as const;

const CORE_CAREERS = [
  'Adept',
  'Arbitrator',
  'Assassin',
  'Cleric',
  'Guardsman',
  'Imperial Psyker',
  'Scum',
  'Tech-Priest',
] as const;

const t = (lang: 'en' | 'ru', key: string) => translations[lang][key];

function expectTranslation(key: string, label: string) {
  for (const lang of ['en', 'ru'] as const) {
    const value = t(lang, key);
    expect(value, `${label}: нет перевода «${key}» (${lang})`).toBeTruthy();
    expect(
      value.trim().length,
      `${label}: пустой перевод «${key}»`,
    ).toBeGreaterThan(0);
  }
}

describe('Dark Heresy: справочные данные против базовой книги', () => {
  it('содержит все пять родных миров из Таблицы 1-1', () => {
    expect([...DarkHeresyHomeWorlds].sort()).toEqual(
      [...CORE_HOME_WORLDS].sort(),
    );
  });

  it('содержит все восемь профессий стандартной генерации (Таблица 2-1)', () => {
    expect([...DarkHeresyCareerPaths].sort()).toEqual([...CORE_CAREERS].sort());
  });

  it('у каждого родного мира есть ключ и перевод', () => {
    for (const world of DarkHeresyHomeWorlds) {
      const key = HOME_WORLD_KEYS[world];
      expect(key, `родной мир «${world}» без HOME_WORLD_KEYS`).toBeTruthy();
      expectTranslation(key, world);
    }
  });

  it('у каждой профессии есть ключ и перевод', () => {
    for (const career of DarkHeresyCareerPaths) {
      const key = CAREER_KEYS[career];
      expect(key, `профессия «${career}» без CAREER_KEYS`).toBeTruthy();
      expectTranslation(key, career);
    }
  });

  it('в Таблице 1-18 ровно 28 пророчеств, у каждого есть эффект', () => {
    expect(DIVINATIONS).toHaveLength(28);
    for (const { divination, effect } of DIVINATIONS) {
      expect(divination.trim(), 'пустое пророчество').toBeTruthy();
      expect(
        effect.trim(),
        `пророчество без эффекта: ${divination}`,
      ).toBeTruthy();
    }
  });

  it('тексты пророчеств и эффектов переведены на оба языка', () => {
    for (const { divination, effect } of DIVINATIONS) {
      expectTranslation(divination, 'пророчество');
      expectTranslation(effect, 'эффект пророчества');
    }
  });

  it('эффекты пророчеств совпадают с книгой', () => {
    // Ключевые строки Таблицы 1-18 (стр. 60–61).
    expect(
      DIVINATIONS.find(
        (d) => d.divination === 'Dark dreams lie upon the heart.',
      )?.effect,
    ).toBe('+2 Insanity Points.');
    expect(
      DIVINATIONS.find(
        (d) => d.divination === 'Sins hidden in the heart turn all to decay.',
      )?.effect,
    ).toBe('+3 Corruption Points.');
    expect(
      DIVINATIONS.find(
        (d) => d.divination === 'There is no substitute for zeal.',
      )?.effect,
    ).toBe('+2 Toughness, +2 Willpower.');
    expect(
      DIVINATIONS.find(
        (d) =>
          d.divination ===
          'Be a boon to your brothers and bane to your enemies.',
      )?.effect,
    ).toBe('+3 Fellowship.');
  });

  it('варианты «прошлого» совпадают по количеству с Таблицами 1-14…1-17', () => {
    // Дикий Мир — 10, Мир-улей — 6, Имперский Мир — 7, Рождённый в Пустоте — 4.
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Feral World']).toHaveLength(10);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Hive World']).toHaveLength(6);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Imperial World']).toHaveLength(7);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Void Born']).toHaveLength(4);
    // У Мира-кузницы в базовой книге таблицы «Прошлого» нет.
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Forge World']).toEqual([]);
  });

  it('у каждого варианта мира есть ключ и перевод', () => {
    for (const [world, variants] of Object.entries(
      WORLD_VARIANTS_BY_HOMEWORLD,
    )) {
      for (const variant of variants) {
        const key = VARIANT_KEYS[variant];
        expect(
          key,
          `вариант «${variant}» (${world}) без VARIANT_KEYS`,
        ).toBeTruthy();
        expectTranslation(key, variant);
      }
    }
  });

  it('у каждого из четырёх миров Таблицы 1-13 по 16 примет', () => {
    const quirkWorlds = [
      'Feral World',
      'Hive World',
      'Imperial World',
      'Void Born',
    ];
    for (const world of quirkWorlds) {
      expect(
        QUIRKS_BY_HOMEWORLD[world],
        `нет примет для «${world}»`,
      ).toHaveLength(16);
    }
    // У Мира-кузницы таблицы примет в базовой книге нет.
    expect(QUIRKS_BY_HOMEWORLD['Forge World']).toEqual([]);
  });

  it('у каждой приметы есть ключ и перевод', () => {
    for (const [world, quirks] of Object.entries(QUIRKS_BY_HOMEWORLD)) {
      for (const quirk of quirks) {
        const key = QUIRK_KEYS[quirk];
        expect(
          key,
          `примета «${quirk}» (${world}) без QUIRK_KEYS`,
        ).toBeTruthy();
        expectTranslation(key, quirk);
      }
    }
  });

  it('ранг 5 Убийцы начинается с 3000 ОО (как в книге, а не с 3500)', () => {
    const assassin = RanksByCareer.Assassin.standard.find(
      (rank) => rank.name === 'Assassin',
    );
    expect(assassin?.expThreshold).toBe(3000);
  });

  it('у Техножреца 5-й ранг «Техножрец» уже на 3000 ОО (стр. 114)', () => {
    const standard = RanksByCareer['Tech-Priest'].standard;
    expect(standard.map((rank) => rank.expThreshold)).toEqual([
      0, 500, 1000, 2000, 3000,
    ]);
    expect(standard.at(-1)?.name).toBe('Tech-Priest');
    // Продвинутые ветви (Техномант / Технодьякон) начинаются с 6000 ОО.
    expect(
      AdvancedPathsByCareer['Tech-Priest']?.pathA.ranks[0].expThreshold,
    ).toBe(6000);
    expect(
      AdvancedPathsByCareer['Tech-Priest']?.pathB.ranks[0].expThreshold,
    ).toBe(6000);
  });
});
