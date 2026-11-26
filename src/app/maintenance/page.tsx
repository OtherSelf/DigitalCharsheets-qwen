import type { Metadata } from 'next';

import { MaintenanceView } from './maintenance-view';

/**
 * `/maintenance` — экран режима обслуживания. Сюда прокси переписывает любой
 * закрытый путь, поэтому страница обязана работать без сессии и без API.
 *
 * `noindex`: показывать поисковикам заглушку вместо сайта нельзя, иначе
 * индексы перезапишутся. Код ответа при rewrite остаётся 200 — статус 503
 * отдаёт API, а для страниц достаточно `Retry-After` в заголовках прокси.
 */
export const metadata: Metadata = {
  title: 'Maintenance — Digital Character Sheets',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <MaintenanceView />;
}
