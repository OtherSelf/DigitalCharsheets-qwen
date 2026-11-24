import { describe, expect, it } from 'vitest';

import {
  interpolate,
  pluralForm,
  splitPlaceholder,
  translations,
} from '@/lib/i18n';

/**
 * Подстановка значений и формы числа. Плейсхолдеры — часть контракта словарей
 * (`{name}`, `{count}`), поэтому проверяются и сами функции, и наличие форм
 * для конкретного ключа в обеих локалях.
 */

describe('interpolate', () => {
  it('подставляет все плейсхолдеры и приводит числа к строке', () => {
    expect(interpolate('{name}: {count}', { name: 'Hero', count: 3 })).toBe(
      'Hero: 3',
    );
  });

  it('оставляет неизвестный плейсхолдер, а не вырезает его', () => {
    expect(interpolate('привет, {name}', { other: 'x' })).toBe(
      'привет, {name}',
    );
  });

  it('возвращает строку без изменений, если vars нет', () => {
    expect(interpolate('без подстановок')).toBe('без подстановок');
  });

  it('не трогает фигурные скобки без имени', () => {
    expect(interpolate('a { } b', { ' ': 'x' })).toBe('a { } b');
  });
});

describe('splitPlaceholder', () => {
  it('делит строку на две части вокруг плейсхолдера', () => {
    expect(splitPlaceholder('превью {name}!', 'name')).toEqual([
      'превью ',
      '!',
    ]);
  });

  it('без плейсхолдера возвращает всю строку и пустой хвост', () => {
    expect(splitPlaceholder('нет метки', 'name')).toEqual(['нет метки', '']);
  });
});

describe('pluralForm', () => {
  it('английский различает one/other', () => {
    expect(pluralForm('en', 1)).toBe('one');
    expect(pluralForm('en', 5)).toBe('other');
  });

  it('русский различает one/few/many', () => {
    expect(pluralForm('ru', 1)).toBe('one');
    expect(pluralForm('ru', 2)).toBe('few');
    expect(pluralForm('ru', 5)).toBe('many');
    expect(pluralForm('ru', 21)).toBe('one');
  });
});

describe('формы числа в словарях', () => {
  it('лимит вкладок имеет все формы в обеих локалях', () => {
    for (const language of ['en', 'ru'] as const) {
      for (const form of ['one', 'few', 'many', 'other']) {
        const key = `common.noteTabLimit_${form}`;
        expect(translations[language][key], `${language}: ${key}`).toBeTruthy();
      }
    }
  });
});
