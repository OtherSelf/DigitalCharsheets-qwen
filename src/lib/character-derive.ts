import { getGamePlugin } from '@/games/registry';

/**
 * ─── LANDMARK: SERVER DERIVE ───────────────────────────────────────────────
 * Авторитетность сервера для производных значений (D11): документ, попавший в
 * файл, обязан быть согласован сам с собой, независимо от того, какой клиент
 * его прислал.
 *
 * Пересчёт управляется флагом `DCS_SERVER_DERIVE`. Пока контракт и чистые
 * реализации выкатывались отдельно от изменения данных, флаг был выключен по
 * умолчанию; теперь сервер авторитетен, а выключить пересчёт можно явно
 * (`DCS_SERVER_DERIVE=0`) — это аварийный тормоз, а не рабочий режим.
 */

/** Имя переменной окружения, включающей пересчёт при записи. */
export const SERVER_DERIVE_FLAG = 'DCS_SERVER_DERIVE';

/**
 * Включён ли пересчёт. По умолчанию включён: согласованность сохранённого
 * листа — норма, а не опция. Выключают явно — `0`/`false` (аварийный тормоз);
 * `1`/`true` — то же, что и умолчание, для читаемости конфигурации.
 */
export function isServerDeriveEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env[SERVER_DERIVE_FLAG];
  return value !== '0' && value !== 'false';
}

/**
 * Применить `derive` плагина к документу листа.
 *
 * Чистая обёртка: не пишет на диск и не знает, куда документ пойдёт дальше —
 * решение о записи принимает вызывающий код под `withDataLock`.
 *
 * @returns копию с пересчитанными полями либо исходный документ, если у
 *   редакции нет `derive` или пересчёт выключен.
 */
export function applyCharacterDerive(
  character: Readonly<Record<string, unknown>>,
  options: {
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): Record<string, unknown> {
  if (!isServerDeriveEnabled(options.env)) return { ...character };

  const systemId =
    typeof character.systemId === 'string' ? character.systemId : undefined;
  const plugin = systemId ? getGamePlugin(systemId) : undefined;
  if (!plugin?.derive) return { ...character };

  return plugin.derive(character) as Record<string, unknown>;
}

/**
 * Пересчитать производные у листа, сохранённого по старой версии схемы.
 *
 * Чтение листа не должно менять свежие данные: пересчёт «догоняет» только
 * документы, чья версия ниже `manifest.schemaVersion` (D11). Запись такого
 * изменения на диск — дело startup-обхода (`normalizeAllCharacters`), который
 * кладёт `.bak` и пишет маркер.
 *
 * @param beforeVersion версия схемы в файле до нормализации (0 — нет поля).
 */
export function healCharacterDerive(
  character: Readonly<Record<string, unknown>>,
  beforeVersion: number,
  options: {
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): Record<string, unknown> {
  if (!isServerDeriveEnabled(options.env)) return { ...character };

  const systemId =
    typeof character.systemId === 'string' ? character.systemId : undefined;
  const plugin = systemId ? getGamePlugin(systemId) : undefined;
  if (!plugin?.derive) return { ...character };
  if (beforeVersion >= plugin.manifest.schemaVersion) return { ...character };

  return plugin.derive(character) as Record<string, unknown>;
}
