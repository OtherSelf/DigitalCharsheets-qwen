import { describe, expect, it } from 'vitest';

import { diffTextLines, splitTextLines } from '@/lib/text-diff';

/**
 * Построчный diff: изменённые строки, контекст и свёрнутые неизменённые
 * участки. Текст приходит из журнала истории, поэтому проверяются и CRLF,
 * и лимит строк.
 */
describe('splitTextLines', () => {
  it('нормализует CRLF и сохраняет пустые строки', () => {
    expect(splitTextLines('a\r\nb\r\n\r\nc')).toEqual(['a', 'b', '', 'c']);
    expect(splitTextLines('')).toEqual(['']);
  });
});

describe('diffTextLines', () => {
  it('показывает добавленную и удалённую строки с контекстом', () => {
    const result = diffTextLines(
      ['один', 'два', 'три'].join('\n'),
      ['один', 'два изменено', 'три'].join('\n'),
    );

    expect(result.truncated).toBe(false);
    expect(result.lines).toEqual([
      { kind: 'same', text: 'один' },
      { kind: 'remove', text: 'два' },
      { kind: 'add', text: 'два изменено' },
      { kind: 'same', text: 'три' },
    ]);
  });

  it('свёртывает длинный неизменённый участок', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n');
    const after = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h!'].join('\n');

    const result = diffTextLines(before, after, { context: 1 });

    expect(result.lines[0]).toEqual({ kind: 'skip', text: '', count: 6 });
    expect(result.lines).toContainEqual({ kind: 'remove', text: 'h' });
    expect(result.lines).toContainEqual({ kind: 'add', text: 'h!' });
  });

  it('возвращает пустой список для одинакового текста', () => {
    expect(diffTextLines('a\nb', 'a\nb')).toEqual({
      lines: [],
      truncated: false,
    });
  });

  it('обрезает сравнение по maxLines', () => {
    const before = Array.from({ length: 10 }, (_, index) => `a${index}`).join(
      '\n',
    );
    const after = `${before}\nnew`;

    const result = diffTextLines(before, after, { maxLines: 5 });

    expect(result.truncated).toBe(true);
    expect(result.lines).toEqual([
      { kind: 'remove', text: before },
      { kind: 'add', text: after },
    ]);
  });
});
