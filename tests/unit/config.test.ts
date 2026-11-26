import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getInstanceConfig, loadInstanceConfig } from '@/lib/config';

/**
 * ─── LANDMARK: INSTANCE CONFIG ─────────────────────────────────────────────
 * Проверяется порядок разрешения: умолчания → файл → `DCS_CONFIG`, и то, что
 * битый конфиг не подменяется молча умолчаниями (в нём реквизиты оператора
 * для юридического текста).
 */

let dir: string;
let file: string;
const saved = {
  path: process.env.DCS_CONFIG_PATH,
  inline: process.env.DCS_CONFIG,
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-config-'));
  file = path.join(dir, 'dcs.config.json');
  process.env.DCS_CONFIG_PATH = file;
  delete process.env.DCS_CONFIG;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  if (saved.path === undefined) delete process.env.DCS_CONFIG_PATH;
  else process.env.DCS_CONFIG_PATH = saved.path;
  if (saved.inline === undefined) delete process.env.DCS_CONFIG;
  else process.env.DCS_CONFIG = saved.inline;
});

describe('instance config', () => {
  it('без файла работает на умолчаниях', () => {
    const config = loadInstanceConfig();
    expect(config.legal.privacy.enabled).toBe(true);
    expect(config.legal.terms.enabled).toBe(false);
    expect(config.legal.ageMinimum).toBe(16);
    expect(config.dev.allowedOrigins).toEqual([]);
  });

  it('путь берётся из DCS_CONFIG_PATH', () => {
    fs.writeFileSync(file, JSON.stringify({ legal: { ageMinimum: 18 } }));
    expect(loadInstanceConfig().legal.ageMinimum).toBe(18);
  });

  it('файл переопределяет умолчания, не теряя остальные поля', () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        legal: {
          privacy: { enabled: false },
          operator: { contactEmail: 'ops@example.org', name: 'Иван' },
        },
        dev: { allowedOrigins: ['dev.example.org'] },
      }),
    );

    const config = loadInstanceConfig();
    expect(config.legal.privacy.enabled).toBe(false);
    expect(config.legal.operator.contactEmail).toBe('ops@example.org');
    expect(config.legal.operator.name).toBe('Иван');
    // Не заданное в файле остаётся умолчанием.
    expect(config.legal.ageMinimum).toBe(16);
    expect(config.hosting.country).toBe('RU');
    expect(config.dev.allowedOrigins).toEqual(['dev.example.org']);
  });

  it('DCS_CONFIG накладывается поверх файла', () => {
    fs.writeFileSync(file, JSON.stringify({ legal: { ageMinimum: 18 } }));
    process.env.DCS_CONFIG = JSON.stringify({
      legal: { privacy: { enabled: false } },
    });

    const config = loadInstanceConfig();
    expect(config.legal.ageMinimum).toBe(18);
    expect(config.legal.privacy.enabled).toBe(false);
  });

  it('массив из DCS_CONFIG заменяет файл, а не склеивается', () => {
    fs.writeFileSync(file, JSON.stringify({ dev: { allowedOrigins: ['a'] } }));
    process.env.DCS_CONFIG = JSON.stringify({
      dev: { allowedOrigins: ['b'] },
    });

    expect(loadInstanceConfig().dev.allowedOrigins).toEqual(['b']);
  });

  it('битый JSON — исключение, а не тихие умолчания', () => {
    fs.writeFileSync(file, '{ oops');
    expect(() => loadInstanceConfig()).toThrow(/dcs\.config\.json/);
  });

  it('неверный тип поля — исключение с именем поля', () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ legal: { ageMinimum: 'шестнадцать' } }),
    );
    expect(() => loadInstanceConfig()).toThrow(/ageMinimum/);
  });

  it('getInstanceConfig кэширует, fresh перечитывает файл', () => {
    fs.writeFileSync(file, JSON.stringify({ legal: { ageMinimum: 18 } }));
    expect(getInstanceConfig({ fresh: true }).legal.ageMinimum).toBe(18);

    fs.writeFileSync(file, JSON.stringify({ legal: { ageMinimum: 21 } }));
    expect(getInstanceConfig().legal.ageMinimum).toBe(18);
    expect(getInstanceConfig({ fresh: true }).legal.ageMinimum).toBe(21);
  });
});
