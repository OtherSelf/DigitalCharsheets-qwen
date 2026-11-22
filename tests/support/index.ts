/**
 * Тест-кит DigitalCharsheets: единственное место общих хелперов.
 *
 * Хост-тесты (`tests/`) и тесты плагинов (`src/games/<id>/tests/`) импортируют
 * его через alias `@tests/support`. Импорт `@/…` разрешён и тестам, и хосту;
 * production-файлам плагина — нет (см. scripts/plugins/boundaries.json).
 */

export * from './auth';
export * from './data-dir';
export * from './fixtures';
export * from './server-storage';
