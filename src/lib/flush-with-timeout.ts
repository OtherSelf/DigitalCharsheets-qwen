// src/lib/flush-with-timeout.ts

/**
 * Дождаться очереди сохранений, но не бесконечно: в момент перезагрузки или
 * падения чанка сервер может быть недоступен, и `flush()` не завершится.
 *
 * `false` означает «не дождались» — вызывающий обязан считать состояние
 * несохранённым и не терять данные, а показать баннер/карточку.
 */
export async function flushWithTimeout(
  flush: () => Promise<void>,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      flush()
        .then(() => true)
        .catch(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
