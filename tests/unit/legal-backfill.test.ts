import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: LEGAL BACKFILL CLI ─────────────────────────────────────────
 * Скрипт 0.22.0 замораживает текст пророчества и эффекта в листах до выреза
 * книжных текстов. Проверяем контракт CLI: dry-run не пишет, запись идёт в
 * обе локали, демо пропускается, повторный прогон идемпотентен.
 *
 * Словари — синтетические: тест не должен зависеть от книжного текста.
 */

const SCRIPT = path.resolve('scripts/legal/backfill-divinations.mjs');

let root: string;
let dataDir: string;

function w(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(args: readonly string[]): {
  code: number;
  json: Record<string, number>;
} {
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        SCRIPT,
        '--data-dir',
        dataDir,
        '--i18n',
        path.join(root, 'i18n'),
        '--json',
        ...args,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, json: JSON.parse(stdout) as Record<string, number> };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return {
      code: failure.status ?? 1,
      json: JSON.parse(failure.stdout ?? '{}') as Record<string, number>,
    };
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-backfill-'));
  dataDir = path.join(root, 'data');

  w(path.join(root, 'i18n/dh1/plugin.json'), {
    id: 'dh1',
    aliases: [{ gameSystem: 'Dark Heresy', edition: '1st' }],
  });
  w(path.join(root, 'i18n/dh2/plugin.json'), {
    id: 'dh2',
    aliases: [{ gameSystem: 'Dark Heresy', edition: '2nd' }],
  });
  w(path.join(root, 'i18n/dnd5e/plugin.json'), {
    id: 'dnd5e',
    aliases: [{ gameSystem: 'Dungeons & Dragons' }],
  });

  w(path.join(root, 'i18n/dh1/i18n/en.json'), {
    'dh1.data.divination.painOfBullet': 'EN prophecy',
    'dh1.data.divinationEffect.toughness1': 'EN effect',
  });
  w(path.join(root, 'i18n/dh1/i18n/ru.json'), {
    'dh1.data.divination.painOfBullet': 'RU prophecy',
    'dh1.data.divinationEffect.toughness1': 'RU effect',
  });
  w(path.join(root, 'i18n/dh2/i18n/en.json'), {
    'dh2.catalog.divination.d100-10': 'EN prophecy 2',
    'dh2.catalog.divination.d100-10.effect': 'EN effect 2',
  });
  w(path.join(root, 'i18n/dh2/i18n/ru.json'), {
    'dh2.catalog.divination.d100-10': 'RU prophecy 2',
    'dh2.catalog.divination.d100-10.effect': 'RU effect 2',
  });

  w(path.join(dataDir, 'users/u1/characters/dh1.json'), {
    id: 'dh1',
    systemId: 'dh1',
    schemaVersion: 6,
    divination: 'painOfBullet',
    divinationEffect: 'toughness1',
  });
  w(path.join(dataDir, 'users/u1/characters/dh2.json'), {
    id: 'dh2',
    systemId: 'dh2',
    schemaVersion: 5,
    divination: 'd100-10',
  });
  w(path.join(dataDir, 'users/u1/characters/demo.json'), {
    id: 'demo',
    systemId: 'dh1',
    demo: true,
    divination: 'painOfBullet',
  });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('legal:backfill', () => {
  it('dry-run считает, но не пишет', () => {
    const result = run(['--dry-run']);
    const file = path.join(dataDir, 'users/u1/characters/dh1.json');

    expect(result.code).toBe(0);
    expect(result.json.filled).toBe(2);
    expect(result.json.demo).toBe(1);
    expect(
      JSON.parse(fs.readFileSync(file, 'utf8')).divinationText,
    ).toBeUndefined();
  });

  it('пишет обе локали для DH1 и DH2', () => {
    expect(run([]).json.filled).toBe(2);

    const dh1 = JSON.parse(
      fs.readFileSync(
        path.join(dataDir, 'users/u1/characters/dh1.json'),
        'utf8',
      ),
    );
    expect(dh1.divinationText).toEqual({
      en: 'EN prophecy',
      ru: 'RU prophecy',
    });
    expect(dh1.divinationEffectText).toEqual({
      en: 'EN effect',
      ru: 'RU effect',
    });

    const dh2 = JSON.parse(
      fs.readFileSync(
        path.join(dataDir, 'users/u1/characters/dh2.json'),
        'utf8',
      ),
    );
    expect(dh2.divinationText).toEqual({
      en: 'EN prophecy 2',
      ru: 'RU prophecy 2',
    });
    expect(dh2.divinationEffectText).toEqual({
      en: 'EN effect 2',
      ru: 'RU effect 2',
    });
  });

  it('не трогает демо-лист', () => {
    run([]);
    const demo = JSON.parse(
      fs.readFileSync(
        path.join(dataDir, 'users/u1/characters/demo.json'),
        'utf8',
      ),
    );

    expect(demo.divinationText).toBeUndefined();
  });

  it('идемпотентен: второй прогон ничего не пишет', () => {
    run([]);
    const second = run([]);

    expect(second.json.filled).toBe(0);
    expect(second.json.already).toBe(2);
  });

  it('возвращает 2 и не пишет, если id неизвестен', () => {
    w(path.join(dataDir, 'users/u1/characters/unknown.json'), {
      id: 'unknown',
      systemId: 'dh1',
      divination: 'no-such-id',
    });

    const result = run([]);

    expect(result.code).toBe(2);
    expect(result.json.unknownId).toBe(1);
  });

  it('разрешает legacy-лист по алиасу манифеста', () => {
    w(path.join(dataDir, 'users/u1/characters/legacy-dh2.json'), {
      id: 'legacy-dh2',
      gameSystem: 'Dark Heresy',
      edition: '2nd',
      schemaVersion: 1,
      divination: 'd100-10',
    });

    const result = run([]);

    expect(result.json.filled).toBe(3);
    expect(result.json.unknownSystem).toBe(0);
    const file = JSON.parse(
      fs.readFileSync(
        path.join(dataDir, 'users/u1/characters/legacy-dh2.json'),
        'utf8',
      ),
    );
    expect(file.divinationText).toEqual({
      en: 'EN prophecy 2',
      ru: 'RU prophecy 2',
    });
  });

  it('находит id, если в divination лежит фраза', () => {
    w(path.join(dataDir, 'users/u1/characters/phrase.json'), {
      id: 'phrase',
      gameSystem: 'Dark Heresy',
      edition: '1st',
      schemaVersion: 1,
      divination: 'RU prophecy',
      divinationEffect: 'RU effect',
    });

    const result = run([]);

    expect(result.json.filled).toBe(3);
    const file = JSON.parse(
      fs.readFileSync(
        path.join(dataDir, 'users/u1/characters/phrase.json'),
        'utf8',
      ),
    );
    expect(file.divination).toBe('painOfBullet');
    expect(file.divinationEffect).toBe('toughness1');
    expect(file.divinationText).toEqual({
      en: 'EN prophecy',
      ru: 'RU prophecy',
    });
  });

  it('чужую систему пропускает и считает отдельно', () => {
    w(path.join(dataDir, 'users/u1/characters/dnd.json'), {
      id: 'dnd',
      gameSystem: 'Dungeons & Dragons',
      divination: 'x',
    });

    const result = run([]);

    expect(result.json.otherSystem).toBe(1);
    expect(result.json.unknownSystem).toBe(0);
    expect(result.json.filled).toBe(2);
  });
});
