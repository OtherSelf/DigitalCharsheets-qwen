import { describe, expect, it } from 'vitest';

import { closeTraining, toggleTraining } from '@/games/dh1/skill-training';

/**
 * Кумулятивность тренировки: `+10` без «Умелый» не существует. `closeTraining`
 * нормализует присланные данные по самому высокому флагу, а `toggleTraining`
 * гасит последующие уровни при снятии — иначе клик по нижнему уровню при
 * отмеченном верхнем не менял бы ничего.
 */
const NONE = { skilled: false, plus10: false, plus20: false, plus30: false };

describe('closeTraining', () => {
  it('поднимает предыдущие уровни', () => {
    expect(closeTraining({ plus20: true })).toEqual({
      skilled: true,
      plus10: true,
      plus20: true,
      plus30: false,
    });
  });

  it('гасит разрывы', () => {
    expect(closeTraining({ skilled: true, plus30: true })).toEqual({
      skilled: true,
      plus10: true,
      plus20: true,
      plus30: true,
    });
  });
});

describe('toggleTraining', () => {
  it('включение уровня поднимает предыдущие', () => {
    expect(toggleTraining(NONE, 'plus10', true)).toEqual({
      skilled: true,
      plus10: true,
      plus20: false,
      plus30: false,
    });
  });

  it('снятие уровня гасит его и все последующие', () => {
    expect(
      toggleTraining(
        { skilled: true, plus10: true, plus20: true, plus30: true },
        'plus10',
        false,
      ),
    ).toEqual({ skilled: true, plus10: false, plus20: false, plus30: false });
  });

  it('снятие «Умелый» гасит всю лестницу', () => {
    expect(
      toggleTraining({ skilled: true, plus10: true }, 'skilled', false),
    ).toEqual(NONE);
  });
});
