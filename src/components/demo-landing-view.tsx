'use client';

import { DemoLanding } from '@/components/demo-landing';
import { Header } from '@/components/header';
import { AppVersion } from '@/components/layout/app-version';

/**
 * ─── LANDMARK: SHARED_DEMO_LANDING_VIEW ────────────────────────────────────
 * Гостевая главная («/» без сессии) и маршрут «/demo» показывают один и тот
 * же экран: общая шапка + демо-лендинг. Раньше разметка дублировалась в двух
 * страницах, а ссылка «создать персонажа» вела на разные маршруты
 * (/new/manual и /new).
 *
 * Высота и скролл устроены как на остальных страницах приложения: корневой
 * layout держит html/body в 100dvh с overflow: hidden, поэтому документ сам
 * не прокручивается. Контент лендинга скроллится внутри <main>, иначе на
 * телефоне нижняя часть страницы оказывалась недоступной.
 */
export function DemoLandingView() {
  return (
    <div className="bg-background flex h-dvh flex-col">
      <Header authAction="login" />

      <main className="safe-area-bottom flex-1 overflow-y-auto px-4 py-8 pb-20">
        <div className="container mx-auto max-w-6xl">
          <DemoLanding createHref="/new" />
          <div className="mt-8 flex justify-center">
            <AppVersion />
          </div>
        </div>
      </main>
    </div>
  );
}
