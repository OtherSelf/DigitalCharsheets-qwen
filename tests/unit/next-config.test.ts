import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

/**
 * Регрессия Next 16: dev-сервер блокирует cross-origin запросы к dev-ресурсам
 * (/_next/hmr) и без явного allowedDevOrigins страницы за реверс-прокси
 * перестают гидратироваться. Полный сценарий проверяет `npm run test:dev`
 * (scripts/dev-smoke.mjs), а этот тест в быстром гейте ловит случайное
 * удаление/сужение списка.
 */
describe('next.config: allowedDevOrigins для стендов за реверс-прокси', () => {
  const origins = nextConfig.allowedDevOrigins ?? [];

  it('разрешает домены дев- и прод-стенда', () => {
    expect(origins).toEqual(
      expect.arrayContaining(['dcs-dev.thfree.space', 'dcs.thfree.space']),
    );
  });

  it('разрешает локальную разработку', () => {
    expect(origins).toEqual(expect.arrayContaining(['localhost', '127.0.0.1']));
  });
});
