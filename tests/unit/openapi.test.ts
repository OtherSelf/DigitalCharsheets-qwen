import fs from 'node:fs';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';

import { GET as docsRoute } from '@/app/api/docs/route';
import { GET as specRoute } from '@/app/api/openapi.json/route';
import { listGameModules, listGamePlugins } from '@/games/registry';
import { openApiDocument } from '@/lib/openapi';

/** Ajv по схеме из спеки: проверяет, что документ роута пройдёт спеку. */
function compile(schema: unknown) {
  // OpenAPI 3.1 описывает схемы JSON Schema 2020-12: кортежи приходят как
  // `prefixItems` + `items: false`, и draf-07-валидатор их не поймёт.
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  return ajv.compile(schema as Record<string, unknown>);
}

/**
 * OpenAPI-спека и страница /api/docs.
 *
 * Покрыто:
 *   • базовая структура OpenAPI 3.1 и security-схема cookie-сессии;
 *   • все внутренние $ref разрешаются, operationId уникальны, у каждой
 *     операции есть responses;
 *   • спека совпадает с реальными route.ts (методы и пути) — добавили роут и
 *     забыли доку, тест падает;
 *   • /api/openapi.json отдаёт ровно тот документ, а /api/docs — HTML Scalar
 *     с ссылкой на спеку и зафиксированной версией бандла.
 */

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * /api/docs и /api/openapi.json сами являются документацией, не API.
 * /api/search — статический индекс поиска по `/docs`: он обслуживает UI
 * документации, поэтому в публичной спеке его нет.
 */
const DOCS_ONLY_PATHS = new Set([
  '/api/docs',
  '/api/openapi.json',
  '/api/search',
]);

function routeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(fullPath));
    else if (entry.name === 'route.ts') files.push(fullPath);
  }
  return files;
}

function routePath(file: string): string {
  const relativeDir = path.relative(API_DIR, path.dirname(file));
  const segments = relativeDir
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => segment.replace(/^\[(.+)\]$/, '{$1}'));
  return `/api/${segments.join('/')}`;
}

function routeMethods(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  return [
    ...source.matchAll(
      /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    ),
  ].map((match) => match[1]);
}

interface Operation {
  path: string;
  method: string;
  operation: Record<string, unknown>;
}

function operations(): Operation[] {
  const result: Operation[] = [];
  for (const [apiPath, item] of Object.entries(openApiDocument.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = (item as Record<string, unknown>)[method];
      if (operation && typeof operation === 'object') {
        result.push({
          path: apiPath,
          method: method.toUpperCase(),
          operation: operation as Record<string, unknown>,
        });
      }
    }
  }
  return result;
}

function collectRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.$ref === 'string') refs.add(record.$ref);
  for (const child of Object.values(record)) collectRefs(child, refs);
}

function resolveRef(ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = openApiDocument;
  for (const segment of ref.slice(2).split('/')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

describe('openApiDocument', () => {
  it('это OpenAPI 3.1 с cookie-сессией и основными тегами', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.info.title).toBe('Digital Character Sheets API');
    expect(openApiDocument.info.version).toBe('1.0.0');
    expect(openApiDocument.components.securitySchemes.cookieAuth).toMatchObject(
      {
        type: 'apiKey',
        in: 'cookie',
        name: '__Host-dcs_session',
      },
    );
    expect(Object.keys(openApiDocument.paths).length).toBeGreaterThan(10);
  });

  it('все внутренние $ref разрешаются', () => {
    const refs = new Set<string>();
    collectRefs(openApiDocument, refs);

    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith('#/'), `внешний $ref не поддержан: ${ref}`).toBe(
        true,
      );
      expect(resolveRef(ref), `неразрешённый $ref: ${ref}`).toBeDefined();
    }
  });

  it('operationId уникальны, у каждой операции есть responses', () => {
    const all = operations();
    expect(all.length).toBeGreaterThan(15);

    const ids = all
      .map((item) => item.operation.operationId)
      .filter((id): id is string => typeof id === 'string');
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of all) {
      expect(
        item.operation.responses,
        `${item.method} ${item.path}: нет responses`,
      ).toBeTruthy();
      expect(
        typeof item.operation.summary,
        `${item.method} ${item.path}: нет summary`,
      ).toBe('string');
    }
  });

  it('описывает ровно те пути и методы, которые есть в src/app/api', () => {
    const actual = new Set<string>();
    for (const file of routeFiles(API_DIR)) {
      const apiPath = routePath(file);
      if (DOCS_ONLY_PATHS.has(apiPath)) continue;
      for (const method of routeMethods(file)) {
        actual.add(`${method} ${apiPath}`);
      }
    }

    const documented = new Set(
      operations().map((item) => `${item.method} ${item.path}`),
    );

    expect([...actual].sort(), 'спека разошлась с route.ts').toEqual(
      [...documented].sort(),
    );
  });
});

describe('GET /api/openapi.json', () => {
  it('отдаёт ту же спеку с коротким кэшем', async () => {
    const response = specRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toContain('max-age=300');

    const body = await response.json();
    expect(body).toEqual(JSON.parse(JSON.stringify(openApiDocument)));
  });
});

describe('GET /api/docs', () => {
  it('отдаёт HTML Scalar со ссылкой на /api/openapi.json', async () => {
    const response = docsRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = (await response.text()).replace(/\\\//g, '/');
    expect(html).toContain('/api/openapi.json');
    expect(html).toContain('Digital Character Sheets API');
  });

  it('грузит бандл Scalar со своего origin — CSP запрещает чужие скрипты', async () => {
    const html = (await (await docsRoute()).text()).replace(/\\\//g, '/');
    // script-src 'self' в next.config.ts: бандл с CDN браузер не загрузит,
    // поэтому файл вендорится в public/vendor/scalar и отдаётся нами.
    expect(html).toMatch(
      /src="\/vendor\/scalar\/api-reference-\d+\.\d+\.\d+\.js"/,
    );
    expect(html).not.toContain('cdn.jsdelivr.net');
  });
});

describe('схемы листов собираются из схем плагинов', () => {
  const schemas = openApiDocument.components.schemas as Record<string, unknown>;

  it('у каждого обнаруженного плагина есть входная и выходная схема', () => {
    for (const plugin of listGamePlugins()) {
      const id = plugin.manifest.id;
      expect(schemas[`Sheet_${id}`], `Sheet_${id}`).toBeDefined();
      expect(schemas[`SheetInput_${id}`], `SheetInput_${id}`).toBeDefined();
      const description = JSON.stringify(schemas[`Sheet_${id}`]);
      expect(description).toContain(
        `schemaVersion ${plugin.manifest.schemaVersion}`,
      );
    }
  });

  it('Character перечисляет все редакции и валидирует их демо-листы', () => {
    const character = schemas.Character as { anyOf?: { $ref: string }[] };
    const refs = (character.anyOf ?? []).map((entry) => entry.$ref);
    for (const plugin of listGamePlugins()) {
      expect(refs).toContain(
        `#/components/schemas/Sheet_${plugin.manifest.id}`,
      );
      const validate = compile(schemas[`Sheet_${plugin.manifest.id}`]);
      const demo = {
        id: `${plugin.manifest.id}-spec`,
        ...plugin.module.createDemo(),
      };
      const ok = validate(demo);
      expect(ok, JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('CharacterInput допускает частичный POST {systemId, name}', () => {
    const validate = compile(schemas.CharacterInput);
    // Роут принимает такой запрос и заполняет остальное дефолтами редакции;
    // спека обязана это разрешать (раньше требовала characterClass).
    expect(validate({ systemId: 'dnd5e', name: 'Probe' })).toBe(true);
    const target = listGameModules()[0].id;
    expect(validate({ systemId: target, name: 'Probe' })).toBe(true);
    // Ложного требования игрового поля больше нет.
    expect(validate({ systemId: target })).toBe(true);
  });

  it('AdminCharacterSummary описывает общий вид строки админки', () => {
    const summary = schemas.AdminCharacterSummary as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(summary.required).toEqual(
      expect.arrayContaining(['id', 'name', 'gameSystem', 'updatedAt']),
    );
    expect(Object.keys(summary.properties).sort()).toEqual([
      'gameSystem',
      'id',
      'name',
      'sheet',
      'systemId',
      'updatedAt',
    ]);
    for (const field of ['level', 'rank', 'characterClass']) {
      expect(summary.properties).not.toHaveProperty(field);
    }
  });
});
