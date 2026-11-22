/**
 * ─── LANDMARK: FIELD EDIT POLICY ───────────────────────────────────────────
 * Классификация полей листа после создания:
 *
 *   • `descriptive`   — имя, возраст, цвет волос/глаз, заметки: редактируются
 *     всегда;
 *   • `creation-empty` — homeWorld/worldVariant/careerPath/divination/gender:
 *     контрол только пока поле пустое; заполненное read-only, смена —
 *     пересозданием;
 *   • `mechanical`    — характеристики, навыки, счётчики: их поведение не
 *     меняется.
 *
 * Заполнение пустого поля только записывает его: производные (вариант мира,
 * ранг карьеры) не пересчитываются, чтобы не тронуть купленную механику.
 */

/**
 * «Задано» значит непустое: пустая строка/пробелы/пустой массив/undefined —
 * ещё не выбрано. Ноль и строка `'0'` считаются заданными значениями.
 */
export function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * `creation-empty` поле заблокировано, как только в нём есть значение:
 * UI показывает read-only и подсказку «выбрано при создании».
 */
export function isCreationFieldLocked(value: unknown): boolean {
  return isFieldFilled(value);
}
