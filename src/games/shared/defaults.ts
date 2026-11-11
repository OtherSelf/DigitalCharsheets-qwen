/**
 * ─── LANDMARK: DEFAULTS HELPERS ────────────────────────────────────────────
 * Маленькие безопасные читалки входа для фабрик дефолтов модулей. Вход
 * приходит из формы (значения могут быть `undefined`, строками из input) или
 * из миграции (сырой JSON), поэтому приводим типы явно и не бросаем.
 */

export type DefaultsInput = Readonly<Record<string, unknown>>;

export function readString(
  input: DefaultsInput,
  key: string,
  fallback = '',
): string {
  const value = input[key];
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(
  input: DefaultsInput,
  key: string,
  fallback = 0,
): number {
  const value = input[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function readBoolean(
  input: DefaultsInput,
  key: string,
  fallback = false,
): boolean {
  const value = input[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function readStringArray(input: DefaultsInput, key: string): string[] {
  const value = input[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
