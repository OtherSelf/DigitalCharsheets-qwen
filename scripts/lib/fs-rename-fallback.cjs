// ============================================================================
//  scripts/lib/fs-rename-fallback.cjs — обход EXDEV при `next build`
//
//  Не запускается сам по себе: это --require-патч, который грузится внутрь
//  процесса `next build` (см. scripts/predeploy.sh, scripts/visual.sh).
//
//  Проблема: на overlayfs / 9p (virtiofs, WSL, Docker Desktop, некоторые
//  sandbox-ФС) `rename()` между каталогами возвращает EXDEV, и `next build`
//  падает на переносе `.next/export/{404,500}.html` → `.next/server/pages/`.
//
//  Что делает: подменяет fs.rename / fs.renameSync / fs.promises.rename так,
//  что при EXDEV файл/каталог копируется и исходник удаляется. На нормальной
//  ФС поведение не меняется (rename не бросает EXDEV — shim не срабатывает).
//
//  Подключается только на время сборки, ровно одним способом:
//    NODE_OPTIONS="--require ./scripts/lib/fs-rename-fallback.cjs" npm run build
//  (scripts/predeploy.sh делает это автоматически при повторе после EXDEV).
//
//  Тесты: tests/unit/fs-rename-fallback.test.ts (ошибка инжектится фикстурой,
//  поэтому тест не зависит от ФС).
// ============================================================================

'use strict';

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const isExdev = (error) => Boolean(error && error.code === 'EXDEV');

function moveSync(from, to) {
  let stat;
  try {
    stat = fs.lstatSync(from);
  } catch {
    throw new Error(`rename fallback: нет источника ${from}`);
  }

  if (stat.isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  } else {
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

async function moveAsync(from, to) {
  const stat = await fsPromises.lstat(from);

  if (stat.isDirectory()) {
    await fsPromises.cp(from, to, { recursive: true });
    await fsPromises.rm(from, { recursive: true, force: true });
  } else {
    await fsPromises.copyFile(from, to);
    await fsPromises.unlink(from);
  }
}

// ── fs.renameSync ───────────────────────────────────────────────────────────
const originalRenameSync = fs.renameSync;
fs.renameSync = function renameSyncWithFallback(from, to) {
  try {
    return originalRenameSync.call(fs, from, to);
  } catch (error) {
    if (!isExdev(error)) throw error;
    process.emitWarning(
      `EXDEV: копирую вместо rename: ${from} → ${to}`,
      'FSEXDEVFIX',
    );
    return moveSync(from, to);
  }
};

// ── fs.rename (callback) ────────────────────────────────────────────────────
const originalRename = fs.rename;
fs.rename = function renameWithFallback(from, to, callback) {
  const cb = typeof callback === 'function' ? callback : undefined;

  if (!cb) {
    // Promisified-вариант: fs.promises.rename подменён ниже, но util.promisify(fs.rename)
    // тоже должен вести себя как promise.
    return new Promise((resolve, reject) => {
      originalRename.call(fs, from, to, (error) => {
        if (!error) return resolve();
        if (!isExdev(error)) return reject(error);
        moveAsync(from, to).then(resolve, reject);
      });
    });
  }

  return originalRename.call(fs, from, to, (error) => {
    if (!error) return cb(null);
    if (!isExdev(error)) return cb(error);
    moveAsync(from, to).then(() => cb(null), cb);
  });
};

// ── fs.promises.rename ──────────────────────────────────────────────────────
const originalRenamePromise = fsPromises.rename;
const patchedPromiseRename = async function renamePromiseWithFallback(
  from,
  to,
) {
  try {
    return await originalRenamePromise(from, to);
  } catch (error) {
    if (!isExdev(error)) throw error;
    process.emitWarning(
      `EXDEV: копирую вместо rename: ${from} → ${to}`,
      'FSEXDEVFIX',
    );
    return moveAsync(from, to);
  }
};

fsPromises.rename = patchedPromiseRename;
// На случай, если модуль уже получил ссылку на объект promises (Node >= 14
// отдаёт один и тот же объект, но подстрахуемся).
if (
  typeof fs.promises === 'object' &&
  fs.promises.rename !== patchedPromiseRename
) {
  try {
    fs.promises.rename = patchedPromiseRename;
  } catch {
    /* read-only — не критично, используется fsPromises выше */
  }
}
