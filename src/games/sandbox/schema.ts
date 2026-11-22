import { z, type ZodType } from 'zod';

import type { SandboxCharacter } from './types';

/**
 * Схема листа песочницы. Числовые домены ограничены (`1…99`): без `min`/`max`
 * негативный контракт (`plugin-conformance.test.ts`) принимает `stats.might:
 * 999`, и лист с невалидной характеристикой сохраняется. Границы — часть
 * контракта плагина, а не только UI. `total` ограничен суммой двух границ.
 *
 * Верхний уровень — `z.looseObject`: хост кладёт в файл служебные поля
 * (`userId`, время создания), которых нет в типе редакции. Строгая `z.object`
 * молча вырезала бы их при сохранении.
 */
export const sandboxCharacterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  systemId: z.string().optional(),
  gameSystem: z.string().optional(),
  schemaVersion: z.number().optional(),
  rank: z.string(),
  stats: z.object({
    might: z.number().min(1).max(99),
    wits: z.number().min(1).max(99),
  }),
  total: z.number().min(2).max(198),
  notes: z.string(),
  companion: z
    .looseObject({
      id: z.string().min(1),
      name: z.string(),
      kind: z.string(),
      notes: z.string(),
    })
    .optional(),
}) satisfies ZodType<SandboxCharacter>;
