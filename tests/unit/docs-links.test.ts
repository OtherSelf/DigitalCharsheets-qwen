import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { remarkDocsLinks } from '@/lib/docs/remark-docs-links';

/**
 * ─── LANDMARK: DOCS LINK REWRITE ────────────────────────────────────────────
 * В `docs/*.md` две породы относительных ссылок, которые в браузере не
 * работают: на исходники (`../src/...`) и между статьями (`api.md`,
 * `../data-storage.md` из ADR). Плагин решает судьбу каждой: код, внутренний
 * `/docs/<slug>` или «не трогать». Тест гоняет сам плагин на синтетическом
 * дереве — без сборки MDX и без нового публичного API.
 */

const DOCS = path.join(process.cwd(), 'docs');
const transform = remarkDocsLinks();

interface Node {
  type: string;
  url?: string;
  value?: string;
  children?: Node[];
}

interface Tree {
  type: string;
  children: Node[];
}

function transformLink(href: string, page = 'api.md'): Node {
  const tree: Tree = {
    type: 'root',
    children: [
      {
        type: 'link',
        url: href,
        children: [{ type: 'inlineCode', value: href }],
      },
    ],
  };
  transform(tree, {
    path: path.join(DOCS, page),
  });
  return tree.children[0];
}

describe('docs: относительные ссылки статей', () => {
  it('ссылка на исходники становится кодом', () => {
    expect(transformLink('../src/lib/session.ts')).toEqual({
      type: 'inlineCode',
      value: '../src/lib/session.ts',
    });
  });

  it('корневой README и CHANGELOG — тоже код', () => {
    expect(transformLink('../README.md', 'README.md')).toEqual({
      type: 'inlineCode',
      value: '../README.md',
    });
    expect(transformLink('../CHANGELOG.md', 'development.md')).toEqual({
      type: 'inlineCode',
      value: '../CHANGELOG.md',
    });
  });

  it('статья из той же папки переписывается в /docs с якорем', () => {
    expect(
      transformLink('data-storage.md#legacy-data', 'architecture.md'),
    ).toEqual(
      expect.objectContaining({
        type: 'link',
        url: '/docs/data-storage#legacy-data',
      }),
    );
  });

  it('ссылка из ADR на статью выше по дереву остаётся внутренней', () => {
    expect(
      transformLink(
        '../data-storage.md',
        'adr/0001-credentials-and-sessions.md',
      ),
    ).toEqual(
      expect.objectContaining({ type: 'link', url: '/docs/data-storage' }),
    );
  });

  it('ссылка на README — корень /docs', () => {
    expect(transformLink('README.md', 'architecture.md')).toEqual(
      expect.objectContaining({ type: 'link', url: '/docs' }),
    );
  });

  it('внешние ссылки, абсолютные пути и якоря не трогаем', () => {
    for (const href of [
      'https://example.com/doc',
      'mailto:dev@example.com',
      '/api/docs',
      '#overview',
    ]) {
      expect(transformLink(href)).toEqual(
        expect.objectContaining({ type: 'link', url: href }),
      );
    }
  });
});
