import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';

/**
 * ─── LANDMARK: DOCS SOURCE ───────────────────────────────────────────────────
 * Единственный вход в документацию приложения. Коллекция читает существующий
 * `docs/` в корне репозитория: копии контента нет, правка статьи — правка
 * страницы `/docs` (это же условие держит `npm run docs:check`).
 *
 * Порядок страниц задаёт `docs/meta.json`, который генерируется из карты в
 * `docs/README.md` (`scripts/docs/meta.mjs`), поэтому второй список страниц
 * здесь не заводится.
 *
 * Корень `/docs` — сам `docs/README.md`: у него пустой slug, иначе карта
 * оказалась бы на `/docs/readme`, а корень — пустым. Остальные статьи получают
 * slug из пути файла (ADR — `adr/<имя>`).
 */
const docs = defineDocs({
  dir: 'docs',
});

const README_PATHS = new Set(['README.md', 'docs/README.md']);

export const docsSource = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  slugs(file, next) {
    return README_PATHS.has(file.path) ? [] : next();
  },
});
