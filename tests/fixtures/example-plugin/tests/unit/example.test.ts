import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readJson } from '@tests/support';

import { createDefaults, createDemo, exampleModule } from '../..';
import exampleEn from '../../i18n/en.json';
import exampleRu from '../../i18n/ru.json';
import exampleManifest from '../../plugin.json';

/**
 * Тест живёт внутри эталонного плагина и доказывает два свойства раскладки:
 *   1. у плагина может быть собственный unit-тест, который видит vitest,
 *      тест-кит `@tests/*` и файлы рядом с кодом (boundaries/ESLint это не
 *      запрещают только для `src/games/<id>/tests/**` и `tests/fixtures`);
 *   2. контракт модуля проверяется на его же схеме — без хоста и без копий
 *      данных в `tests/unit`.
 *
 * Сквозной прогон через генератор реестра остаётся в хосте
 * (`tests/unit/example-plugin.test.ts`): здесь — только модуль и словари.
 */

describe('эталонный плагин: собственный unit-тест', () => {
  it('манифест читается с диска и совпадает с модулем', () => {
    const manifest = readJson<{ id: string; version: string }>(
      fileURLToPath(new URL('../../plugin.json', import.meta.url)),
    );
    expect(manifest.id).toBe(exampleModule.id);
    expect(manifest.version).toBe(exampleManifest.version);
    expect(manifest.id).not.toBe('dh1');
  });

  it('дефолты и демо проходят схему модуля', () => {
    const defaults = createDefaults();
    const demo = createDemo();

    expect(() =>
      exampleModule.schema.parse({ id: 'test-defaults', ...defaults }),
    ).not.toThrow();
    expect(() =>
      exampleModule.schema.parse({ id: 'test-demo', ...demo }),
    ).not.toThrow();
  });

  it('демо заполнено, а не пустой черновик', () => {
    const demo = createDemo();
    expect(demo.name).toBe('Example Hero');
    expect(demo.rank).toBe('Veteran');
  });

  it('словари en и ru совпадают по ключам', () => {
    expect(Object.keys(exampleRu).sort()).toEqual(
      Object.keys(exampleEn).sort(),
    );
    for (const [key, value] of Object.entries(exampleEn)) {
      expect(value, key).not.toBe('');
      expect((exampleRu as Record<string, string>)[key], key).toBeTruthy();
    }
  });

  it('модуль объявляет точки входа из манифеста', () => {
    expect(exampleManifest.entry.module).toBe('index.ts#exampleModule');
    expect(exampleManifest.demo.entry).toBe('index.ts#createDemo');
    expect(exampleModule.id).toBe('example');
    expect(exampleModule.defaultStatus).toBe('hidden');
  });
});
