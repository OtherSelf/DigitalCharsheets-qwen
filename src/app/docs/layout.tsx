import type { Metadata } from 'next';

import { docsSource } from '@/lib/docs/source';

import './docs.css';

import { DocsLayoutShell } from './docs-shell';

/**
 * ─── LANDMARK: DOCS LAYOUT (/docs) ──────────────────────────────────────────
 * Оболочка документации: тот же Next-процесс, что и приложение, но со своим
 * сайдбаром, оглавлением и поиском. Контент — существующие `docs/*.md`
 * (см. `src/lib/docs/source.ts`), поэтому обновление статьи в git сразу
 * обновляет страницу.
 *
 * Метаданные раздела заданы здесь; заголовок и описание конкретной статьи
 * приходят из её frontmatter в `page.tsx`.
 */
export const metadata: Metadata = {
  title: 'Documentation — Digital Character Sheets',
  description:
    'Engineering documentation: architecture, storage, HTTP API, plugin SDK, testing and deployment.',
};

export default function DocsRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DocsLayoutShell tree={docsSource.getPageTree()}>{children}</DocsLayoutShell>;
}
