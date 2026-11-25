/**
 * Перестановка элемента внутри массива для списков листа.
 *
 * Отдельный маленький хелпер, а не `arrayMove` из `@dnd-kit`: плагинам
 * запрещено тянуть dnd-kit напрямую (границы плагинов), а спискам редакций
 * нужна только эта арифметика. Индексы вне диапазона — не ошибка: во время
 * быстрого drag список мог успеть обновиться, и лучше вернуть копию, чем
 * уронить лист.
 */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const size = items.length;
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= size ||
    to >= size ||
    !Number.isInteger(from) ||
    !Number.isInteger(to)
  ) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
