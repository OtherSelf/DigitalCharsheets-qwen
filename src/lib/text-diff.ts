/**
 * ─── LANDMARK: TEXT DIFF ───────────────────────────────────────────────────
 * Построчный diff для журнала изменений. Полные «было» и «стало» на две
 * колонки занимают экран и повторяют неизменённый текст; человеку нужны
 * только изменённые строки с небольшим контекстом.
 *
 * Алгоритм — LCS по строкам. Он детерминирован, не тянет зависимостей и
 * укладывается в лимит истории (4 000 символов на значение). Для значений
 * больше `maxLines` сравнение ограничивается первыми строками: журнал не
 * должен превращать рендер в квадратичную работу на огромном тексте.
 */

export type TextDiffLineKind = 'same' | 'add' | 'remove' | 'skip';

export interface TextDiffLine {
  kind: TextDiffLineKind;
  text: string;
  /** Для `skip` — сколько строк пропущено. */
  count?: number;
}

export interface TextDiff {
  lines: TextDiffLine[];
  /** true — сравнение шло не по всему тексту. */
  truncated: boolean;
}

export interface TextDiffOptions {
  /** Сколько неизменённых строк оставить вокруг изменения. */
  context?: number;
  /** Максимум строк каждого текста, участвующих в сравнении. */
  maxLines?: number;
}

const TEXT_DIFF_DEFAULT_CONTEXT = 2;
const TEXT_DIFF_MAX_LINES = 400;

/** Разбить текст на строки, нормализовав CRLF. */
export function splitTextLines(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split('\n');
}

function lcsOperations(
  before: readonly string[],
  after: readonly string[],
): TextDiffLine[] {
  const rows = before.length;
  const columns = after.length;
  const table: Uint32Array[] = Array.from(
    { length: rows + 1 },
    () => new Uint32Array(columns + 1),
  );

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] =
        before[row] === after[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const lines: TextDiffLine[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      lines.push({ kind: 'same', text: before[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      lines.push({ kind: 'remove', text: before[row] });
      row += 1;
    } else {
      lines.push({ kind: 'add', text: after[column] });
      column += 1;
    }
  }
  while (row < rows) {
    lines.push({ kind: 'remove', text: before[row] });
    row += 1;
  }
  while (column < columns) {
    lines.push({ kind: 'add', text: after[column] });
    column += 1;
  }
  return lines;
}

function addContext(
  lines: readonly TextDiffLine[],
  context: number,
): TextDiffLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].kind === 'same') continue;
    const from = Math.max(0, index - context);
    const to = Math.min(lines.length - 1, index + context);
    for (let nearby = from; nearby <= to; nearby += 1) keep[nearby] = true;
  }

  const result: TextDiffLine[] = [];
  let skipped = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (keep[index]) {
      if (skipped > 0) {
        result.push({ kind: 'skip', text: '', count: skipped });
        skipped = 0;
      }
      result.push(lines[index]);
    } else {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    result.push({ kind: 'skip', text: '', count: skipped });
  }
  return result;
}

/**
 * Сравнить два текста построчно. Возвращает строки с `add`/`remove` и
 * контекстом; длинные неизменённые участки свёрнуты в `skip`.
 */
export function diffTextLines(
  before: string,
  after: string,
  options: TextDiffOptions = {},
): TextDiff {
  const context = Math.max(0, options.context ?? TEXT_DIFF_DEFAULT_CONTEXT);
  const maxLines = Math.max(1, options.maxLines ?? TEXT_DIFF_MAX_LINES);

  const beforeLines = splitTextLines(before);
  const afterLines = splitTextLines(after);
  const truncated =
    beforeLines.length > maxLines || afterLines.length > maxLines;

  // Слишком длинный текст не режем по первым строкам: изменение могло быть
  // в конце, и «дифф без изменений» соврал бы. Показываем два блока целиком
  // (значение истории ограничено 4 000 символов) и помечаем truncated.
  if (truncated) {
    return {
      lines: [
        { kind: 'remove', text: before },
        { kind: 'add', text: after },
      ],
      truncated: true,
    };
  }

  const operations = lcsOperations(beforeLines, afterLines);
  if (!operations.some((line) => line.kind !== 'same')) {
    return { lines: [], truncated };
  }
  return { lines: addContext(operations, context), truncated };
}
