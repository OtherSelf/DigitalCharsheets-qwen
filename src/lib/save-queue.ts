/**
 * ─── SAVE QUEUE ─────────────────────────────────────────────────────────────
 * Очередь последовательных сохранений «одна запись за раз» на каждый лист.
 *
 * Зачем это нужно:
 *   • браузер не гарантирует порядок параллельных PUT — старая правка могла
 *     прийти позже новой и затереть её на сервере (lost update);
 *   • ошибки 4xx/5xx и обрывы сети раньше проглатывались.
 *
 * Что делает очередь:
 *   • держит не больше одного запроса в полёте на id (персонажа);
 *   • склеивает правки, пришедшие во время запроса, в один батч (coalescing);
 *   • перед отправкой ждёт `settleMs`, чтобы печать в поле превращалась
 *     в один PUT, а не в запрос на каждый символ;
 *   • ретраит сеть/5xx с нарастающей паузой;
 *   • при окончательной ошибке вызывает `onError` и сохраняет данные
 *     в очереди, чтобы их можно было дослать позже;
 *   • отдаёт снимок несохранённого (`snapshotAll`) для `keepalive`-отправки
 *     при уходе со страницы.
 * ────────────────────────────────────────────────────────────────────────────
 */

export interface SaveQueueOptions<T extends object> {
  /** Отправка одного батча. Возвращает HTTP-статус или null при сетевой ошибке. */
  send: (
    id: string,
    data: Partial<T>,
    meta?: SaveMeta,
  ) => Promise<number | null>;
  /** Окончательная ошибка: все попытки исчерпаны. */
  onError?: (id: string, data: Partial<T>) => void;
  /** Пауза перед отправкой, чтобы накопить правки. По умолчанию 250 мс. */
  settleMs?: number;
  /** Сколько всего попыток отправки делать. По умолчанию 3. */
  maxAttempts?: number;
  /** Задержка повторной попытки после окончательной ошибки. По умолчанию 5 с. */
  retryDelayMs?: number;
  /** Инъекция таймеров — нужна только в тестах. */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

/**
 * Служебные метки батча. Живут рядом с данными, но НЕ внутри них: сервер
 * использует их, чтобы отбросить устаревшую запись (см. server-storage).
 *
 * `page` — идентификатор загрузки страницы, `seq` — монотонный номер правки
 * внутри этой загрузки. Последняя по номеру правка всегда побеждает, даже
 * если её PUT пришёл на сервер раньше предыдущего (гонка keepalive-досылки
 * при уходе со страницы).
 */
export interface SaveMeta {
  page: string;
  seq: number;
}

export interface PendingSave<T extends object> {
  id: string;
  data: Partial<T>;
  meta?: SaveMeta;
}

export interface SaveQueue<T extends object> {
  /** Добавить правку в очередь (склеивается с уже ожидающими). */
  enqueue: (id: string, data: Partial<T>, meta?: SaveMeta) => void;
  /** Снимок всего несохранённого (без изменения очереди) — для `beforeunload`. */
  snapshotAll: () => PendingSave<T>[];
  /** Есть ли что-то, что ещё не подтверждено сервером. */
  hasPending: () => boolean;
  /** Дождаться, пока очередь опустеет (в тестах). */
  idle: () => Promise<void>;
}

interface QueueEntry<T extends object> {
  /** Правки, ожидающие отправки. */
  pending: Partial<T> | null;
  /** Правки, которые прямо сейчас летят на сервер. */
  inFlight: Partial<T> | null;
  /** Правки, которые не удалось сохранить: ждут следующей попытки. */
  failed: Partial<T> | null;
  /** Порядковые метки (номер правки) для тех же трёх состояний. */
  pendingMeta: SaveMeta | null;
  inFlightMeta: SaveMeta | null;
  failedMeta: SaveMeta | null;
  /** Защита от параллельного воркера на один id. */
  running: boolean;
  /** Отложенный повтор после ошибки. */
  retryTimer: ReturnType<typeof setTimeout> | null;
}

/** Позже — значит новее: берём метку с наибольшим seq. */
const newestMeta = (
  ...metas: Array<SaveMeta | null | undefined>
): SaveMeta | null => {
  let newest: SaveMeta | null = null;
  for (const meta of metas) {
    if (meta && (!newest || meta.seq >= newest.seq)) newest = meta;
  }
  return newest;
};

const isSuccessStatus = (status: number | null): boolean =>
  status !== null && status >= 200 && status < 300;

const isRetryableStatus = (status: number | null): boolean =>
  status === null || status >= 500 || status === 408 || status === 429;

export function createSaveQueue<T extends object>(
  options: SaveQueueOptions<T>,
): SaveQueue<T> {
  const {
    send,
    onError,
    settleMs = 250,
    maxAttempts = 3,
    retryDelayMs = 5000,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = options;

  const queues = new Map<string, QueueEntry<T>>();
  const idleWaiters: Array<() => void> = [];

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeoutFn(resolve, ms);
    });

  const getEntry = (id: string): QueueEntry<T> => {
    let entry = queues.get(id);
    if (!entry) {
      entry = {
        pending: null,
        inFlight: null,
        failed: null,
        pendingMeta: null,
        inFlightMeta: null,
        failedMeta: null,
        running: false,
        retryTimer: null,
      };
      queues.set(id, entry);
    }
    return entry;
  };

  const notifyIfIdle = () => {
    for (const entry of queues.values()) {
      if (entry.running || entry.pending || entry.inFlight) return;
    }
    while (idleWaiters.length > 0) idleWaiters.shift()!();
  };

  const run = async (id: string): Promise<void> => {
    const entry = getEntry(id);
    if (entry.running) return;
    entry.running = true;
    try {
      while (entry.pending) {
        // Даём накопиться следующим правкам — печать склеивается в один PUT.
        if (settleMs > 0) await sleep(settleMs);
        if (!entry.pending) break;

        const batch = entry.pending;
        const batchMeta = entry.pendingMeta ?? undefined;
        entry.pending = null;
        entry.pendingMeta = null;
        entry.inFlight = batch;
        entry.inFlightMeta = batchMeta ?? null;

        let status: number | null = null;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          status = await send(id, batch, batchMeta);
          if (isSuccessStatus(status) || !isRetryableStatus(status)) break;
          if (attempt < maxAttempts - 1) await sleep(400 * (attempt + 1));
        }

        entry.inFlight = null;
        entry.inFlightMeta = null;

        if (!isSuccessStatus(status)) {
          // Не теряем правку: держим до следующей попытки.
          entry.failed = { ...batch, ...(entry.failed ?? {}) } as Partial<T>;
          entry.failedMeta = newestMeta(entry.failedMeta, batchMeta);
          onError?.(id, batch);
          if (!entry.retryTimer) {
            entry.retryTimer = setTimeoutFn(() => {
              entry.retryTimer = null;
              if (entry.failed) {
                entry.pending = {
                  ...entry.failed,
                  ...(entry.pending ?? {}),
                } as Partial<T>;
                entry.pendingMeta = newestMeta(
                  entry.pendingMeta,
                  entry.failedMeta,
                );
                entry.failed = null;
                entry.failedMeta = null;
              }
              void run(id);
            }, retryDelayMs);
          }
          break;
        }
      }
    } finally {
      entry.running = false;
      notifyIfIdle();
    }
  };

  const enqueue = (id: string, data: Partial<T>, meta?: SaveMeta) => {
    const entry = getEntry(id);
    entry.pending = {
      ...(entry.failed ?? {}),
      ...(entry.pending ?? {}),
      ...data,
    } as Partial<T>;
    entry.pendingMeta = newestMeta(entry.pendingMeta, entry.failedMeta, meta);
    entry.failed = null;
    entry.failedMeta = null;
    if (entry.retryTimer) {
      clearTimeoutFn(entry.retryTimer);
      entry.retryTimer = null;
    }
    void run(id);
  };

  const snapshotAll = (): PendingSave<T>[] => {
    const snapshot: PendingSave<T>[] = [];
    queues.forEach((entry, id) => {
      const data = {
        ...(entry.failed ?? {}),
        ...(entry.inFlight ?? {}),
        ...(entry.pending ?? {}),
      } as Partial<T>;
      if (Object.keys(data).length > 0) {
        const meta = newestMeta(
          entry.failedMeta,
          entry.inFlightMeta,
          entry.pendingMeta,
        );
        snapshot.push(meta ? { id, data, meta } : { id, data });
      }
    });
    return snapshot;
  };

  const hasPending = (): boolean => snapshotAll().length > 0;

  const idle = (): Promise<void> =>
    new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
      notifyIfIdle();
    });

  return { enqueue, snapshotAll, hasPending, idle };
}
