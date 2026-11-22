/**
 * Глубокое равенство JSON-подобных значений.
 *
 * Сравниваются только массивы и plain-object; экземпляры классов, `Date`,
 * `Map` и `Set` не равны структурно — иначе две разные даты с одинаковым
 * набором ключей (у них его нет) выглядели бы как одно значение в журнале.
 * Функция чистая и не знает игр: используется и диффом листа, и склейкой
 * сессий истории.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}
