import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readJson } from '@tests/support';

/**
 * Статический контроль визуальных тестов.
 *
 * Проверяет то, что нельзя увидеть в браузере:
 *   1. каждый PNG называется по схеме
 *        <страница>-[<игра>]-[<доп. поле>]-<язык>.png
 *      где игра — dnd/dh (только для игровых экранов), язык — en/ru;
 *   2. каждый PNG из __screenshots__ реально используется в спеке;
 *   3. каждый вызов screenshotPage/screenshotElement даёт существующий PNG;
 *   4. покрытие: языки, уникальные секции D&D/DH, режимы чтения и
 *      редактирования, mobile-варианты.
 *
 * Тест не требует браузера и работает в обычном `npm test`.
 */

const ROOT = process.cwd();
const VISUAL_DIR = path.join(ROOT, 'tests', 'visual');
const SHOTS_DIR = path.join(VISUAL_DIR, '__screenshots__');
const PLUGINS_DIR = path.join(ROOT, 'src', 'games');
// Проекты Playwright: host (tests/visual) и плагины (src/games/*/tests/visual).
const PROJECTS = [
  'desktop',
  'mobile',
  'tablet',
  'desktop-games',
  'mobile-games',
] as const;

interface PluginVisualConfig {
  pluginId: string;
  nameSegment: string;
  requiredLangs?: Record<string, Array<'en' | 'ru'>>;
  requiredSections?: Record<string, string[]>;
  requiredEditSections?: Record<string, string[]>;
  requiredRuEditSections?: Record<string, string[]>;
  mobileReadEdit?: boolean;
}

/**
 * Сегмент игры в имени PNG (`sheet-dh-top-en.png`) плагин объявляет сам в
 * `src/games/<id>/tests/visual.json`: списка игр в тесте нет, новая игра
 * добавляет файл и попадает в схему без правок хоста.
 */
const pluginConfigs: PluginVisualConfig[] = fs
  .readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const file = path.join(PLUGINS_DIR, entry.name, 'tests', 'visual.json');
    if (!fs.existsSync(file)) return [];
    return [{ ...readJson<PluginVisualConfig>(file), pluginId: entry.name }];
  });

const GAMES = new Set(pluginConfigs.map((config) => config.nameSegment));
const GAME_ALTERNATION = [...GAMES].join('|');

const NAME_RE = new RegExp(
  `^[a-z0-9]+(?:-(?:${GAME_ALTERNATION}))?(?:-[a-z0-9]+)*-(en|ru)\\.png$`,
);
const LANGS = new Set(['en', 'ru']);

interface ParsedName {
  name: string;
  page: string;
  game?: string;
  extras: string[];
  extraText: string;
  lang: 'en' | 'ru';
}

// Страницы могут содержать дефис (stats-editor), поэтому берём самый
// длинный известный префикс, а не первый токен.
const PAGE_PREFIXES = [
  'stats-editor',
  'dashboard',
  'settings',
  'login',
  'demo',
  'new',
  'sheet',
  'dialog',
  'history',
].sort((a, b) => b.length - a.length);

function parseName(name: string): ParsedName {
  const base = name.replace(/\.png$/, '');
  const page =
    PAGE_PREFIXES.find(
      (prefix) => base === prefix || base.startsWith(`${prefix}-`),
    ) ?? base.split('-')[0];
  const rest = base === page ? [] : base.slice(page.length + 1).split('-');
  const game = GAMES.has(rest[0]) ? rest[0] : undefined;
  const lang = rest[rest.length - 1] as 'en' | 'ru';
  const extras = rest.slice(game ? 1 : 0, -1);
  return { name, page, game, extras, extraText: extras.join('-'), lang };
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function specFiles(): string[] {
  const host = fs
    .readdirSync(VISUAL_DIR)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => path.join(VISUAL_DIR, name));
  const plugins = fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(PLUGINS_DIR, entry.name, 'tests', 'visual');
      if (!fs.existsSync(dir)) return [];
      return walk(dir).filter((file) => file.endsWith('.visual.spec.ts'));
    });
  return [...host, ...plugins];
}

function readSpecNames(): string[] {
  const specFilesList = specFiles();

  const names: string[] = [];
  for (const file of specFilesList) {
    const source = fs.readFileSync(file, 'utf8');
    // Имена встречаются и прямо в вызове, и в массивах вида
    // [['sheet-dnd-info-ru.png', '#character-info-card'], ...].
    const nameRe = /'([a-z0-9-]+\.png)'/g;
    for (const match of source.matchAll(nameRe)) names.push(match[1]);
  }
  return names;
}

const referenced = readSpecNames();
const parsed = referenced.map(parseName);

const pngs = PROJECTS.flatMap((project) =>
  walk(path.join(SHOTS_DIR, project))
    .filter((file) => file.endsWith('.png'))
    .map((file) => path.basename(file)),
);

const keys = new Map<string, ParsedName[]>();
for (const item of parsed) {
  const key = item.game ? `${item.page}:${item.game}` : item.page;
  const list = keys.get(key) ?? [];
  list.push(item);
  keys.set(key, list);
}

describe('визуальные тесты: имена эталонов', () => {
  it('все PNG соответствуют схеме <страница>-[игра]-[поле]-<язык>.png', () => {
    const bad = pngs.filter((name) => !NAME_RE.test(name));
    expect(bad, 'файлы с неверным именем').toEqual([]);
  });

  it('игровые экраны содержат dnd/dh сразу после страницы', () => {
    const gamePages = new Set(['sheet', 'dialog']);
    for (const item of parsed) {
      if (gamePages.has(item.page)) {
        expect(item.game, `${item.name}: не указана игра`).toBeTruthy();
      }
      expect(LANGS.has(item.lang), `${item.name}: язык не en/ru`).toBe(true);
    }
  });

  it('каждый PNG из __screenshots__ используется в спеке', () => {
    const referencedSet = new Set(referenced);
    const orphans = pngs.filter((name) => !referencedSet.has(name));
    expect(orphans, 'эталоны без теста').toEqual([]);
  });

  it('каждый скриншот в спеке имеет эталон', () => {
    const pngSet = new Set(pngs);
    const missing = referenced.filter((name) => !pngSet.has(name));
    expect(missing, 'тест без эталона (запустите --update-snapshots)').toEqual(
      [],
    );
  });

  it('нет дублей имён в одном проекте', () => {
    for (const project of PROJECTS) {
      const files = walk(path.join(SHOTS_DIR, project))
        .filter((file) => file.endsWith('.png'))
        .map((file) => path.basename(file));
      const dupes = files.filter(
        (name, index) => files.indexOf(name) !== index,
      );
      expect(dupes, `дубли в ${project}`).toEqual([]);
    }
  });
});

// ── Матрица обязательного покрытия ─────────────────────────────────────────
// Хостовые экраны (не принадлежат ни одной игре) — часть контракта хоста.
const HOST_REQUIRED_LANGS: Record<string, Array<'en' | 'ru'>> = {
  login: ['en', 'ru'],
  dashboard: ['en', 'ru'],
  // `/` и `/demo` — один DemoLanding; лендинг снимается как dashboard-guest.
  settings: ['en', 'ru'],
  new: ['en', 'ru'],
  'stats-editor': ['en', 'ru'],
};

type Lang = 'en' | 'ru';
const REQUIRED_LANGS: Record<string, Lang[]> = { ...HOST_REQUIRED_LANGS };
const REQUIRED_SECTIONS: Record<string, string[]> = {};
const REQUIRED_EDIT_SECTIONS: Record<string, string[]> = {};
const REQUIRED_RU_EDIT_SECTIONS: Record<string, string[]> = {};
const MOBILE_READ_EDIT: string[] = [];

function mergeRequirements(
  target: Record<string, string[]>,
  source: Record<string, string[]> | undefined,
  segment: string,
) {
  for (const [page, values] of Object.entries(source ?? {})) {
    target[`${page}:${segment}`] = values;
  }
}

// Требования к секциям и языкам игра объявляет сама в
// src/games/<id>/tests/visual.json; две редакции с одним сегментом (dh1/dh2)
// делят матрицу — это одна игра-семейство.
for (const config of pluginConfigs) {
  for (const [page, langs] of Object.entries(config.requiredLangs ?? {})) {
    REQUIRED_LANGS[`${page}:${config.nameSegment}`] = langs;
  }
  mergeRequirements(
    REQUIRED_SECTIONS,
    config.requiredSections,
    config.nameSegment,
  );
  mergeRequirements(
    REQUIRED_EDIT_SECTIONS,
    config.requiredEditSections,
    config.nameSegment,
  );
  mergeRequirements(
    REQUIRED_RU_EDIT_SECTIONS,
    config.requiredRuEditSections,
    config.nameSegment,
  );
  if (config.mobileReadEdit) {
    MOBILE_READ_EDIT.push(`sheet:${config.nameSegment}`);
  }
}

describe('визуальные тесты: покрытие', () => {
  it('для каждого экрана есть все обязательные языки', () => {
    for (const [key, langs] of Object.entries(REQUIRED_LANGS)) {
      const items = keys.get(key) ?? [];
      for (const lang of langs) {
        expect(
          items.some((item) => item.lang === lang),
          `${key}: нет скриншота на "${lang}"`,
        ).toBe(true);
      }
    }
  });

  it('все уникальные секции D&D и DH покрыты', () => {
    for (const [key, sections] of Object.entries(REQUIRED_SECTIONS)) {
      const items = keys.get(key) ?? [];
      for (const section of sections) {
        expect(
          items.some((item) => item.extraText.includes(section)),
          `${key}: нет секции "${section}"`,
        ).toBe(true);
      }
    }
  });

  it('все секции покрыты в режиме редактирования', () => {
    for (const [key, sections] of Object.entries(REQUIRED_EDIT_SECTIONS)) {
      const items = keys.get(key) ?? [];
      for (const section of sections) {
        const hasEdit = items.some(
          (item) =>
            item.extras.includes('edit') && item.extraText.includes(section),
        );
        expect(hasEdit, `${key}: нет edit-скриншота секции "${section}"`).toBe(
          true,
        );
      }
    }
  });

  it('RU edit покрывает ключевые секции матрицы', () => {
    for (const [key, sections] of Object.entries(REQUIRED_RU_EDIT_SECTIONS)) {
      const items = keys.get(key) ?? [];
      for (const section of sections) {
        const editItems = items.filter(
          (item) =>
            item.extras.includes('edit') &&
            item.extraText.includes(section) &&
            item.lang === 'ru',
        );
        expect(
          editItems.length > 0,
          `${key}: нет RU edit-скриншота "${section}"`,
        ).toBe(true);
      }
    }
  });

  it('у мобильных листов есть чтение и редактирование', () => {
    for (const key of MOBILE_READ_EDIT) {
      const items = keys.get(key) ?? [];
      expect(
        items.some((item) => item.extras.includes('mobile')),
        `${key}: нет mobile-скриншотов`,
      ).toBe(true);
      expect(
        items.some(
          (item) =>
            item.extras.includes('mobile') && item.extras.includes('edit'),
        ),
        `${key}: нет mobile-edit скриншотов`,
      ).toBe(true);
    }
  });
});
