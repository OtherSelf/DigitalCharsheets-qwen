/**
 * ─── LANDMARK: RATE LIMIT ───────────────────────────────────────────────────
 * Sliding window по ключу `действие:IP:логин`. Нужен, чтобы подбор пароля и
 * recovery-фразы упирался в 429, а не в скорость сети.
 *
 * Хранилище — интерфейс: по умолчанию память процесса (single-process
 * деплой), при `pm2 cluster` или нескольких инстансах на одном data-dir
 * подставляется файловое хранилище без изменения вызывающего кода.
 *
 * Окно скользящее, а не фиксированное: запоминаются метки времени успешных
 * запросов, и запрос пропускается, пока в окне меньше `limit` меток. Отказ
 * возвращает `retryAfterSeconds` — его кладут в заголовок `Retry-After`.
 *
 * Память не растёт бесконечно: ключи без свежих меток выбрасываются, а при
 * переполнении карты удаляется самый старый ключ.
 */

export interface RateLimitRule {
  /** Сколько запросов разрешено в окне. */
  limit: number;
  /** Длина окна в миллисекундах. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Сколько запросов осталось в текущем окне. */
  remaining: number;
  /** Через сколько секунд окно освободится (0, если запрос разрешён). */
  retryAfterSeconds: number;
  limit: number;
}

/** Хранилище меток времени успешных запросов по ключу. */
export interface RateLimitStore {
  read(key: string): readonly number[];
  write(key: string, timestamps: number[]): void;
  clear(): void;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): RateLimitDecision;
  /** Забыть историю одного ключа или всех (тесты, смена пароля). */
  reset(key?: string): void;
}

/** Вход: 10 попыток за 10 минут на пару IP+логин. */
export const LOGIN_RATE_LIMIT: RateLimitRule = {
  limit: 10,
  windowMs: 10 * 60_000,
};

/** Восстановление: 5 попыток за 15 минут — фразу подбирают реже, цена выше. */
export const RECOVERY_RATE_LIMIT: RateLimitRule = {
  limit: 5,
  windowMs: 15 * 60_000,
};

const MAX_STORE_KEYS = 10_000;

export function createMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, number[]>();

  return {
    read(key: string): readonly number[] {
      return buckets.get(key) ?? [];
    },
    write(key: string, timestamps: number[]): void {
      if (timestamps.length === 0) {
        buckets.delete(key);
        return;
      }
      // Перезапись через delete/set освежает позицию в Map: следующий обход
      // удаляет самые давно не обновлявшиеся ключи.
      buckets.delete(key);
      buckets.set(key, timestamps);
      if (buckets.size > MAX_STORE_KEYS) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined && oldest !== key) buckets.delete(oldest);
      }
    },
    clear(): void {
      buckets.clear();
    },
  };
}

export interface CreateRateLimiterOptions {
  store?: RateLimitStore;
  /** Часы (тесты подставляют управляемое время). */
  now?: () => number;
}

export function createRateLimiter(
  options: CreateRateLimiterOptions = {},
): RateLimiter {
  const store = options.store ?? createMemoryRateLimitStore();
  const now = options.now ?? (() => Date.now());

  return {
    check(key: string, rule: RateLimitRule): RateLimitDecision {
      const nowMs = now();
      const windowStart = nowMs - rule.windowMs;
      // Метки хранятся по возрастанию: первая — самая старая, она и решает,
      // когда окно освободится.
      const history = store
        .read(key)
        .filter((timestamp) => timestamp > windowStart);

      if (history.length >= rule.limit) {
        const retryMs = history[0] + rule.windowMs - nowMs;
        store.write(key, history);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
          limit: rule.limit,
        };
      }

      history.push(nowMs);
      store.write(key, history);
      return {
        allowed: true,
        remaining: rule.limit - history.length,
        retryAfterSeconds: 0,
        limit: rule.limit,
      };
    },

    reset(key?: string): void {
      if (key === undefined) {
        store.clear();
        return;
      }
      store.write(key, []);
    },
  };
}

let authRateLimiter: RateLimiter | null = null;

/**
 * Общий лимитер всех `/api/auth*`. Синглтон, чтобы память не обнулялась на
 * каждый роут; в тестах сбрасывается `resetAuthRateLimits()`.
 */
export function getAuthRateLimiter(): RateLimiter {
  if (!authRateLimiter) authRateLimiter = createRateLimiter();
  return authRateLimiter;
}

/** Сбросить историю общего лимитера (тесты после каждого сценария). */
export function resetAuthRateLimits(): void {
  getAuthRateLimiter().reset();
}

/**
 * IP клиента. За nginx доверяем `x-forwarded-for`/`x-real-ip`; значения
 * нормализуются (первый адрес списка — клиент). Если прокси нет, ключ станет
 * `unknown` — лимит всё равно работает, но общий на всех.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();
  return 'unknown';
}

/** Ключ лимитера: `действие:IP:логин` — один логин не блокирует другой. */
export function rateLimitKey(
  action: string,
  request: Request,
  login?: string,
): string {
  const normalizedLogin = String(login ?? '')
    .toLowerCase()
    .trim();
  return `${action}:${clientIpFromRequest(request)}:${normalizedLogin}`;
}
