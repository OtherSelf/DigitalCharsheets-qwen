import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { NarrativeMarkdown } from '@/components/sheets/narrative-markdown';
import { narrativeInitialMode } from '@/components/sheets/narrative-sheet';
import { listGameModules } from '@/games/registry';

import { makeCharacter } from '@tests/support';

const render = (value: string) =>
  renderToStaticMarkup(createElement(NarrativeMarkdown, { value }));

/**
 * ─── LANDMARK: NARRATIVE SHEET TESTS ───────────────────────────────────────
 * UI-слой в проекте проверяется визуальными сценариями, но два инварианта
 * заметок дёшево проверяются в Node: «умный режим» (пусто → edit, непусто →
 * view) и безопасность markdown (GFM-элементы рендерятся, сырой HTML —
 * нет).
 */
describe('NarrativeSheet: умный режим', () => {
  it('пустое значение открывается в редактирование', () => {
    expect(narrativeInitialMode('')).toBe('edit');
    expect(narrativeInitialMode('   \n\t ')).toBe('edit');
  });

  it('непустое значение открывается в просмотр', () => {
    expect(narrativeInitialMode('Коротко о походах')).toBe('view');
  });
});

describe('NarrativeMarkdown: GFM и безопасность', () => {
  it('рендерит заголовки, списки, таблицы, ссылки и код', () => {
    const html = render(
      [
        '## Походы',
        '',
        '- первый',
        '- второй',
        '',
        '| Кто | Роль |',
        '| --- | --- |',
        '| Анна | Адепт |',
        '',
        '[досье](https://example.com/dossier)',
        '',
        '`код`',
      ].join('\n'),
    );

    expect(html).toContain('<h2');
    expect(html).toContain('<ul');
    expect(html).toContain('<table');
    expect(html).toContain('href="https://example.com/dossier"');
    expect(html).toContain('<code');
  });

  it('не исполняет сырой HTML из текста игрока', () => {
    const html = render(
      '<script>alert(1)</script><img src=x onerror="alert(2)">',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror="alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

/**
 * `noteTabs` — аддитивное поле: старый лист без него валиден, а лимит 10
 * вкладок держится схемой каждой редакции, а не только UI.
 */
describe('noteTabs: схема всех редакций', () => {
  for (const gameModule of listGameModules()) {
    const base = makeCharacter(gameModule.id);
    const withTabs = {
      ...base,
      noteTabs: [{ id: 'tab-1', title: 'Tab', body: 'Text' }],
    };

    it(`${gameModule.id}: старый лист без noteTabs валиден`, () => {
      expect(gameModule.schema.safeParse(base).success).toBe(true);
    });

    it(`${gameModule.id}: принимает дополнительные вкладки`, () => {
      expect(gameModule.schema.safeParse(withTabs).success).toBe(true);
    });

    it(`${gameModule.id}: не принимает больше 10 вкладок`, () => {
      const tooMany = {
        ...base,
        noteTabs: Array.from({ length: 11 }, (_, index) => ({
          id: `tab-${index}`,
          title: 'Tab',
          body: '',
        })),
      };
      expect(gameModule.schema.safeParse(tooMany).success).toBe(false);
    });
  }
});
