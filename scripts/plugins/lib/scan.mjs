/**
 * Общие сканеры для plugin-гейтов: спецификаторы импортов и замена
 * комментариев/литералов пробелами с сохранением номеров строк.
 */

/**
 * Спецификаторы импортов файла: `import x from 'a'`, `import 'a'`,
 * `import('a')`, `export … from 'a'`, `require('a')`.
 *
 * Повтор одного и того же модуля в файле считается один раз.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractSpecifiers(source) {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1].trim();
      if (specifier) found.add(specifier);
    }
  }
  return [...found];
}

/**
 * Заменить комментарии (и, по желанию, содержимое литералов) пробелами,
 * сохранив переводы строк: номера строк остаются исходными.
 *
 * Шаблонные литералы с `${...}` требуют стека: подстановка — снова код, и
 * внутри неё может быть свой шаблон. Без стека сканер «уезжает» в строковое
 * состояние и перестаёт видеть комментарии ниже.
 *
 * @param {string} source
 * @param {{ keepStrings?: boolean }} [options]
 * @returns {string}
 */
export function stripSource(source, { keepStrings = false } = {}) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let j = from; j < to; j += 1) {
      if (out[j] !== '\n') out[j] = ' ';
    }
  };
  const blankLiteral = (from, to) => {
    if (!keepStrings) blank(from, to);
  };
  let mode = 'code';
  const templateStack = [];
  let braceDepth = 0;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        const end = source.indexOf('\n', i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        const stop = end === -1 ? source.length : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === '(' && next === '*') {
        // Комментарий в JSX: {/* ... */}
        const end = source.indexOf('*)', i + 2);
        if (end !== -1) {
          blank(i, end + 2);
          i = end + 2;
          continue;
        }
      }
      if (ch === "'" || ch === '"') {
        mode = ch;
        blankLiteral(i, i + 1);
        i += 1;
        continue;
      }
      if (ch === '`') {
        mode = '`';
        blankLiteral(i, i + 1);
        i += 1;
        continue;
      }
      if (ch === '{') {
        braceDepth += 1;
        i += 1;
        continue;
      }
      if (ch === '}') {
        if (braceDepth > 0) {
          braceDepth -= 1;
        } else if (templateStack.length > 0) {
          // `}` закрывает подстановку: это часть литерала, а не код.
          blankLiteral(i, i + 1);
          mode = '`';
          templateStack.pop();
        }
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    // Внутри строки или шаблона.
    if (ch === '\\') {
      blankLiteral(i, i + 2);
      i += 2;
      continue;
    }
    if (mode === '`' && ch === '$' && next === '{') {
      // Подстановка — снова код; шаблон вернётся после закрывающей скобки.
      blankLiteral(i, i + 2);
      templateStack.push(braceDepth);
      braceDepth = 0;
      mode = 'code';
      i += 2;
      continue;
    }
    if (ch === mode) {
      blankLiteral(i, i + 1);
      mode = 'code';
      i += 1;
      continue;
    }
    blankLiteral(i, i + 1);
    i += 1;
  }
  return out.join('');
}

/** Затереть комментарии и литералы (для поиска игровых имён в коде). */
export function stripNonCode(source) {
  return stripSource(source, { keepStrings: false });
}

/** Затереть только комментарии, сохранив строки (для поиска id). */
export function stripCommentsOnly(source) {
  return stripSource(source, { keepStrings: true });
}
