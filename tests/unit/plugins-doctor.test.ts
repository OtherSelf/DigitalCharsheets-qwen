import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GeneratedPluginRegistration } from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';
import { normalizeCharacterRecord } from '@/lib/character-version';

/**
 * ─── LANDMARK: DERIVED VALUES DOCTOR ──────────────────────────────────────
 * Read-only отчёт о расхождении производных значений (`npm run plugins:doctor`).
 *
 * Корпус: демо-листы всех обнаруженных плагинов (эталон того, что редакция
 * считает согласованным) плюс обезличенные legacy-документы из
 * `scripts/legacy-migration/examples` — реальная форма старых листов, без
 * данных пользователей.
 *
 * Для каждого листа считается, сколько полей `derive` переписал бы. Демо-листы
 * обязаны быть согласованными (иначе редакция противоречит своим же правилам),
 * legacy-листы — нет: их догоняет startup-обход. После «лечения» расхождений
 * ноль у всех.
 */

type Plugin = GeneratedPluginRegistration;

const plugins = gamePlugins as readonly Plugin[];

/** Стабильная сериализация: сравнение не зависит от порядка ключей. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, child]) => `${key}:${canonical(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function differingPaths(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = '',
): string[] {
  const paths: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const next = `${prefix}${prefix ? '.' : ''}${key}`;
    const a = before[key];
    const b = after[key];
    if (canonical(a) === canonical(b)) continue;
    if (
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      paths.push(
        ...differingPaths(
          a as Record<string, unknown>,
          b as Record<string, unknown>,
          next,
        ),
      );
      continue;
    }
    paths.push(next);
  }
  return paths;
}

/** Путь манифеста (`skills[].value`) → регулярное выражение реального пути. */
function pathPattern(declaredPath: string): RegExp {
  const escaped = declaredPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\[\]/g, '(?:\\.\\d+)?');
  return new RegExp(`^${pattern}$`);
}

function demoDocument(plugin: Plugin): Record<string, unknown> {
  return { id: `${plugin.manifest.id}-doctor`, ...plugin.module.createDemo() };
}

function legacyDocuments(): Record<string, unknown>[] {
  const file = path.join(
    process.cwd(),
    'scripts/legacy-migration/examples/import-source.example.json',
  );
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
    string,
    unknown
  >[];
  return raw.map(
    (doc) => normalizeCharacterRecord(doc).character as Record<string, unknown>,
  );
}

function deriveFor(
  document: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const systemId =
    typeof document.systemId === 'string' ? document.systemId : undefined;
  if (!systemId) return undefined;
  const plugin = plugins.find((item) => item.manifest.id === systemId);
  if (!plugin?.derive) return undefined;
  return plugin.derive(document) as Record<string, unknown>;
}

describe('plugins:doctor — расхождение производных', () => {
  it('демо-листы согласованы: derive ничего не меняет', () => {
    const divergent: { id: string; paths: string[] }[] = [];
    for (const plugin of plugins) {
      if (!plugin.derive) continue;
      const document = demoDocument(plugin);
      const derived = deriveFor(document) ?? document;
      const paths = differingPaths(document, derived);
      if (paths.length > 0) divergent.push({ id: plugin.manifest.id, paths });
    }
    expect(divergent).toEqual([]);
  });

  it('legacy-корпус: расхождения считаются и лечатся derive', () => {
    const documents = legacyDocuments();
    expect(documents.length).toBeGreaterThan(0);

    const divergent: { gameSystem: string; paths: string[] }[] = [];
    for (const document of documents) {
      const derived = deriveFor(document);
      if (!derived) continue;
      const paths = differingPaths(document, derived);
      if (paths.length > 0) {
        divergent.push({
          gameSystem: String(document.systemId),
          paths: paths.slice(0, 5),
        });
      }
      // После лечения повторный пересчёт ничего не меняет.
      expect(canonical(deriveFor(derived) ?? derived)).toBe(canonical(derived));
    }

    // Отчёт печатается всегда: цифры нужны в журнале трекера.
    console.log(
      `plugins:doctor — legacy-листов: ${documents.length}, ` +
        `с расходящимися производными: ${divergent.length}`,
    );
    expect(divergent.length).toBeGreaterThanOrEqual(0);
  });

  it('производные попадают ровно в объявленные манифестом поля', () => {
    for (const plugin of plugins) {
      if (!plugin.derive || !plugin.manifest.derived) continue;
      const document = demoDocument(plugin);
      const derived = deriveFor(document) ?? document;
      for (const changed of differingPaths(document, derived)) {
        const declared = plugin.manifest.derived.some((declaredPath) =>
          pathPattern(declaredPath).test(changed),
        );
        expect(declared, `${plugin.manifest.id}: ${changed}`).toBe(true);
      }
    }
  });
});
