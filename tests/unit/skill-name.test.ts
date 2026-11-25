import { describe, expect, it } from 'vitest';

import { splitSkillName } from '@/games/shared/skill-name';

/**
 * ─── LANDMARK: SKILL NAME PARTS TESTS ─────────────────────────────────────
 * Разбор названия умения нужен, чтобы старые листы с `Акробатика (Лов)`
 * показывали характеристику отдельной колонкой. Ошибка здесь либо съедает
 * часть названия, либо приписывает умению чужую характеристику, поэтому
 * проверяются обе стороны: что считается суффиксом и что — частью имени.
 */
describe('splitSkillName', () => {
  it('отделяет аббревиатуру характеристики', () => {
    expect(splitSkillName('Акробатика (Лов)')).toEqual({
      name: 'Акробатика',
      suffix: 'Лов',
    });
    expect(splitSkillName('Awareness (Per)')).toEqual({
      name: 'Awareness',
      suffix: 'Per',
    });
  });

  it('сохраняет сокращение с точкой', () => {
    expect(splitSkillName('Логика (Инт.)')).toEqual({
      name: 'Логика',
      suffix: 'Инт.',
    });
  });

  it('берёт последнюю короткую скобку у составного названия', () => {
    expect(splitSkillName('Навигация (Наземная) (Инт)')).toEqual({
      name: 'Навигация (Наземная)',
      suffix: 'Инт',
    });
  });

  it('не трогает скобки, которые являются частью названия', () => {
    const name = 'Язык (Низкий Готик)';
    expect(splitSkillName(name)).toEqual({ name, suffix: null });
    expect(splitSkillName('Навигация (Наземная)')).toEqual({
      name: 'Навигация (Наземная)',
      suffix: null,
    });
  });

  it('оставляет имя без скобок как есть', () => {
    expect(splitSkillName('  Бдительность  ')).toEqual({
      name: 'Бдительность',
      suffix: null,
    });
    expect(splitSkillName('')).toEqual({ name: '', suffix: null });
  });

  it('не считает суффиксом пустые или слишком длинные скобки', () => {
    expect(splitSkillName('Навык ()')).toEqual({
      name: 'Навык ()',
      suffix: null,
    });
    const long = 'Учёное Знание (Запретные знания)';
    expect(splitSkillName(long)).toEqual({ name: long, suffix: null });
  });
});
