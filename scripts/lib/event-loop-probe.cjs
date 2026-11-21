// ============================================================================
//  scripts/lib/event-loop-probe.cjs — замер задержки event loop в процессе сервера
//
//  Подключается через NODE_OPTIONS=--require ... к `next start` во время
//  нагрузочных прогонов. Пишет снимок гистограммы в файл по SIGUSR2, сбрасывает
//  её по SIGUSR1 и пишет финальный снимок на выходе процесса. Приложение об этом
//  модуле не знает: без DCS_LOOP_DELAY_FILE он ничего не делает.
//
//  Гистограмма — perf_hooks.monitorEventLoopDelay: она измеряет, насколько
//  задержался таймер, то есть сколько event loop был занят синхронной работой.
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { monitorEventLoopDelay } = require('node:perf_hooks');

const outputFile = process.env.DCS_LOOP_DELAY_FILE;

if (outputFile) {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();

  function toMs(nanoseconds) {
    if (!Number.isFinite(nanoseconds)) return 0;
    return Math.round((nanoseconds / 1e6) * 1000) / 1000;
  }

  function snapshot() {
    return {
      count: histogram.count,
      minMs: toMs(histogram.min),
      maxMs: toMs(histogram.max),
      meanMs: toMs(histogram.mean),
      p50Ms: toMs(histogram.percentile(50)),
      p95Ms: toMs(histogram.percentile(95)),
      p99Ms: toMs(histogram.percentile(99)),
    };
  }

  let lastError = null;

  function writeSnapshot() {
    try {
      const payload = JSON.stringify(snapshot());
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, payload, 'utf8');
      lastError = null;
    } catch (error) {
      lastError = error;
    }
  }

  process.on('SIGUSR1', () => {
    histogram.reset();
    // Снимок после сброса — подтверждение для раннера: он ждёт mtime, а не спит.
    writeSnapshot();
  });

  process.on('SIGUSR2', () => {
    writeSnapshot();
  });

  process.on('exit', () => {
    writeSnapshot();
    if (lastError) {
      // В stderr, а не в файл: файл уже мог не записаться.
      process.stderr.write(
        `[perf] не удалось записать задержку event loop: ${String(lastError)}\n`,
      );
    }
  });
}
