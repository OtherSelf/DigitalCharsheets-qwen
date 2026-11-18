import { z, type ZodType } from 'zod';

import type { ExampleCharacter } from './types';

/**
 * Схема листа фикстуры. Числовые домены ограничены (`1…99`): без `min`/`max`
 * негативный контракт (`plugin-conformance.test.ts`) принимает `stats.might:
 * 999`, и лист с невалидной характеристикой сохраняется. Границы — часть
 * контракта плагина, а не только UI.
 */
export const exampleCharacterSchema = z.object({
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
  notes: z.string(),
}) satisfies ZodType<ExampleCharacter>;
