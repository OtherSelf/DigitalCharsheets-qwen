/**
 * ─── LANDMARK: DOCS UI TRANSLATIONS ─────────────────────────────────────────
 * Подписи оболочки Fumadocs (поиск, «на этой странице», prev/next, меню) живут
 * не в пакете, а в нашем словаре: ключи `docs.*` есть в обеих локалях. Здесь
 * они перекладываются в формат `I18nProvider` Fumadocs, который ключуется
 * английской строкой-оригиналом.
 *
 * Контент документации остаётся английским (правило `docs/README.md`), поэтому
 * переводятся только элементы управления, а не статьи.
 */
export function docsUiTranslations(
  t: (key: string) => string,
): Record<string, string> {
  return {
    'Search(search dialog)': t('docs.search'),
    'Search(search trigger)': t('docs.search'),
    'Open Search(search trigger)(aria-label)': t('docs.openSearch'),
    'Close Search(search dialog)(aria-label)': t('docs.closeSearch'),
    'On this page(table of contents)': t('docs.onThisPage'),
    'No Headings(table of contents)': t('docs.noHeadings'),
    'Table of Contents(inline table of contents)': t('docs.tableOfContents'),
    'Previous Page(pagination)': t('docs.previousPage'),
    'Next Page(pagination)': t('docs.nextPage'),
    'Open Sidebar(sidebar)(aria-label)': t('docs.openSidebar'),
    'Close Sidebar(sidebar)(aria-label)': t('docs.closeSidebar'),
    'No results found(search dialog)': t('docs.noResults'),
    'Search failed(search dialog)': t('docs.searchFailed'),
    'Skip to Content(skip link)': t('docs.skipToContent'),
  };
}
