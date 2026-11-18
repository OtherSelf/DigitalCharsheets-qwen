import { describe, expect, it } from 'vitest';

import {
  isHostApiCompatible,
  parseEntryPoint,
  PLUGIN_API_VERSION,
  PLUGIN_MANIFEST_VERSION,
  SUPPORTED_PLUGIN_API_RANGES,
  type PluginManifest,
} from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';

/**
 * ─── LANDMARK: PLUGIN API CONTRACT ─────────────────────────────────────────
 * Контракт версий Plugin API проверяется отдельно от реестра: здесь важно не
 * «какие плагины есть», а «что хост считает совместимым».
 *
 * Главное правило — никакого тихого согласия. Неподдержанная запись диапазона
 * (`>`, `<`, `<=`, `1.x`, составной диапазон, `^0.x`) обязана падать явной
 * ошибкой на генерации, а не превращаться в «ровно 1.0.0».
 */

type Generator = {
  validateCollection(
    plugins: { dirName: string; manifest: PluginManifest }[],
  ): string[];
};

const host = PLUGIN_API_VERSION.split('.').map(Number) as [
  number,
  number,
  number,
];

describe('Plugin API: версии', () => {
  it('манифесты объявляют ту версию формата, которую понимает хост', () => {
    expect(PLUGIN_MANIFEST_VERSION).toBe(2);
    expect(PLUGIN_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    for (const plugin of gamePlugins) {
      expect(plugin.manifest.manifestVersion, plugin.manifest.id).toBe(
        PLUGIN_MANIFEST_VERSION,
      );
    }
  });

  it('поддержанный список описан явно', () => {
    expect(SUPPORTED_PLUGIN_API_RANGES).toContain('*');
    expect(SUPPORTED_PLUGIN_API_RANGES).toContain('^1.2.3');
    expect(SUPPORTED_PLUGIN_API_RANGES).toContain('~1.2.3');
    expect(SUPPORTED_PLUGIN_API_RANGES).toContain('>=1.2.3');
    expect(SUPPORTED_PLUGIN_API_RANGES).toContain('1.2.3');
  });
});

describe('Plugin API: поддержанные диапазоны', () => {
  it('* совместим с любой версией хоста', () => {
    expect(isHostApiCompatible('*')).toBe(true);
  });

  it('точная версия сравнивается строго', () => {
    expect(isHostApiCompatible(PLUGIN_API_VERSION)).toBe(true);
    expect(isHostApiCompatible('1.0.0')).toBe(
      host[0] === 1 && host[1] === 0 && host[2] === 0,
    );
  });

  it('^ держит мажор и нижнюю границу', () => {
    expect(isHostApiCompatible(`^1.0.0`)).toBe(host[0] === 1);
    expect(isHostApiCompatible(`^2.0.0`)).toBe(false);
    expect(isHostApiCompatible(`^${host[0]}.${host[1]}.${host[2]}`)).toBe(true);
    // Патч выше хоста — уже несовместимо.
    expect(isHostApiCompatible(`^${host[0]}.${host[1]}.${host[2] + 1}`)).toBe(
      false,
    );
  });

  it('~ держит мажор и минор', () => {
    expect(isHostApiCompatible(`~${host[0]}.${host[1]}.0`)).toBe(true);
    expect(isHostApiCompatible(`~${host[0]}.0.0`)).toBe(
      host[1] === 0 && host[2] === 0,
    );
  });

  it('>= проверяет только нижнюю границу', () => {
    expect(isHostApiCompatible('>=1.0.0')).toBe(true);
    expect(isHostApiCompatible(`>=${host[0]}.${host[1]}.${host[2]}`)).toBe(
      true,
    );
    expect(isHostApiCompatible(`>=${host[0] + 1}.0.0`)).toBe(false);
  });
});

describe('Plugin API: неподдержанные диапазоны — явный отказ', () => {
  const unsupported = [
    '>1.0.0',
    '<1.0.0',
    '<=2.0.0',
    '=1.2.3',
    '1.x',
    '1.2',
    '1.2.3.4',
    '>=1.0 <2',
    '^0.2.3',
    'not-a-version',
    '',
  ];

  for (const range of unsupported) {
    it(`«${range}» падает, а не переинтерпретируется`, () => {
      expect(() => isHostApiCompatible(range)).toThrow(
        /Неподдерживаемый диапазон pluginApi/,
      );
    });
  }

  it('^0.x объясняет, почему отказ', () => {
    expect(() => isHostApiCompatible('^0.2.3')).toThrow(/мажорной версии/);
  });

  it('некорректная версия хоста — тоже отказ', () => {
    expect(() => isHostApiCompatible('^1.0.0', 'latest')).toThrow(
      /Некорректная версия хоста/,
    );
  });
});

describe('Plugin API: генератор показывает отказ как ошибку манифеста', () => {
  it('^0.2.3 попадает в список ошибок набора, а не роняет генерацию', async () => {
    const { validateCollection } =
      (await import('../../scripts/plugins/generate.mjs')) as unknown as Generator;
    const base = gamePlugins[0].manifest;
    const errors = validateCollection([
      {
        dirName: base.id,
        manifest: { ...base, pluginApi: '^0.2.3' },
      },
    ]).join('\n');
    expect(errors).toContain('pluginApi');
    expect(errors).toContain('мажорной версии');
  });
});

describe('Plugin API: точки входа', () => {
  it('parseEntryPoint разделяет файл и экспорт', () => {
    expect(parseEntryPoint('index.ts#createDemo')).toEqual({
      file: 'index.ts',
      member: 'createDemo',
    });
    expect(parseEntryPoint('i18n/en.ts')).toEqual({ file: 'i18n/en.ts' });
    expect(() => parseEntryPoint('index.ts#a#b')).toThrow(/Некорректная/);
    expect(() => parseEntryPoint('../outside.ts#x')).toThrow(/относительным/);
    expect(() => parseEntryPoint('/abs.ts#x')).toThrow(/относительным/);
    expect(() => parseEntryPoint('index.ts#bad-name')).toThrow(/экспорта/);
  });
});
