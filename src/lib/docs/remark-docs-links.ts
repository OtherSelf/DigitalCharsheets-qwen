import path from 'node:path';

/**
 * ─── LANDMARK: DOCS LINKS ────────────────────────────────────────────────────
 * В `docs/*.md` две породы относительных ссылок, которые в браузере не работают:
 *
 *   1. ссылки на код — [`src/lib/session.ts`](../src/lib/session.ts). В вебе
 *      `../src` недостижим: приложение не раздаёт исходники. Такую ссылку
 *      показываем кодом, без `href`.
 *   2. ссылки между статьями — `[api.md](api.md)`, `[data-storage.md](../data-storage.md)`
 *      из ADR. Адрес статьи в приложении другой (`/docs/api`), поэтому
 *      переписываем его, сохраняя якорь.
 *
 * Источник истины — сами файлы: плагин работает на билде, `docs/*.md` не
 * правятся. Всё, что начинается со схемы (`https:`, `mailto:`), с `/` или `#`,
 * остаётся как есть.
 */

interface DocsLinkNode {
  type: string;
  url?: string;
  value?: string;
  children?: DocsLinkNode[];
}

export type DocsHrefResolution =
  /** Ссылка на другую статью документации: новый адрес в приложении. */
  | { kind: 'docs'; url: string }
  /** Ссылка за пределы `docs/` (исходники, корневой README): показываем кодом. */
  | { kind: 'code'; text: string }
  /** Внешняя ссылка, абсолютный путь или якорь: не трогаем. */
  | { kind: 'keep' };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function splitAnchor(href: string): { pathPart: string; anchor: string } {
  const hash = href.indexOf('#');
  if (hash < 0) return { pathPart: href, anchor: '' };
  return { pathPart: href.slice(0, hash), anchor: href.slice(hash + 1) };
}

/**
 * Решает судьбу одного `href`. Отдельная функция — чтобы правило было
 * очевидным; проверяется через сам плагин, без MDX-сборки.
 */
function resolveDocsHref(
  href: string,
  filePath: string,
  docsRoot = path.resolve(process.cwd(), 'docs'),
): DocsHrefResolution {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return { kind: 'keep' };
  if (trimmed.startsWith('/') || SCHEME.test(trimmed)) return { kind: 'keep' };

  const { pathPart, anchor } = splitAnchor(trimmed);
  if (!pathPart) return { kind: 'keep' };

  const absoluteFile = path.resolve(filePath);
  const target = path.resolve(path.dirname(absoluteFile), pathPart);
  const relative = path.relative(docsRoot, target);

  // Цель вне docs/ или не markdown — значит это путь к коду/файлу репозитория.
  if (
    !relative ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !relative.endsWith('.md')
  ) {
    return { kind: 'code', text: pathPart };
  }

  const article = relative.slice(0, -'.md'.length).split(path.sep).join('/');
  const url =
    article === 'README' ? '/docs' : `/docs/${article.replace(/\/README$/, '')}`;
  return { kind: 'docs', url: anchor ? `${url}#${anchor}` : url };
}

function plainText(node: DocsLinkNode): string {
  if (node.type === 'inlineCode' || node.type === 'text') {
    return node.value ?? '';
  }
  return (node.children ?? []).map(plainText).join('');
}

function rewrite(node: DocsLinkNode, filePath: string, docsRoot: string): void {
  const children = node.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.type === 'link' && child.url) {
      const resolution = resolveDocsHref(child.url, filePath, docsRoot);
      if (resolution.kind === 'docs') {
        child.url = resolution.url;
      } else if (resolution.kind === 'code') {
        // Текст ссылки обычно уже обёрнут в `code`; если нет — берём путь.
        const text = plainText(child) || resolution.text;
        children[index] = { type: 'inlineCode', value: text };
      }
      continue;
    }
    rewrite(child, filePath, docsRoot);
  }
}

/** Remark-плагин: переписывает относительные ссылки статьи (см. выше). */
export function remarkDocsLinks() {
  return (tree: DocsLinkNode, file?: { path?: string }): void => {
    if (!file?.path) return;
    rewrite(tree, path.resolve(file.path), path.resolve(process.cwd(), 'docs'));
  };
}
