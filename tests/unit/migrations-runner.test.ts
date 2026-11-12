import { describe, expect, it } from 'vitest';

import type { CharacterMigration } from '@/games/types';
import { applyCharacterMigrations } from '@/lib/character-version';

/**
 * ─── LANDMARK: MIGRATIONS RUNNER TESTS ────────────────────────────────────
 * Хост применяет цепочку миграций плагина по порядку массива и только к
 * файлам, которые старше шага (`schemaVersion < step.to`). Неизвестная
 * будущая версия не перезаписывается — её отсекает normalizeCharacterRecord.
 */

const steps: CharacterMigration[] = [
  {
    from: 1,
    to: 2,
    migrate: (raw) => ({ ...raw, step2: true, v: 2 }),
  },
  {
    from: 2,
    to: 3,
    migrate: (raw) => ({ ...raw, step3: true, v: 3 }),
  },
];

describe('цепочка миграций плагина', () => {
  it('применяет шаги по порядку до целевой версии', () => {
    const result = applyCharacterMigrations(steps, { v: 1 }, 0);
    expect(result.applied).toBe(2);
    expect(result.character).toMatchObject({ v: 3, step2: true, step3: true });
  });

  it('не применяет шаги, которые файл уже прошёл', () => {
    const result = applyCharacterMigrations(steps, { v: 2, step2: true }, 2);
    expect(result.applied).toBe(1);
    expect(result.character).toMatchObject({ v: 3, step3: true });
    expect((result.character as Record<string, unknown>).step2).toBe(true);
  });

  it('актуальный лист не меняется', () => {
    const raw = { v: 3, step2: true, step3: true };
    const result = applyCharacterMigrations(steps, raw, 3);
    expect(result.applied).toBe(0);
    expect(result.character).toEqual(raw);
  });

  it('идемпотентность: повторный прогон не добавляет шагов', () => {
    const first = applyCharacterMigrations(steps, { v: 1 }, 0);
    const second = applyCharacterMigrations(steps, first.character, 3);
    expect(second.applied).toBe(0);
    expect(second.character).toEqual(first.character);
  });

  it('пустая цепочка — no-op', () => {
    const result = applyCharacterMigrations([], { v: 1 }, 0);
    expect(result.applied).toBe(0);
    expect(result.character).toEqual({ v: 1 });
  });
});
