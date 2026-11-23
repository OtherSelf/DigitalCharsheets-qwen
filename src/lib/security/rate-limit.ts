import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';

import { getDataDir, getRateLimitStateFile } from '../data-dir';

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

/** Проверка «логин занят?»: запас на UX, но перечисление упирается в лимит. */
export const EXISTS_RATE_LIMIT: RateLimitRule = {
  limit: 20,
  windowMs: 10 * 60_000,
};

/** Регистрация: 10 аккаунтов за 10 минут с одного адреса. */
export const REGISTER_RATE_LIMIT: RateLimitRule = {
  limit: 10,
  windowMs: 10 * 60_000,
};

/** Поиск по документации: 30 запросов в минуту на IP (GET, без сессии). */
export const SEARCH_RATE_LIMIT: RateLimitRule = {
  limit: 30,
  windowMs: 60_000,
};

/** Auth-мутации под сессией (смена пароля/фразы): 10 за 10 минут. */
export const AUTH_MUTATION_RATE_LIMIT: RateLimitRule = {
  limit: 10,
  windowMs: 10 * 60_000,
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

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_FLUSH_MS = 1_000;
const SNAPSHOT_TTL_MS = 60 * 60_000;
const OVERFLOW_KEY = '__overflow__';

interface SnapshotFile {
  version: number;
  buckets: Record<string, number[]>;
}

export interface SnapshotStoreOptions {
  /** Задержка записи на диск (тесты ставят 0). */
  flushDelayMs?: number;
  /** Потолок числа ключей (тесты ставят маленький). */
  maxKeys?: number;
  now?: () => number;
}

export interface SnapshotRateLimitStore extends RateLimitStore {
  /** Сбросить снапшот на диск сейчас (тесты и завершение процесса). */
  flushNow(): Promise<void>;
}

/**
 * ─── LANDMARK: PERSISTENT RATE LIMIT ────────────────────────────────────────
 * История лимита должна переживать рестарт, но не может стоить fsync на
 * каждый логин: auth-путь и так под scrypt, а `withDataLock` — глобальный лок
 * всего каталога данных. Поэтому память остаётся источником истины, а на диск
 * ложится debounced-снапшот (не чаще раза в секунду) атомарной заменой.
 *
 * При переполнении карты новые ключи не вытесняют активные бакеты (иначе флуд
 * уникальными IP/логинами обнулял бы счётчик жертвы): они считаются по общему
 * overflow-ключу, то есть отказ fail-closed.
 */
export function createSnapshotRateLimitStore(
  filePath: string,
  options: SnapshotStoreOptions = {},
): SnapshotRateLimitStore {
  const maxKeys = options.maxKeys ?? MAX_STORE_KEYS;
  const flushDelayMs = options.flushDelayMs ?? SNAPSHOT_FLUSH_MS;
  const now = options.now ?? (() => Date.now());
  const buckets = new Map<string, number[]>();
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> | null = null;
  let dirty = false;

  function load(): void {
    if (loaded) return;
    loaded = true;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SnapshotFile;
      if (
        parsed?.version !== SNAPSHOT_VERSION ||
        typeof parsed.buckets !== 'object' ||
        parsed.buckets === null
      ) {
        return;
      }
      const cutoff = now() - SNAPSHOT_TTL_MS;
      for (const [key, value] of Object.entries(parsed.buckets)) {
        if (!Array.isArray(value)) continue;
        const timestamps = value.filter(
          (timestamp) =>
            typeof timestamp === 'number' &&
            Number.isFinite(timestamp) &&
            timestamp > cutoff,
        );
        if (timestamps.length > 0) buckets.set(key, timestamps);
      }
    } catch {
      // Нет файла или он битый: начинаем с пустой истории. Это безопаснее,
      // чем падать на старте из-за служебного кеша.
    }
  }

  /** Куда писать ключ: он сам, overflow или новый ключ, если есть место. */
  function targetKey(key: string): string {
    if (buckets.has(key) || buckets.size < maxKeys) return key;
    return OVERFLOW_KEY;
  }

  function scheduleFlush(): void {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushDelayMs);
    // Таймер не должен держать процесс живым (тесты, CLI-скрипты).
    if (typeof timer.unref === 'function') timer.unref();
  }

  async function flush(): Promise<void> {
    if (flushing) return flushing;
    if (!dirty) return;
    dirty = false;
    const cutoff = now() - SNAPSHOT_TTL_MS;
    const payload: SnapshotFile = { version: SNAPSHOT_VERSION, buckets: {} };
    for (const [key, timestamps] of buckets) {
      const fresh = timestamps.filter((timestamp) => timestamp > cutoff);
      if (fresh.length > 0) payload.buckets[key] = fresh;
    }
    flushing = (async () => {
      try {
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        const tmp = `${filePath}.${process.pid}.tmp`;
        await fsp.writeFile(tmp, JSON.stringify(payload), 'utf8');
        await fsp.rename(tmp, filePath);
      } catch {
        // Служебное состояние: следующий flush попробует снова.
        dirty = true;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  return {
    read(key: string): readonly number[] {
      load();
      return buckets.get(targetKey(key)) ?? [];
    },
    write(key: string, timestamps: number[]): void {
      load();
      if (timestamps.length === 0) {
        buckets.delete(key);
        if (key === OVERFLOW_KEY) buckets.delete(OVERFLOW_KEY);
        scheduleFlush();
        return;
      }
      const target = targetKey(key);
      buckets.delete(target);
      buckets.set(target, timestamps);
      scheduleFlush();
    },
    clear(): void {
      load();
      buckets.clear();
      scheduleFlush();
    },
    async flushNow(): Promise<void> {
      load();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = true;
      await flush();
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
let authRateLimiterDataDir = '';

/**
 * Общий лимитер всех `/api/auth*`. Синглтон, чтобы память не обнулялась на
 * каждый роут; в тестах сбрасывается `resetAuthRateLimits()`. Снапшот
 * привязан к текущему data-dir: тесты меняют `DCS_DATA_DIR`, и история
 * одного временного каталога не должна попадать в другой.
 */
export function getAuthRateLimiter(): RateLimiter {
  const dataDir = getDataDir();
  if (!authRateLimiter || authRateLimiterDataDir !== dataDir) {
    authRateLimiter = createRateLimiter({
      store: createSnapshotRateLimitStore(getRateLimitStateFile()),
    });
    authRateLimiterDataDir = dataDir;
  }
  return authRateLimiter;
}

/** Сбросить историю общего лимитера (тесты после каждого сценария). */
export function resetAuthRateLimits(): void {
  getAuthRateLimiter().reset();
}

/** Разобрать один адрес заголовка: только валидный IP, иначе null. */
function parseClientIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const candidate =
    trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;
  return isIP(candidate) ? candidate : null;
}

/**
 * IP клиента. Граница доверия — nginx: он перезаписывает `X-Forwarded-For`
 * (`$remote_addr`), поэтому клиентское значение не может оказаться справа.
 * Берём последний адрес списка, а не первый: первый клиент дописывает сам, и
 * именно на нём держался обход лимита. Мусор в последнем адресе даёт
 * `unknown`, а не «следующий слева» — иначе подделка снова прошла бы.
 *
 * `X-Real-IP` — тот же уровень доверия (nginx ставит `$remote_addr`); если
 * заголовков нет, ключ `unknown` — лимит общий, но fail-closed.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const last =
      parts.length > 0 ? parseClientIp(parts[parts.length - 1]) : null;
    return last ?? 'unknown';
  }
  const realIp = parseClientIp(request.headers.get('x-real-ip'));
  return realIp ?? 'unknown';
}

/**
 * Ключ «на аккаунт», без IP: второй эшелон против распределённого перебора,
 * когда IP меняется (ротация XFF, ботнет). Логин нормализуется так же, как в
 * ключе с IP.
 */
export function accountRateLimitKey(action: string, login: string): string {
  return `${action}:account:${String(login).toLowerCase().trim()}`;
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
