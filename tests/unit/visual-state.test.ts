import { describe, expect, it } from 'vitest';

import { projectAccountIndex } from '../visual/state';

/**
 * ─── LANDMARK: VISUAL ACCOUNT INDEX ────────────────────────────────────────
 * `workerIndex` в Playwright уникален только внутри проекта: один и тот же
 * индекс в `desktop` и `mobile` — разные процессы, но один аккаунт, если
 * выбирать по воркеру. Проверяем арифметику выбора блока проекта и откат на
 * прежнее поведение для старого файла состояния.
 */
describe('visual state: аккаунт по проекту и воркеру', () => {
  const projects = ['desktop', 'mobile', 'tablet'];
  const perProject = 4;
  const total = projects.length * perProject;

  it('выбирает аккаунт внутри блока своего проекта', () => {
    expect(projectAccountIndex(projects, perProject, 'desktop', 0, total)).toBe(
      0,
    );
    expect(projectAccountIndex(projects, perProject, 'desktop', 3, total)).toBe(
      3,
    );
    expect(projectAccountIndex(projects, perProject, 'mobile', 0, total)).toBe(
      4,
    );
    expect(projectAccountIndex(projects, perProject, 'mobile', 2, total)).toBe(
      6,
    );
    expect(projectAccountIndex(projects, perProject, 'tablet', 1, total)).toBe(
      9,
    );
  });

  it('не пересекает блоки соседних проектов', () => {
    const desktop = new Set(
      Array.from({ length: perProject }, (_, index) =>
        projectAccountIndex(projects, perProject, 'desktop', index, total),
      ),
    );
    const mobile = new Set(
      Array.from({ length: perProject }, (_, index) =>
        projectAccountIndex(projects, perProject, 'mobile', index, total),
      ),
    );
    expect([...desktop].filter((index) => mobile.has(index))).toEqual([]);
  });

  it('без проекта или для старого файла оставляет выбор по воркеру', () => {
    expect(projectAccountIndex(undefined, undefined, 'mobile', 2, 4)).toBe(2);
    expect(projectAccountIndex(['desktop'], 4, 'unknown', 2, 4)).toBe(2);
    expect(projectAccountIndex(['desktop'], undefined, 'desktop', 2, 4)).toBe(
      2,
    );
  });

  it('защищает от выхода за список аккаунтов', () => {
    expect(projectAccountIndex(['desktop', 'mobile'], 4, 'mobile', 7, 8)).toBe(
      7,
    );
    expect(projectAccountIndex(['desktop', 'mobile'], 4, 'mobile', 9, 8)).toBe(
      5,
    );
    expect(projectAccountIndex(['desktop'], 4, 'desktop', 0, 0)).toBe(0);
  });
});
