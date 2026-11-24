import { notFound } from 'next/navigation';

import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';

import { docsSource } from '@/lib/docs/source';

import { DocsBackToTop } from '../docs-back-to-top';

/**
 * Одна страница документации. Маршрут ловит и `/docs`, и `/docs/<slug>`,
 * и `/docs/adr/<slug>`: корень — это `docs/README.md` с пустым slug.
 *
 * `DocsTitle` намеренно не рендерится: заголовок статьи — её собственный `# H1`
 * из markdown, поэтому на странице ровно один `h1`, а статья остаётся
 * читаемой на GitHub.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return docsSource.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = docsSource.getPage(slug ?? []);
  if (!page) return {};

  return {
    title: `${page.data.title} — Digital Character Sheets`,
    description: page.data.description,
  };
}

export default async function DocsArticlePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = docsSource.getPage(slug ?? []);
  if (!page) notFound();

  const MDX = page.data.body;
  // Заголовок статьи — её собственный `# H1`, поэтому в «На этой странице» он
  // лишний: оглавление показывает только разделы ниже первого уровня.
  const toc = page.data.toc.filter((item) => item.depth > 1);

  return (
    <DocsPage toc={toc} full={page.data.full}>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
        <DocsBackToTop />
      </DocsBody>
    </DocsPage>
  );
}
