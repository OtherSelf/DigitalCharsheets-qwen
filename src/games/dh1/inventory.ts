import type { InventoryItem } from './types';

/**
 * ─── LANDMARK: DH1 INVENTORY DEFAULTS ──────────────────────────────────────
 * Чтение полей предмета с умолчаниями для старых листов.
 *
 * Нормализация намеренно не дописывает отсутствующие `quantity`/`status` в
 * файл: лист, открытый без правок, не должен переписываться. Значения по
 * умолчанию подставляются на чтении, а записываются только если игрок
 * действительно сохранил строку.
 */

/** Количество по умолчанию: у старых листов его нет. */
export const DEFAULT_ITEM_QUANTITY = 1;

/** Целое количество не меньше единицы; мусор и отсутствие — 1. */
export function readQuantity(item: InventoryItem): number {
  const value = item.quantity;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_ITEM_QUANTITY;
  }
  const rounded = Math.trunc(value);
  return rounded >= DEFAULT_ITEM_QUANTITY ? rounded : DEFAULT_ITEM_QUANTITY;
}

/** `lost` — единственный статус; всё остальное считается «в наличии». */
export function readStatus(item: InventoryItem): 'default' | 'lost' {
  return item.status === 'lost' ? 'lost' : 'default';
}

/** Вес строки: число >= 0 или «не задано». */
export function readWeight(item: InventoryItem): number | undefined {
  const value = item.weight;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

/** Цена строки в целых тронах: неотрицательное число или «не задано». */
export function readPrice(item: InventoryItem): number | undefined {
  const value = item.price;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

/** Суммы колонок: только предметы «в наличии». */
export interface InventoryTotals {
  weight: number;
  price: number;
}

/**
 * Итоги инвентаря: вес и цена по строкам без `lost`.
 *
 * `weight` и `price` — «за единицу»: итог умножается на `readQuantity`.
 * Старые листы не мигрируются, количество подставляется на чтении (D6);
 * пустые вес/цена считаются нулём, чтобы сумма не зависела от заполнения.
 */
export function inventoryTotals(
  items: readonly InventoryItem[],
): InventoryTotals {
  let weight = 0;
  let price = 0;
  for (const item of items) {
    if (readStatus(item) === 'lost') continue;
    const quantity = readQuantity(item);
    weight += (readWeight(item) ?? 0) * quantity;
    price += (readPrice(item) ?? 0) * quantity;
  }
  return { weight, price };
}
