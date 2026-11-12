import { z, type ZodType } from 'zod';

import type { ExampleCharacter } from './types';

export const exampleCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemId: z.string().optional(),
  gameSystem: z.string().optional(),
  schemaVersion: z.number().optional(),
  rank: z.string(),
  stats: z.object({ might: z.number(), wits: z.number() }),
  notes: z.string(),
}) satisfies ZodType<ExampleCharacter>;
