/**
 * ─── LANDMARK: DH1 DATA PACK ───────────────────────────────────────────────
 * Ключи локализации пророчеств редакции Dark Heresy 1, живущие внутри плагина
 * (решение D10). Это осознанная копия `src/lib/divination-i18n.ts`:
 * редакции считаются разными, даже если сейчас содержимое совпадает, —
 * правки dh1 не должны менять dh2, и наоборот.
 * Общего data-плагина нет.
 */
import {
  DIVINATION_BY_ID,
  DIVINATION_ID_BY_TEXT,
  EFFECT_ID_BY_TEXT,
} from './dark-heresy-data';

/**
 * ─── LANDMARK: DIVINATION I18N ──────────────────────────────────────────────
 * Пророчества и эффекты хранятся в персонаже как стабильные ID
 * (`mutationWithout`, `insanity2`), а не как английские фразы. Для старых
 * файлов/экспортов оставлены маппинги sentence → ID: миграция переводит их в
 * ID, а UI умеет показать неизвестное кастомное значение как есть.
 */
export function divinationKey(id: string, prefix = 'dh'): string {
  return `${prefix}.data.divination.${id}`;
}

export function divinationEffectKey(id: string, prefix = 'dh'): string {
  return `${prefix}.data.divinationEffect.${id}`;
}

export function resolveDivinationId(value: string | null | undefined): string {
  if (!value) return '';
  if (DIVINATION_BY_ID[value]) return value;
  return DIVINATION_ID_BY_TEXT[value] ?? '';
}

export function resolveDivinationEffectId(
  value: string | null | undefined,
): string {
  if (!value) return '';
  if (value.startsWith('dh.data.divinationEffect.')) {
    return value.slice('dh.data.divinationEffect.'.length);
  }
  return EFFECT_ID_BY_TEXT[value] ?? value;
}

export function effectIdForDivination(divinationId: string): string {
  return DIVINATION_BY_ID[divinationId]?.effectId ?? '';
}

export function divinationLabel(
  value: string | null | undefined,
  t: (key: string) => string,
  prefix = 'dh',
): string {
  if (!value) return '';
  const id = resolveDivinationId(value);
  return id ? t(divinationKey(id, prefix)) : value;
}

export function divinationEffectLabel(
  value: string | null | undefined,
  t: (key: string) => string,
  prefix = 'dh',
): string {
  if (!value) return '';
  const id = resolveDivinationEffectId(value);
  const known = id
    ? Object.values(DIVINATION_BY_ID).some((d) => d.effectId === id)
    : false;
  return known ? t(divinationEffectKey(id, prefix)) : value;
}
