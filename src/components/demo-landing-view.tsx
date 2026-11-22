'use client';

import { DemoLanding } from '@/components/demo-landing';
import { AppFrame } from '@/components/layout/app-frame';

/**
 * ─── LANDMARK: SHARED_DEMO_LANDING_VIEW ────────────────────────────────────
 * Гостевая главная («/» без сессии) и маршрут «/demo» показывают один и тот
 * же экран: общая шапка + демо-лендинг. Ссылка «создать персонажа» ведёт на
 * `/new`; отдельные маршруты для гостя и демо не нужны.
 *
 * Высота и скролл устроены как на остальных страницах приложения: корневой
 * layout держит html/body в 100dvh с overflow: hidden, поэтому документ сам
 * не прокручивается. Контент лендинга скроллится внутри <main>, иначе на
 * телефоне нижняя часть страницы оказывалась недоступной.
 */
export function DemoLandingView() {
  return (
    <AppFrame
      variant="demo"
      className="bg-background"
      header={{ authAction: 'login' }}
    >
      <div className="container mx-auto max-w-6xl">
        <DemoLanding createHref="/new" />
      </div>
    </AppFrame>
  );
}
