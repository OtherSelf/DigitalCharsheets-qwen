import { GENDER_CODES, type GenderCode } from './types';

/**
 * ─── LANDMARK: DH2 GENDER ────────────────────────────────────────────────
 * Пол 2e хранится каноническим кодом (`DH2Character.gender`): правила
 * элитных продвижений (Сестра Битвы требует female) сравнивают код, а не
 * локализованную подпись, поэтому смена языка листа проверку не ломает (D3).
 */

type Translate = (key: string) => string;

/** Старые подписи пола, которые встречаются в листах до schemaVersion 5. */
const LEGACY_GENDER_LABELS: Readonly<Record<string, GenderCode>> = {
  мужчина: 'male',
  мужской: 'male',
  муж: 'male',
  м: 'male',
  male: 'male',
  man: 'male',
  m: 'male',
  женщина: 'female',
  женский: 'female',
  жен: 'female',
  ж: 'female',
  female: 'female',
  woman: 'female',
  f: 'female',
  'не указан': 'unspecified',
  'не указана': 'unspecified',
  'не указано': 'unspecified',
  'не определено': 'unspecified',
  'не определен': 'unspecified',
  unspecified: 'unspecified',
  'not specified': 'unspecified',
  unknown: 'unspecified',
};

const GENDER_CODE_SET = new Set<string>(GENDER_CODES);

export function isGenderCode(value: unknown): value is GenderCode {
  return typeof value === 'string' && GENDER_CODE_SET.has(value);
}

/** Код из значения без миграции: всё, что не код, становится `''`. */
export function toGenderCode(value: unknown): GenderCode {
  return isGenderCode(value) ? value : '';
}

export interface GenderResolution {
  code: GenderCode;
  /** Неизвестный непустой текст: вызывающий дописывает его в `notes`. */
  legacyText?: string;
}

/**
 * Перевод legacy-подписи в код. Идемпотентно: код проходит как есть, пустое
 * остаётся `''`, неизвестный непустой текст становится `unspecified` и
 * возвращается, чтобы не потерять данные игрока.
 */
export function resolveGender(value: unknown): GenderResolution {
  if (isGenderCode(value)) return { code: value };
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { code: '' };
  const mapped = LEGACY_GENDER_LABELS[text.toLowerCase()];
  return mapped ? { code: mapped } : { code: 'unspecified', legacyText: text };
}

/** Подпись кода для UI и Excel: сырой код наружу не показываем. */
export function genderLabel(code: GenderCode | string, t: Translate): string {
  switch (code) {
    case 'male':
      return t('dh2.genderMale');
    case 'female':
      return t('dh2.genderFemale');
    case 'unspecified':
      return t('dh2.genderUnspecified');
    default:
      return '';
  }
}

/** Варианты выбора пола: в значении код, в подписи — словарь. */
export function genderOptions(
  t: Translate,
): readonly { value: GenderCode; label: string }[] {
  return (['male', 'female', 'unspecified'] as const).map((code) => ({
    value: code,
    label: genderLabel(code, t),
  }));
}
