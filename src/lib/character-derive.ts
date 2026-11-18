import { getGamePlugin } from '@/games/registry';

/**
 * ─── LANDMARK: SERVER DERIVE ───────────────────────────────────────────────
 * Авторитетность сервера для производных значений (D11): документ, попавший в
 * файл, обязан быть согласован сам с собой, независимо от того, какой клиент
 * его прислал.
 *
 * Пересчёт включается флагом `DCS_SERVER_DERIVE`, и по умолчанию флаг
 * выключен: контракт `derive` и чистые реализации выкатываются отдельно от
 * изменения сохранённых данных. Включение флага — отдельный этап, и до него
 * запись остаётся ровно такой, какой пришла.
 */

/** Имя переменной окружения, включающей пересчёт при записи. */
export const SERVER_DERIVE_FLAG = 'DCS_SERVER_DERIVE';

/**
 * Включён ли пересчёт. Значения `1`/`true` включают, всё остальное (включая
 * отсутствие переменной) — выключено: неверная настройка не должна незаметно
 * переписывать листы пользователей.
 */
export function isServerDeriveEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env[SERVER_DERIVE_FLAG];
  return value === '1' || value === 'true';
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
