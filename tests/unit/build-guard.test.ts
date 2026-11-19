import { describe, expect, it } from 'vitest';

import {
  AUTO_RELOAD_COOLDOWN_MS,
  BUILD_CHECK_INTERVAL_MS,
  buildCheckInterval,
  decideBuildAction,
  JITTER_RATIO,
  nextPollDelay,
  readBuildId,
  type BuildDecisionInput,
} from '@/lib/build-guard';

/**
 * Решение сторожа — это и есть поведение «перезагрузить или нет», поэтому
 * проверяется таблицей случаев, а не через компонент.
 */
const NOW = 1_800_000_000_000;

function decide(input: Partial<BuildDecisionInput> = {}): string {
  return decideBuildAction({
    ownId: 'build-a',
    serverId: 'build-b',
    dirty: false,
    now: NOW,
    lastAutoReloadAt: null,
    ...input,
  });
}

describe('decideBuildAction', () => {
  it('тот же id — ничего не делает', () => {
    expect(decide({ serverId: 'build-a' })).toBe('same');
  });

  it('другой id, сохранено всё — перезагружает', () => {
    expect(decide()).toBe('reload');
  });

  it('несохранённые правки важнее новой версии', () => {
    expect(decide({ dirty: true })).toBe('banner');
  });

  it('внутри cooldown не перезагружает, а показывает баннер', () => {
    expect(
      decide({ lastAutoReloadAt: NOW - AUTO_RELOAD_COOLDOWN_MS + 1 }),
    ).toBe('banner');
  });

  it('граница cooldown считается истёкшей', () => {
    expect(decide({ lastAutoReloadAt: NOW - AUTO_RELOAD_COOLDOWN_MS })).toBe(
      'reload',
    );
  });

  it('свой cooldown переопределяет константу', () => {
    expect(decide({ lastAutoReloadAt: NOW - 100, cooldownMs: 50 })).toBe(
      'reload',
    );
  });

  it('ответ без buildId — ждёт, а не перезагружает', () => {
    expect(decide({ serverId: null })).toBe('wait');
  });

  it('без базового id — ждёт, чтобы взять его из ответа', () => {
    expect(decide({ ownId: null })).toBe('wait');
  });
});

describe('buildCheckInterval', () => {
  it('в production опрашивает раз в минуту', () => {
    expect(buildCheckInterval('production')).toBe(
      BUILD_CHECK_INTERVAL_MS.production,
    );
    expect(buildCheckInterval('production')).toBe(60_000);
  });

  it('вне production (dev, стенд, тесты) — раз в 15 секунд', () => {
    expect(buildCheckInterval('development')).toBe(15_000);
    expect(buildCheckInterval(undefined)).toBe(15_000);
  });
});

describe('nextPollDelay', () => {
  it('jitter только сокращает интервал', () => {
    expect(nextPollDelay(60_000, () => 0)).toBe(60_000);
    expect(nextPollDelay(60_000, () => 1)).toBe(60_000 - 60_000 * JITTER_RATIO);
    expect(nextPollDelay(15_000, () => 0.5)).toBe(15_000 - 1_500);
  });

  it('битый random не выводит задержку за пределы интервала', () => {
    expect(nextPollDelay(60_000, () => 5)).toBe(60_000 - 12_000);
    expect(nextPollDelay(60_000, () => -5)).toBe(60_000);
  });
});

describe('readBuildId', () => {
  it('берёт непустую строку и обрезает пробелы', () => {
    expect(readBuildId({ buildId: ' build-a ' })).toBe('build-a');
  });

  it('null на всё, что не строка или пустое', () => {
    expect(readBuildId(null)).toBeNull();
    expect(readBuildId('build-a')).toBeNull();
    expect(readBuildId({})).toBeNull();
    expect(readBuildId({ buildId: 42 })).toBeNull();
    expect(readBuildId({ buildId: '   ' })).toBeNull();
    expect(readBuildId({ buildId: null })).toBeNull();
  });
});
