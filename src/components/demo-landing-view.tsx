'use client';

import { DemoLanding } from '@/components/demo-landing';
import { Header } from '@/components/header';

/**
 * ─── LANDMARK: SHARED_DEMO_LANDING_VIEW ────────────────────────────────────
 * Гостевая главная («/» без сессии) и маршрут «/demo» показывают один и тот
 * же экран: общая шапка + демо-лендинг. Раньше разметка дублировалась в двух
 * страницах, а ссылка «создать персонажа» вела на разные маршруты
 * (/new/manual и /new).
 */
export function DemoLandingView() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header authAction="login" />

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-8 pb-20">
        <DemoLanding createHref="/new" />
      </main>
    </div>
  );
}
