import type { Metadata } from 'next';

import { AboutView } from '@/components/about/about-view';

/**
 * `/about` — «О проекте» (аудит PROD-1): что это, стек, версия, лицензия,
 * репозиторий, приватность данных и дисклеймер по IP.
 *
 * Страница серверная только ради метаданных: содержимое клиентское, потому что
 * берёт язык и версию из контекстов приложения (как остальные экраны).
 */
export const metadata: Metadata = {
  title: 'About — Digital Character Sheets',
  description:
    'Self-hosted character sheets for tabletop RPGs: stack, license, data storage and credits.',
};

export default function AboutPage() {
  return <AboutView />;
}
