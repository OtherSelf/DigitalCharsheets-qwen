'use client';

import { useFetchSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';

/**
 * ─── LANDMARK: DOCS SEARCH ───────────────────────────────────────────
 * Поиск по документации без внешних сервисов.
 *
 * Индекс живёт на сервере (`/api/search`, обработчик `createFromSource`), в
 * браузер уходят только совпадения и только со своего origin. Поэтому поиск
 * работает в закрытом контуре, но, в отличие от «DevTools offline», ему нужен
 * доступ к самому приложению: клиентского индекса в бандле нет сознательно.
 *
 * Подписи приходят из `I18nProvider` (ключи `docs.*`), поэтому диалог не
 * содержит английских строк.
 */
export function DocsSearchDialog(props: SharedProps) {
  const search = useFetchSearch();

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
