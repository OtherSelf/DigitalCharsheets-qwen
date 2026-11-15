import { describe, expect, it } from 'vitest';

import {
  ALL_QUIRKS,
  CAREER_KEYS,
  DIVINATIONS,
  getQuirksForHomeWorld,
  HOME_WORLD_KEYS,
  QUIRK_KEYS,
  QUIRKS_BY_HOMEWORLD,
  STARTING_EXPERIENCE,
  STARTING_WEALTH,
  VARIANT_KEYS,
  WORLD_FEATURES,
  WORLD_STARTING_PROFILE,
  WORLD_VARIANT_LABELS,
  WORLD_VARIANTS_BY_HOMEWORLD,
} from '@/games/dh1/dark-heresy-data';
import {
  AdvancedPathsByCareer,
  RanksByCareer,
} from '@/games/dh1/dark-heresy-ranks';
import {
  divinationEffectKey,
  divinationKey,
} from '@/games/dh1/divination-i18n';
import { DarkHeresyCareerPaths, DarkHeresyHomeWorlds } from '@/games/dh1/types';
import { translations } from '@/lib/i18n';

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
 *   • «прошлое» (табу/касты/планеты/традиции) — Таблицы 1-14…1-17, стр. 58–60,
 *     для Мира-кузницы — Таблица И-1-2 «Место Рождения», стр. 27;
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
  'Schola Progenium',
  'Noble Born',
  'Mind-Cleared',
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
  // Ключи DH1 проверяются как есть: у dh1 есть собственные данные
  // (миры «Книги Инквизитора», особенности), которых нет в dh2.
  for (const lang of ['en', 'ru'] as const) {
    const value = t(lang, key);
    expect(value, `${label}: нет перевода «${key}» (${lang})`).toBeTruthy();
    expect(
      value.trim().length,
      `${label}: пустой перевод «${key}» (${lang})`,
    ).toBeGreaterThan(0);
  }
}

describe('Dark Heresy: справочные данные против базовой книги', () => {
  it('содержит все восемь родных миров из Таблицы 1-1', () => {
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

  it('в Таблице 1-18 ровно 28 пророчеств, у каждого есть стабильный id и эффект', () => {
    expect(DIVINATIONS).toHaveLength(28);
    const ids = new Set<string>();
    for (const { id, divination, effectId, effect } of DIVINATIONS) {
      expect(id.trim(), 'пустой id пророчества').toBeTruthy();
      expect(ids.has(id), `дубль id пророчества: ${id}`).toBe(false);
      ids.add(id);
      expect(divination.trim(), 'пустое пророчество').toBeTruthy();
      expect(effectId.trim(), `эффект без id: ${divination}`).toBeTruthy();
      expect(
        effect.trim(),
        `пророчество без эффекта: ${divination}`,
      ).toBeTruthy();
    }
  });

  it('тексты пророчеств и эффектов переведены на оба языка', () => {
    for (const { id, effectId } of DIVINATIONS) {
      expectTranslation(divinationKey(id), 'пророчество');
      expectTranslation(divinationEffectKey(effectId), 'эффект пророчества');
    }
  });

  it('эффекты пророчеств совпадают с книгой', () => {
    // Ключевые строки Таблицы 1-18 (стр. 60–61).
    expect(
      DIVINATIONS.find(
        (d) => d.divination === '',
      )?.effect,
    ).toBe('+2 Insanity Points.');
    expect(
      DIVINATIONS.find(
        (d) => d.divination === '',
      )?.effect,
    ).toBe('+3 Corruption Points.');
    expect(
      DIVINATIONS.find(
        (d) => d.divination === '',
      )?.effect,
    ).toBe('+2 Toughness, +2 Willpower.');
    expect(
      DIVINATIONS.find(
        (d) =>
          d.divination ===
          '',
      )?.effect,
    ).toBe('+3 Fellowship.');
  });

  it('варианты «прошлого» совпадают по количеству с Таблицами 1-14…1-17 и И-1-2…И-1-5', () => {
    // Дикий Мир — 10, Мир-улей — 6, Имперский Мир — 7, Рождённый в Пустоте — 4.
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Feral World']).toHaveLength(10);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Hive World']).toHaveLength(6);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Imperial World']).toHaveLength(7);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Void Born']).toHaveLength(4);
    // Мир-кузница — 6 мест рождения из Таблицы И-1-2 (стр. 27).
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Forge World']).toEqual([
      'Great Forge World',
      'Minor Forge World',
      'Orbit',
      'Territory',
      'Research Outpost',
      'Explorator Fleet',
    ]);
    // «Книга Инквизитора»: аристократ — 8 путей, схола — 7 судеб, очищенный — 9 осколков.
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Noble Born']).toHaveLength(8);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Schola Progenium']).toHaveLength(7);
    expect(WORLD_VARIANTS_BY_HOMEWORLD['Mind-Cleared']).toHaveLength(9);
  });

  it('у каждого мира есть заголовок таблицы «Прошлого»', () => {
    for (const world of DarkHeresyHomeWorlds) {
      const key = WORLD_VARIANT_LABELS[world];
      expect(key, `мир «${world}» без WORLD_VARIANT_LABELS`).toBeTruthy();
      expectTranslation(key, world);
    }
  });

  it('стартовые таблицы: профиль 8 миров, богатство 8 профессий, опыт 400', () => {
    expect(STARTING_EXPERIENCE).toBe(400);
    expect(Object.keys(STARTING_WEALTH).sort()).toEqual(
      [...DarkHeresyCareerPaths].sort(),
    );
    for (const world of DarkHeresyHomeWorlds) {
      const profile = WORLD_STARTING_PROFILE[world];
      expect(profile, `нет стартового профиля для «${world}»`).toBeTruthy();
      expect(Object.keys(profile.characteristics)).toHaveLength(9);
      expect(profile.wounds).toMatch(/^1d5\+\d+$/);
      expect(profile.fate.trim()).toBeTruthy();
    }
  });

  it('особенности миров: 3–4 на мир, у каждой есть имя, механика и перевод', () => {
    for (const world of DarkHeresyHomeWorlds) {
      const features = WORLD_FEATURES[world];
      expect(features, `нет особенностей для «${world}»`).toBeTruthy();
      expect(features.length).toBeGreaterThanOrEqual(3);
      for (const feature of features) {
        expect(feature.name.trim()).toBeTruthy();
        expectTranslation(feature.labelKey, feature.name);
        expectTranslation(feature.effectKey, `${feature.name} (механика)`);
      }
    }
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

  it('без своей таблицы примет отдаётся общий список (Мир-кузница)', () => {
    expect(getQuirksForHomeWorld('Forge World')).toEqual(ALL_QUIRKS);
  });

  it('хелпер примет не мутирует исходные списки', () => {
    const before = [...QUIRKS_BY_HOMEWORLD['Feral World']];
    expect(getQuirksForHomeWorld('Feral World')).toHaveLength(16);
    expect(QUIRKS_BY_HOMEWORLD['Feral World']).toEqual(before);
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
