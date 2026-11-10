/**
 * ─── LANDMARK: NEXT.JS INSTRUMENTATION ──────────────────────────────────────
 * Next.js вызывает `register()` один раз при старте серверного процесса
 * (dev и production). Здесь выполняется стартовая проверка данных:
 *   • недостающие поля в `users/<uid>/user.json` (шаблон v3);
 *   • пересборка индекса логинов;
 *   • создание служебного администратора, если активных админов нет.
 *
 * Подробности и отчёт — в `src/lib/startup.ts`. На Edge-рантайме (если он
 * когда-нибудь понадобится) файловых операций нет, поэтому шаг пропускается.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { runStartupMaintenance } = await import('./lib/startup');
  runStartupMaintenance();
}
