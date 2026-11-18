import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renamePlugin } from '../../scripts/plugins/rename-plugin.mjs';
import { exampleModule } from '../fixtures/example-plugin';
import fixtureManifest from '../fixtures/example-plugin/plugin.json';
import type { ExampleCharacter } from '../fixtures/example-plugin/types';
import { uiSlots } from '../fixtures/example-plugin/ui';

/**
 * ─── LANDMARK: PLUGIN TEMPLATE GATE ────────────────────────────────────────
 * Обещание `docs/plugin-sdk.md` — «новый плагин = папка + `plugin.json` +
 * пересборка» — проверяется копией эталонной фикстуры, а не чтением доков.
 *
 * Копия делается под id, который **сортируется после** служебных модулей
 * (`./plugin-api`, `./types`): именно такой id ломал `prettier --check` на
 * сгенерированном реестре до фикса генератора.
 *
 * Здесь проверяется то, что видит генератор и хост: папка, манифест, набор
 * плагинов, побайтная сборка реестра и отсутствие «хвостов» шаблона. Контракт
 * самого модуля живёт в `tests/unit/example-plugin.test.ts` — копия выполняет
 * тот же код, дублировать проверки незачем.
 */

type Plugin = { dirName: string; manifest: Record<string, any> };
type Generator = {
  buildRegistry(options: { gamesDir: string; schemaPath: string }): {
    plugins: { id: string }[];
    content: string;
  };
  collectManifests(): Plugin[];
  renderRegistry(plugins: Plugin[]): string;
  validateCollection(plugins: Plugin[]): string[];
  validatePluginFolder(input: {
    gamesDir: string;
    dirName: string;
    manifest: unknown;
  }): string[];
};

let cached: Promise<Generator> | undefined;
function generator(): Promise<Generator> {
  cached ??= import('../../scripts/plugins/generate.mjs').then(
    (module) => module as unknown as Generator,
  );
  return cached;
}

const FIXTURE_DIR = path.join(process.cwd(), 'tests/fixtures/example-plugin');
const SCHEMA_PATH = path.join(process.cwd(), 'src/games/plugin.schema.json');

// `zzprobe` > `plugin-api` > `example` — специально проверяем хвост сортировки.
const PROBE_ID = 'zzprobe';
const PROBE_GAME_ID = 'zzprobeGame';
const PROBE_TITLE = 'ZZ Probe';

let root: string;
let gamesDir: string;
let pluginDir: string;
let manifest: Record<string, any>;

/**
 * Боевые манифесты без нашего probe-id: гейт обязан работать и тогда, когда
 * в репозитории уже есть настоящий плагин с тем же id (иначе прогон гейта
 * внутри дерева с копией падал бы на «дублирующемся id»).
 */
async function realManifests(): Promise<Plugin[]> {
  const { collectManifests } = await generator();
  return collectManifests().filter((entry) => entry.manifest.id !== PROBE_ID);
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-template-'));
  gamesDir = path.join(root, 'src/games');
  pluginDir = path.join(gamesDir, PROBE_ID);
  // Свободный order: набор в validateCollection не должен падать на дубле,
  // если настоящие плагины когда-нибудь займут фиксированный номер.
  const real = await realManifests();
  const order =
    Math.max(0, ...real.map((entry) => Number(entry.manifest.order))) + 10;
  ({ manifest } = await renamePlugin({
    sourceDir: FIXTURE_DIR,
    targetDir: pluginDir,
    id: PROBE_ID,
    gameId: PROBE_GAME_ID,
    gameTitle: PROBE_TITLE,
    order,
    version: '0.1.0',
  }));
});

afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('копия фикстуры под чужим id', () => {
  it('проходит проверки папки и набора плагинов', async () => {
    const { validateCollection, validatePluginFolder } = await generator();

    expect(
      validatePluginFolder({ gamesDir, dirName: PROBE_ID, manifest }),
    ).toEqual([]);
    // Набор: боевые плагины + копия. order 990 не пересекается с 10/20/30.
    expect(
      validateCollection([
        ...(await realManifests()),
        { dirName: PROBE_ID, manifest },
      ]),
    ).toEqual([]);
  });

  it('находится генератором на диске и попадает в реестр', async () => {
    const { buildRegistry } = await generator();
    const built = buildRegistry({ gamesDir, schemaPath: SCHEMA_PATH });
    expect(built.plugins.map((plugin) => plugin.id)).toEqual([PROBE_ID]);
    expect(built.content).toContain(
      `import { ${PROBE_ID}Module } from './${PROBE_ID}';`,
    );
    expect(built.content).toContain(
      `import ${PROBE_ID}Manifest from './${PROBE_ID}/plugin.json';`,
    );
  });

  it('реестр с копией остаётся prettier-чистым', async () => {
    const { renderRegistry } = await generator();
    const content = renderRegistry([
      ...(await realManifests()),
      { dirName: PROBE_ID, manifest },
    ]);
    const prettier = await import('prettier');
    const config =
      (await prettier.resolveConfig(
        path.join(process.cwd(), 'src/games/registry.generated.ts'),
      )) ?? {};
    const formatted = await prettier.format(content, {
      ...config,
      parser: 'typescript',
      filepath: path.join(process.cwd(), 'src/games/registry.generated.ts'),
    });
    expect(formatted).toBe(content);
  });

  it('не тащит тесты шаблона и чужие имена', () => {
    expect(fs.existsSync(path.join(pluginDir, 'tests'))).toBe(false);

    const leftovers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|json)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        for (const pattern of [
          /exampleGame/,
          /exampleModule/,
          /\bexample\./,
          /['"]example['"]/,
        ]) {
          if (pattern.test(text)) {
            leftovers.push(`${path.relative(pluginDir, full)}: ${pattern}`);
          }
        }
      }
    };
    walk(pluginDir);
    expect(leftovers).toEqual([]);
  });

  it('файлы копии проходят prettier', async () => {
    const prettier = await import('prettier');
    // Копия лежит в os.tmpdir: конфиг берём из репозитория, а плагины
    // сортировки импортов — абсолютными путями (от файла в /tmp prettier
    // ищет их в /tmp/node_modules и не находит).
    const localRequire = createRequire(import.meta.url);
    const config: Record<string, unknown> = {
      ...((await prettier.resolveConfig(
        path.join(process.cwd(), 'src/games/registry.generated.ts'),
      )) ?? {}),
      plugins: [
        localRequire.resolve('@ianvs/prettier-plugin-sort-imports'),
        localRequire.resolve('prettier-plugin-tailwindcss'),
      ],
    };
    const dirty: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!/\.(ts|tsx|json)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        const formatted = await prettier.format(text, {
          ...config,
          filepath: full,
        });
        if (formatted !== text) dirty.push(path.relative(pluginDir, full));
      }
    };
    await walk(pluginDir);
    expect(dirty).toEqual([]);
  });

  it('модуль фикстуры выполняет контракт, который проверяет копия', () => {
    // Копия — тот же код: если фикстура теряет часть контракта, гейт падает
    // здесь, а не в чужом проекте после копирования.
    expect(typeof exampleModule.normalize).toBe('function');
    expect(typeof exampleModule.merge).toBe('function');

    const normalize = exampleModule.normalize!;
    const first = normalize(
      { name: 'N', stats: { might: 7 }, rank: '' },
      {
        applyDefaults: true,
      },
    );
    const second = normalize({ ...first.character }, { applyDefaults: true });
    expect(second.character).toEqual(first.character);

    const demo = { id: 'gate', ...exampleModule.createDemo() };
    expect(
      exampleModule.schema.safeParse({
        ...demo,
        stats: { might: 999, wits: 10 },
      }).success,
    ).toBe(false);
    expect(
      exampleModule.schema.safeParse({
        ...demo,
        stats: { might: -1, wits: 10 },
      }).success,
    ).toBe(false);

    expect(fixtureManifest.migrations.length).toBe(
      exampleModule.migrations.length,
    );
    expect(fixtureManifest.migrations.length).toBeGreaterThan(0);

    // Служебные поля хоста схема обязана сохранять: `z.object` их вырезает,
    // и созданный лист остаётся без `userId` (падение creation.test.ts).
    const withHostFields = exampleModule.schema.parse({
      ...demo,
      userId: 'host-user',
    }) as unknown as Record<string, unknown>;
    expect(withHostFields.userId).toBe('host-user');
    expect([...(fixtureManifest.ui?.slots ?? [])].sort()).toEqual(
      Object.keys(uiSlots).sort(),
    );
    expect(uiSlots.BulkEditor?.length ?? 0).toBeGreaterThan(0);
    expect(
      (uiSlots.CompactNav?.(demo as ExampleCharacter) ?? [])[0]?.icon,
    ).toBeTruthy();
  });

  it('переименовал namespace словарей и точки входа', () => {
    const en = JSON.parse(
      fs.readFileSync(path.join(pluginDir, 'i18n/en.json'), 'utf8'),
    ) as Record<string, string>;
    expect(Object.keys(en).every((key) => key.startsWith(`${PROBE_ID}.`))).toBe(
      true,
    );
    expect(manifest.game.id).toBe(PROBE_GAME_ID);
    expect(manifest.game.order).toBe(manifest.order);
    const entry = fs.readFileSync(path.join(pluginDir, 'index.ts'), 'utf8');
    expect(entry).toContain(`export const ${PROBE_ID}Module`);
    // `shortCode` — поле модуля, не манифеста: схема лишних полей не терпит.
    expect(entry).toContain(`shortCode: '${PROBE_ID}'`);
  });
});
