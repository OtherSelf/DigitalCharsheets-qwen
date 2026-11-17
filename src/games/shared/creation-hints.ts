/**
 * ─── LANDMARK: CREATION HINTS MARKER ──────────────────────────────────────
 * Скрытый маркер блока подсказок в `notes`. Нужен, чтобы лист после создания
 * один раз открыл «Заметки» только тогда, когда там действительно памятка, а
 * не пользовательский текст. HTML-комментарий markdown-рендер не показывает.
 */
export const CREATION_HINTS_MARKER = 'digital-charsheets:creation-hints';

export function creationHintsComment(): string {
  return `<!-- ${CREATION_HINTS_MARKER} -->`;
}

export function hasCreationHints(notes: unknown): boolean {
  return typeof notes === 'string' && notes.includes(CREATION_HINTS_MARKER);
}
