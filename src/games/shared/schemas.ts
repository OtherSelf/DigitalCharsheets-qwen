import { z } from 'zod';

import {
  FIELD_LIMITS,
  idString,
  listOf,
  noteString,
  numberIn,
  shortString,
} from './limits';

/**
 * ─── LANDMARK: SHARED SCHEMAS ──────────────────────────────────────────────
 * Zod-схемы общих частей листа. Модули игр собирают из них свои схемы,
 * поэтому правила для инвентаря/квестов/ресурсов заданы в одном месте.
 *
 * `z.looseObject` (а не `z.object`) — осознанно: старые файлы могут содержать
 * поля, которых уже нет в типе, и чтение не должно их молча выбрасывать.
 * Но поля, которые схема знает, обязаны иметь тип и границы: иначе строка
 * вместо числа или отрицательный предмет доезжают до файла.
 */

export const inventoryItemSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  status: z.enum(['default', 'lost']),
  notes: noteString().optional(),
  /** Количество в строке инвентаря; отсутствует у старых листов. */
  quantity: z.number().int().min(1).max(FIELD_LIMITS.quantity).optional(),
  /** Вес строки: допускает дробные значения. */
  weight: numberIn(0, FIELD_LIMITS.weight).optional(),
  /** Цена строки в целых тронах; DH2 колонку не ведёт. */
  price: z.number().int().min(0).max(FIELD_LIMITS.money).optional(),
});

export const combatResourceSchema = z.looseObject({
  id: idString(),
  description: shortString(),
  current: z.number().int().min(0).max(FIELD_LIMITS.pool),
  max: z.number().int().min(0).max(FIELD_LIMITS.pool),
  notes: noteString().optional(),
});

export const questObjectiveSchema = z.looseObject({
  id: idString(),
  text: z.string().max(FIELD_LIMITS.note),
  completed: z.boolean(),
});

export const questSchema = z.looseObject({
  id: idString(),
  title: z.string().max(FIELD_LIMITS.name),
  status: z.enum(['active', 'completed']),
  description: z.string().max(FIELD_LIMITS.long),
  createdAt: z.string().max(64),
  updatedAt: z.string().max(64),
  priority: z.enum(['main', 'side', 'personal']).optional(),
  notes: noteString().optional(),
  rewards: z.string().max(FIELD_LIMITS.note).optional(),
  npcs: z.string().max(FIELD_LIMITS.note).optional(),
  locations: z.string().max(FIELD_LIMITS.note).optional(),
  objectives: listOf(questObjectiveSchema, 100).optional(),
});
