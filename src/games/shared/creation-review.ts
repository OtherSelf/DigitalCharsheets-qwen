/**
 * ─── LANDMARK: CREATION REVIEW ─────────────────────────────────────────────
 * Импортированный лист открывается в режиме проверки: замки «выбрано при
 * создании» снимаются, пока игрок не подтвердит выборы. Это состояние
 * вкладки, а не листа: после фиксации или закрытия вкладки его нет,
 * `schemaVersion` не меняется. Поэтому здесь подписанный набор id, без React
 * и без данных.
 *
 * Модуль общий для ядра и плагинов (`@/games/shared/*`), чтобы диалог импорта
 * и лист редакции говорили про один и тот же id.
 *
 * Хранится в `sessionStorage`, а не только в памяти модуля: переход из
 * диалога импорта на страницу листа может стать полной перезагрузкой
 * документа (Next уходит в MPA-фолбэк, если RSC-ответ пришёл не полностью), и
 * тогда память вкладки обнуляется — отметка терялась, баннер не появлялся.
 * `sessionStorage` живёт вкладку, переживает переход и гаснет вместе с ней;
 * отметки снимаются фиксацией и не попадают в другую вкладку. Кэш в модуле
 * здесь только чтобы не читать хранилище на каждый вызов.
 */

const STORAGE_KEY = 'dcs.creation-review';

let cache: Set<string> | null = null;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    // Приватный режим или заблокированное хранилище: остаёмся на памяти.
    return null;
  }
}

function load(): Set<string> {
  if (cache) return cache;
  const ids = new Set<string>();
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string' && id !== '') ids.add(id);
        }
      }
    } catch {
      storage()?.removeItem(STORAGE_KEY);
    }
  }
  cache = ids;
  return ids;
}

function persist(ids: Set<string>): void {
  const holder = storage();
  if (!holder) return;
  if (ids.size === 0) {
    holder.removeItem(STORAGE_KEY);
    return;
  }
  holder.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

/** Пометить лист как импортированный: замки откроются до фиксации. */
export function startCreationReview(characterId: string): void {
  const ids = load();
  ids.add(characterId);
  persist(ids);
}

/** Идёт ли проверка выборов для этого листа. */
export function isCreationReview(characterId: string): boolean {
  return load().has(characterId);
}

/** Зафиксировать выборы: замки возвращаются, лист больше не в проверке. */
export function finishCreationReview(characterId: string): void {
  const ids = load();
  ids.delete(characterId);
  persist(ids);
}

/** Сброс между тестами: в приложении не вызывается. */
export function clearCreationReview(): void {
  cache = new Set<string>();
  storage()?.removeItem(STORAGE_KEY);
}
