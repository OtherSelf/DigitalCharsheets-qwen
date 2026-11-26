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
 *
 * Здесь же — суточный таймер очистки корзины: без него просроченные копии
 * удалялись только на старте и при открытии архива, а политика обещает
 * уничтожение в срок (14 дней корзины, не более 30 дней на уничтожение).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Битый `DCS_TOTP_KEY` должен падать на старте, а не при первом входе
  // пользователя с включённым вторым фактором.
  const { validateTotpKeyConfig } = await import('./lib/security/totp');
  validateTotpKeyConfig();

  const { runStartupMaintenance } = await import('./lib/startup');
  runStartupMaintenance();

  scheduleTrashSweep();
}

/** Раз в сутки: сроки хранения не должны зависеть от рестартов и визитов. */
const TRASH_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function scheduleTrashSweep(): void {
  const sweep = () => {
    void import('./lib/trash')
      .then(({ cleanupExpiredTrash }) => cleanupExpiredTrash({ force: true }))
      .catch((error) => {
        console.error('[dcs] очистка корзины не удалась', error);
      });
  };

  const timer = setInterval(sweep, TRASH_SWEEP_INTERVAL_MS);
  // Таймер не должен держать процесс живым в тестах и CLI-скриптах.
  if (typeof timer.unref === 'function') timer.unref();
}
