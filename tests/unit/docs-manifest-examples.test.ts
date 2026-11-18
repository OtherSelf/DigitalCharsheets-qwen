import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DOCS MANIFEST EXAMPLES ──────────────────────────────────────
 * Примеры манифестов в `docs/` — не иллюстрация, а копипаста: читатель
 * переносит их в `src/games/<id>/plugin.json`. Поэтому каждый пример обязан
 * проходить ту же схему и то же правило цепочки миграций, что и живой
 * манифест. Иначе доки снова начнут учить невалидному (так уже было:
 * `schemaVersion: 5` с `"migrations": []`).
 */

type Manifest = Record<string, any>;
type Generator = {
  /** Возвращает список ошибок схемы; пустой массив — валидно. */
  createManifestValidator(schemaPath?: string): (manifest: unknown) => string[];
};

let cached: Promise<Generator> | undefined;
function generator(): Promise<Generator> {
  cached ??= import('../../scripts/plugins/generate.mjs').then(
    (module) => module as unknown as Generator,
  );
  return cached;
}

const DOC_FILES = ['docs/plugin-sdk.md', 'docs/game-modules.md'];

/** Все `json`-блоки документа, похожие на манифест плагина. */
function manifestExamples(): { file: string; manifest: Manifest }[] {
  const found: { file: string; manifest: Manifest }[] = [];
  for (const file of DOC_FILES) {
    const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    for (const match of text.matchAll(/```json\n([\s\S]*?)```/g)) {
      const source = match[1];
      if (!source.includes('"manifestVersion"')) continue;
      found.push({ file, manifest: JSON.parse(source) });
    }
  }
  return found;
}

/** Ошибки цепочки миграций: покрытие `1 … schemaVersion` без разрывов. */
function migrationErrors(manifest: Manifest): string[] {
  const errors: string[] = [];
  const steps = [...(manifest.migrations ?? [])].sort(
    (a: Manifest, b: Manifest) => a.from - b.from,
  );
  if (manifest.schemaVersion > 1 && steps.length === 0) {
    errors.push(`schemaVersion ${manifest.schemaVersion} без цепочки`);
    return errors;
  }
  let expected = 1;
  for (const step of steps) {
    if (step.from !== expected) {
      errors.push(`ожидался шаг с ${expected}, найден с ${step.from}`);
    }
    if (step.to !== step.from + 1) {
      errors.push(`шаг ${step.from} ведёт в ${step.to}`);
    }
    expected = step.to;
  }
  if (steps.length > 0 && expected !== manifest.schemaVersion) {
    errors.push(
      `цепочка кончается на ${expected}, schemaVersion ${manifest.schemaVersion}`,
    );
  }
  return errors;
}

const examples = manifestExamples();

describe('примеры манифестов в docs/ валидны', () => {
  it('документы содержат хотя бы один пример', () => {
    expect(examples.length).toBeGreaterThanOrEqual(2);
  });

  it.each(examples.map((example) => [example.file, example] as const))(
    '%s: проходит JSON Schema',
    async (_file, example) => {
      const { createManifestValidator } = await generator();
      const validate = createManifestValidator();
      expect(validate(example.manifest)).toEqual([]);
    },
  );

  it.each(examples.map((example) => [example.file, example] as const))(
    '%s: цепочка миграций покрывает 1 → schemaVersion',
    (_file, example) => {
      expect(migrationErrors(example.manifest)).toEqual([]);
    },
  );

  it.each(examples.map((example) => [example.file, example] as const))(
    '%s: словари в .json, а не в legacy .ts',
    (_file, example) => {
      for (const [locale, file] of Object.entries(example.manifest.i18n)) {
        expect(file, locale).toMatch(/\.json$/);
      }
    },
  );
});
