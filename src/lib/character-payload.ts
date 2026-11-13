import type { ZodType } from 'zod';

import type { AnyGameModule } from '@/games/registry';
import { normalizeCharacterRecord } from '@/lib/character-version';

/**
 * ─── LANDMARK: CHARACTER PAYLOAD ────────────────────────────────────────────
 * Тело POST/PUT листа приходит от клиента и раньше писалось как есть
 * (`...body`), поэтому в файл мог попасть любой JSON: лишние поля, `id`,
 * `userId`, `stats: "строка"` — и сломать рендер, а `id` в теле переписывал имя
 * файла.
 *
 * Правила:
 *   1. служебные поля (`__page`, `__seq`, `id`, `userId`, `systemId`) из тела
 *      не берутся — их выдаёт сервер;
 *   2. схема редакции (`module.schema`, zod) проверяет данные: не та структура
 *      — `400` со списком полей, а не запись «как получилось»;
 *   3. ключи, которых в схеме модуля нет, отбрасываются — в файл попадает
 *      только то, что модуль умеет читать.
 *
 * Вложенные объекты проверяет `looseObject` из схемы плагина: расширять лист
 * своими полями — право плагина, а не клиента.
 */

export interface PayloadIssue {
  path: string;
  message: string;
}

export type CharacterPayloadResult =
  | { ok: true; data: Record<string, unknown>; dropped: string[] }
  | { ok: false; issues: PayloadIssue[] };

/** Поля, которыми владеет сервер: из тела они не принимаются. */
const SERVER_OWNED_KEYS = new Set(['id', 'userId', 'systemId']);

function isServerManaged(key: string): boolean {
  return key.startsWith('__') || SERVER_OWNED_KEYS.has(key);
}

/**
 * Имена полей верхнего уровня из zod-схемы. `GameModule.schema` типизирован
 * как `ZodType`, поэтому `shape` читается только если он есть (zodObject).
 * Если схемы-объекта нет — ограничиваемся служебными полями.
 */
function schemaFieldNames(schema: ZodType): string[] | null {
  const shape = (schema as unknown as { shape?: unknown }).shape;
  if (!shape || typeof shape !== 'object') return null;
  return Object.keys(shape as Record<string, unknown>);
}

function toIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): PayloadIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * Отбросить служебные поля и всё, чего нет в схеме модуля.
 * Возвращает новый объект: тело запроса не мутируем.
 */
export function sanitizeCharacterPayload(
  module: AnyGameModule,
  raw: Record<string, unknown>,
): { data: Record<string, unknown>; dropped: string[] } {
  const allowed = schemaFieldNames(module.schema);
  const data: Record<string, unknown> = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (isServerManaged(key)) continue;
    if (allowed && !allowed.includes(key)) {
      dropped.push(key);
      continue;
    }
    data[key] = value;
  }

  return { data, dropped };
}

/**
 * Проверить данные листа схемой редакции. `raw` — то, что реально уйдёт в
 * файл (сервер уже добавил свои поля, если это создание листа).
 */
export function validateCharacterData(
  module: AnyGameModule,
  raw: Record<string, unknown>,
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; issues: PayloadIssue[] } {
  const parsed = module.schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: toIssues(parsed.error) };
  }
  // `looseObject` возвращает данные с сохранёнными неизвестными вложенными
  // полями: доверяем схеме модуля и пишем ровно то, что она приняла.
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

/**
 * Проверить патч PUT: служебные поля и незнакомые ключи отбрасываются, а
 * результат слияния с текущим листом нормализуется (как при записи) и обязан
 * пройти схему. Проверяется именно итог: частичный патч сам по себе не
 * содержит обязательных полей, а нормализация заполняет поля, которые
 * редакция и так добавляет каждой записи.
 */
export function validateCharacterPatch(
  module: AnyGameModule,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): CharacterPayloadResult {
  const { data, dropped } = sanitizeCharacterPayload(module, patch);
  const merged = { ...current, ...data };
  const normalized = normalizeCharacterRecord(merged)
    .character as unknown as Record<string, unknown>;

  const validated = validateCharacterData(module, normalized);
  if (validated.ok) return { ok: true, data, dropped };

  // Лист мог быть неполным ещё до патча (старая запись, миграция): такие
  // проблемы не наша забота, иначе правка «одного поля» падала бы навсегда.
  // Отклоняем только те, которые появятся именно из-за патча.
  const baseline = module.schema.safeParse(
    normalizeCharacterRecord(current).character,
  );
  const preexisting = new Set(
    baseline.success
      ? []
      : baseline.error.issues.map(
          (issue) => `${issue.path.map(String).join('.')}|${issue.message}`,
        ),
  );
  const introduced = validated.issues.filter(
    (issue) => !preexisting.has(`${issue.path}|${issue.message}`),
  );
  if (introduced.length === 0) return { ok: true, data, dropped };
  return { ok: false, issues: introduced };
}

/**
 * Подготовить новый лист: поля редакции по умолчанию + присланные данные,
 * затем нормализация и проверка схемой. Возвращает то, что можно писать в
 * файл, либо список полей, которые не прошли схему.
 */
export function prepareNewCharacter(
  module: AnyGameModule,
  data: Record<string, unknown>,
  serverFields: Record<string, unknown>,
):
  | { ok: true; character: Record<string, unknown> }
  | { ok: false; issues: PayloadIssue[] } {
  const defaults = module.createDefaults() as Record<string, unknown>;
  const merged = { ...defaults, ...data, ...serverFields };
  const normalized = normalizeCharacterRecord(merged)
    .character as unknown as Record<string, unknown>;
  const validated = validateCharacterData(module, normalized);
  if (!validated.ok) return validated;
  return { ok: true, character: validated.data };
}
