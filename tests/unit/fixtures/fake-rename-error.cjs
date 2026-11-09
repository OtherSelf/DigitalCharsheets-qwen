// Фикстура для tests/unit/fs-rename-fallback.test.ts.
//
// Подключается через `node --require` ДО scripts/lib/fs-rename-fallback.cjs: шим
// запоминает текущий fs.renameSync как «оригинал», поэтому после этой фикстуры он
// видит «сломанный» rename и обязан включить фолбэк. EXDEV по заказу не вызвать,
// а инъекция ошибки делает тест детерминированным на любой ФС.
//
// Код ошибки: DCS_FAKE_RENAME_CODE (по умолчанию EXDEV; для негативного кейса — EACCES).

'use strict';

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const code = process.env.DCS_FAKE_RENAME_CODE || 'EXDEV';
const fail = () =>
  Object.assign(new Error(`${code}: fake rename failure`), { code });

// ── fs.renameSync ───────────────────────────────────────────────────────────
fs.renameSync = function fakeRenameSync() {
  throw fail();
};

// ── fs.rename (callback и промис-вызов без колбэка) ─────────────────────────
fs.rename = function fakeRename(from, to, callback) {
  if (typeof callback !== 'function') return Promise.reject(fail());
  return process.nextTick(() => callback(fail()));
};

// ── fs.promises.rename ──────────────────────────────────────────────────────
const fakeRenameAsync = async () => {
  throw fail();
};

fsPromises.rename = fakeRenameAsync;
if (typeof fs.promises === 'object' && fs.promises.rename !== fakeRenameAsync) {
  try {
    fs.promises.rename = fakeRenameAsync;
  } catch {
    /* read-only — не критично, шим берёт fsPromises */
  }
}
