'use client';

import type { FieldErrors } from 'react-hook-form';

/**
 * ─── LANDMARK: INVALID FORM UX ────────────────────────────────────────────
 * RHF умеет фокусировать первое невалидное поле, но:
 *   • кастомные контролы (Radix Select) не всегда получают фокус;
 *   • на мобильном поле может быть далеко ниже вьюпорта;
 *   • сообщение `FormMessage` видно только рядом с полем, а не там, где
 *     пользователь нажал «Создать».
 * Поэтому на невалидный submit дополнительно показываем тост с первой
 * ошибкой и прокручиваем/фокусируем первое поле с `aria-invalid="true"`.
 */

export interface FormFieldErrorInfo {
  /** Путь поля (`homeWorld`, `items.0.name`, …). */
  name: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function walkErrors(
  errors: unknown,
  prefix: string,
  out: FormFieldErrorInfo[],
): void {
  if (!errors) return;

  if (Array.isArray(errors)) {
    errors.forEach((item, index) =>
      walkErrors(item, prefix ? `${prefix}.${index}` : String(index), out),
    );
    return;
  }

  if (!isRecord(errors)) return;

  // Узел-ошибка RHF: { type, message, ref }.
  if (typeof errors.message === 'string' && errors.message.trim()) {
    out.push({ name: prefix, message: errors.message });
    return;
  }

  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref' || key === 'type' || key === 'types') continue;
    walkErrors(value, prefix ? `${prefix}.${key}` : key, out);
  }
}

/** Плоский список ошибок в порядке их появления (включая вложенные поля). */
export function collectFormErrors(
  errors: FieldErrors | undefined,
): FormFieldErrorInfo[] {
  const result: FormFieldErrorInfo[] = [];
  walkErrors(errors, '', result);
  return result;
}

/**
 * Прокрутить к первому невалидному контролу и попытаться его сфокусировать.
 * Селекторы от самого вероятного (кнопка-триггер Select) к общему случаю.
 */
export function focusFirstInvalidField(): void {
  if (typeof document === 'undefined') return;

  const selectors = [
    'button[aria-invalid="true"]',
    '[role="combobox"][aria-invalid="true"]',
    'input[aria-invalid="true"]',
    'textarea[aria-invalid="true"]',
    '[aria-invalid="true"]',
  ];

  let element: HTMLElement | null = null;
  for (const selector of selectors) {
    element = document.querySelector<HTMLElement>(selector);
    if (element) break;
  }
  if (!element) return;

  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

/**
 * Текст тоста для невалидной отправки: первая ошибка + счётчик остальных.
 * Первое поле уже подсвечено и в фокусе, поэтому описание должно быть
 * конкретным («Выберите родной мир»), а не «проверьте поля».
 */
export function buildInvalidFormAlert(
  errors: FieldErrors | undefined,
  options: { title: string; fallback: string },
): { title: string; description: string } {
  const list = collectFormErrors(errors);
  if (list.length === 0) {
    return { title: options.title, description: options.fallback };
  }
  // Только первая ошибка: остальные видны в `FormMessage` у своих полей,
  // а «(+N)» в тосте ничего не объясняет.
  return { title: options.title, description: list[0].message };
}
