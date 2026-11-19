/**
 * ─── LANDMARK: CREATION REVIEW ─────────────────────────────────────────────
 * Импортированный лист открывается в режиме проверки: замки «выбрано при
 * создании» снимаются, пока игрок не подтвердит выборы. Это состояние
 * вкладки, а не листа: после перезагрузки его нет, `schemaVersion` не
 * меняется. Поэтому здесь обычный `Set`, без React и без данных.
 *
 * Модуль общий для ядра и плагинов (`@/games/shared/*`), чтобы диалог импорта
 * и лист редакции говорили про один и тот же id.
 */

const reviews = new Set<string>();

/** Пометить лист как импортированный: замки откроются до фиксации. */
export function startCreationReview(characterId: string): void {
  reviews.add(characterId);
}

/** Идёт ли проверка выборов для этого листа. */
export function isCreationReview(characterId: string): boolean {
  return reviews.has(characterId);
}

/** Зафиксировать выборы: замки возвращаются, лист больше не в проверке. */
export function finishCreationReview(characterId: string): void {
  reviews.delete(characterId);
}

/** Сброс между тестами: в приложении не вызывается. */
export function clearCreationReview(): void {
  reviews.clear();
}
