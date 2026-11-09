// src/app/demo/page.tsx
'use client';

import { DemoLandingView } from '@/components/demo-landing-view';

/**
 * Явный демо-маршрут: тот же экран, что гость видит на «/».
 * Отличается только назначением: «/» — домашняя страница (для вошедшего
 * пользователя это дашборд), «/demo» — всегда демо-лендинг.
 */
export default function DemoPage() {
  return <DemoLandingView />;
}
