import path from 'path';

/**
 * Каталог, в котором лежат аккаунты (`user-<hash>/user.json`) и листы
 * персонажей (`user-<hash>/characters/<id>.json`).
 *
 * По умолчанию — `<cwd>/data`, как и было раньше.
 * Переопределяется переменной окружения `DCS_DATA_DIR` (абсолютный или
 * относительный путь). Нужно для:
 *   - тестов (изоляция от реальных данных);
 *   - деплоя, когда данные лежат вне каталога проекта
 *     (`DCS_DATA_DIR=/var/lib/charsheets/data npm start`).
 *
 * Читается при каждом вызове, а не на этапе импорта модуля, поэтому
 * переменную можно задавать/менять в рантайме (в т.ч. в тестах).
 */
export function getDataDir(): string {
  const fromEnv = process.env.DCS_DATA_DIR;
  if (fromEnv && fromEnv.trim() !== '') {
    return path.resolve(fromEnv.trim());
  }
  return path.join(process.cwd(), 'data');
}
