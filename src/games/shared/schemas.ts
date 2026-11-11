import { z } from 'zod';

/**
 * ─── LANDMARK: SHARED SCHEMAS ──────────────────────────────────────────────
 * Zod-схемы общих частей листа. Модули игр собирают из них свои схемы,
 * поэтому правила для инвентаря/квестов/ресурсов заданы в одном месте.
 *
 * `z.looseObject` (а не `z.object`) — осознанно: старые файлы могут содержать
 * поля, которых уже нет в типе, и чтение не должно их молча выбрасывать.
 */

export const inventoryItemSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  status: z.enum(['default', 'lost']),
  notes: z.string().optional(),
});

export const combatResourceSchema = z.looseObject({
  id: z.string(),
  description: z.string(),
  current: z.number(),
  max: z.number(),
  notes: z.string().optional(),
});

export const questObjectiveSchema = z.looseObject({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

export const questSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed']),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  priority: z.enum(['main', 'side', 'personal']).optional(),
  notes: z.string().optional(),
  rewards: z.string().optional(),
  npcs: z.string().optional(),
  locations: z.string().optional(),
  objectives: z.array(questObjectiveSchema).optional(),
});

/**
 * Схема конверта листа: минимальный набор, по которому ядро отличает
 * редакцию и версию файла. Используется серверными маршрутами создания и
 * импорта до полной валидации полей модулем.
 */
export const characterEnvelopeSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  systemId: z.string().min(1).optional(),
  schemaVersion: z.number().int().nonnegative().optional(),
});
