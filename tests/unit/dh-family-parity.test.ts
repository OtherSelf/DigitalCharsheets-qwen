import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DH FAMILY PARITY ───────────────────────────────────────────
 * Редакции Dark Heresy держат независимые копии арифметики характеристик и
 * кумулятивной тренировки навыков (D10): общего `dh-shared` нет, правки
 * делаются в папке своей редакции. Плата за независимость — риск, что копии
 * незаметно разойдутся. Этот тест и есть страховка: он сравнивает поведение,
 * а не текст файлов, и пропускается, если парной редакции нет в сборке
 * (удаление игры не должно валить host-тесты).
 */

interface StatsCopy {
  STAT_UPGRADE_STEP: number;
  upgradeBonus(upgrades: readonly boolean[] | undefined | null): number;
  statTotal(
    base: number | undefined,
    upgrades: readonly boolean[] | undefined | null,
  ): number;
  statBonus(total: number | undefined): number;
}

interface TrainingCopy {
  TRAINING_KEYS: readonly string[];
  closeTraining(training?: Record<string, boolean>): Record<string, boolean>;
  toggleTraining(
    training: Record<string, boolean> | undefined,
    key: string,
    value: boolean,
  ): Record<string, boolean>;
}

interface EditionCopy {
  stats: StatsCopy;
  training: TrainingCopy;
}

async function loadEdition(id: 'dh1' | 'dh2'): Promise<EditionCopy | null> {
  try {
    const stats = (await import(`@/games/${id}/dh-stats`)) as StatsCopy;
    const training = (await import(
      `@/games/${id}/skill-training`
    )) as unknown as TrainingCopy;
    return { stats, training };
  } catch {
    return null;
  }
}

const UPGRADE_CASES: (readonly boolean[] | undefined | null)[] = [
  undefined,
  null,
  [],
  [true],
  [false, true],
  [true, false, true],
  [true, true, false, true, false],
];

const TRAINING_CASES: (Record<string, boolean> | undefined)[] = [
  undefined,
  {},
  { skilled: true },
  { plus10: true },
  { plus20: true },
  { plus30: true },
  { skilled: true, plus30: true },
  { skilled: false, plus10: false, plus20: false, plus30: true },
  { skilled: true, plus10: false, plus20: true, plus30: false },
];

describe('паритет копий DH между редакциями', () => {
  it('арифметика характеристик совпадает', async () => {
    const [dh1, dh2] = await Promise.all([
      await loadEdition('dh1'),
      await loadEdition('dh2'),
    ]);
    if (!dh1 || !dh2) {
      // Одна из редакций удалена из сборки — сравнивать нечего.
      expect(dh1 || dh2).toBeTruthy();
      return;
    }

    expect(dh2.stats.STAT_UPGRADE_STEP).toBe(dh1.stats.STAT_UPGRADE_STEP);
    for (const upgrades of UPGRADE_CASES) {
      expect(dh2.stats.upgradeBonus(upgrades)).toBe(
        dh1.stats.upgradeBonus(upgrades),
      );
      for (const base of [undefined, 0, 9, 35, 100]) {
        expect(dh2.stats.statTotal(base, upgrades)).toBe(
          dh1.stats.statTotal(base, upgrades),
        );
        expect(dh2.stats.statBonus(base)).toBe(dh1.stats.statBonus(base));
      }
    }
  });

  it('кумулятивная тренировка навыков совпадает', async () => {
    const [dh1, dh2] = await Promise.all([
      await loadEdition('dh1'),
      await loadEdition('dh2'),
    ]);
    if (!dh1 || !dh2) {
      expect(dh1 || dh2).toBeTruthy();
      return;
    }

    expect(dh2.training.TRAINING_KEYS).toEqual(dh1.training.TRAINING_KEYS);
    for (const training of TRAINING_CASES) {
      expect(dh2.training.closeTraining(training)).toEqual(
        dh1.training.closeTraining(training),
      );
      for (const key of dh1.training.TRAINING_KEYS) {
        for (const value of [true, false]) {
          expect(dh2.training.toggleTraining(training, key, value)).toEqual(
            dh1.training.toggleTraining(training, key, value),
          );
        }
      }
    }
  });

  it('у обеих редакций нет общего файла правил', async () => {
    const shared = await import('@/games/shared/defaults');
    expect(shared).toBeTruthy();
    // Путь собран строкой: модуля нет намеренно, и `tsc` не должен его искать.
    const gone = (name: string) =>
      import(/* @vite-ignore */ ['@/games', 'shared', name].join('/'));
    await expect(gone('skill-training')).rejects.toBeTruthy();
    await expect(gone('dh-stats')).rejects.toBeTruthy();
  });
});
