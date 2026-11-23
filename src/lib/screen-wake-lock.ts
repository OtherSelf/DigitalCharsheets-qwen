/**
 * ─── LANDMARK: SCREEN WAKE LOCK ─────────────────────────────────────────────
 * «Не выключать экран» на Screen Wake Lock API. Браузер отпускает блокировку
 * при уходе вкладки в фон, поэтому менеджер заново запрашивает её на
 * `visibilitychange`. Настройка хранится в `ui-keep-awake` и переживает
 * перезагрузку; запрос идёт после действия пользователя (переключатель), а
 * также при монтировании, если настройка была включена.
 *
 * API нет в части браузеров (и в SSR) — тогда состояние `supported: false`,
 * приложение работает как обычно.
 */

export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockEnvironment {
  supported: boolean;
  request(): Promise<WakeLockSentinelLike>;
  isVisible(): boolean;
  onVisibilityChange(listener: () => void): () => void;
}

export interface WakeLockState {
  supported: boolean;
  active: boolean;
  error: boolean;
}

export interface WakeLockController {
  setEnabled(enabled: boolean): void;
  sync(): void;
  getState(): WakeLockState;
  subscribe(listener: () => void): () => void;
}

const SERVER_STATE: WakeLockState = {
  supported: false,
  active: false,
  error: false,
};

export function createWakeLockController(
  env: WakeLockEnvironment,
): WakeLockController {
  let enabled = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let requesting = false;
  let state: WakeLockState = {
    supported: env.supported,
    active: false,
    error: false,
  };
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setState = (patch: Partial<WakeLockState>) => {
    state = { ...state, ...patch };
    notify();
  };

  const release = async (): Promise<void> => {
    const current = sentinel;
    sentinel = null;
    setState({ active: false });
    if (!current) return;
    try {
      await current.release();
    } catch {
      // Браузер мог уже отпустить блокировку сам.
    }
  };

  const acquire = async (): Promise<void> => {
    if (!enabled || !env.supported || requesting || sentinel) return;
    if (!env.isVisible()) return;
    requesting = true;
    try {
      const lock = await env.request();
      if (!enabled) {
        await lock.release();
        return;
      }
      sentinel = lock;
      setState({ active: true, error: false });
      lock.addEventListener?.('release', () => {
        if (sentinel !== lock) return;
        sentinel = null;
        setState({ active: false });
        // Браузер отпускает блокировку при скрытии вкладки; вернувшись,
        // запрашиваем снова, если настройка всё ещё включена.
        if (enabled && env.isVisible()) void acquire();
      });
    } catch {
      setState({ active: false, error: true });
    } finally {
      requesting = false;
    }
  };

  const sync = () => {
    if (!enabled) return;
    if (!env.isVisible()) {
      void release();
      return;
    }
    if (!sentinel) void acquire();
  };

  env.onVisibilityChange(sync);

  return {
    setEnabled(next: boolean) {
      enabled = next;
      if (!next) {
        void release();
        return;
      }
      void acquire();
    },
    sync,
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function browserEnvironment(): WakeLockEnvironment {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  return {
    supported,
    async request() {
      const wakeLock = (
        navigator as Navigator & {
          wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
        }
      ).wakeLock;
      return wakeLock.request('screen');
    },
    isVisible: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible',
    onVisibilityChange(listener) {
      if (typeof document === 'undefined') return () => undefined;
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}

/** Общий менеджер для приложения; создаётся один раз на клиенте. */
export const wakeLockController =
  createWakeLockController(browserEnvironment());

export const WAKE_LOCK_SERVER_STATE = SERVER_STATE;
