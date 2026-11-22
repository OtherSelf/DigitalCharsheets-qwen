import { defineConfig } from 'fumadocs-mdx/config';

import { remarkDocsLinks } from './src/lib/docs/remark-docs-links';

/**
 * Глобальные MDX-опции документации.
 *
 * Коллекция объявлена в `src/lib/docs/source.ts` через Macro API, поэтому
 * `dir` задаётся там, а здесь — только то, что применяется к каждой статье:
 * наш remark-плагин ссылок. Остальные плагины пресета Fumadocs остаются
 * включёнными: `defineConfig.mdxOptions` расширяет их, а не заменяет.
 */
export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkDocsLinks],
  },
});
