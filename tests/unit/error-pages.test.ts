import { describe, expect, it } from 'vitest';

import {
  ERROR_PAGE_ACTIONS,
  ERROR_PAGE_CODES,
  isErrorPageCode,
} from '@/lib/error-pages';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: ERROR STATUS CONTRACT ───────────────────────────────────────
 * `/error/<code>` — статический маршрут, поэтому расхождение между списком
 * кодов, словарями и ссылками видно только в браузере. Здесь проверяется
 * контракт целиком: у каждого кода есть заголовок и объяснение в обеих
 * локалях, действия не пустые, путь собирается из одного места.
 *
 * Отдельно проверяется, что 404 не попал в статические параметры: он обязан
 * отдавать настоящий 404 через `notFound()`, а не страницу с кодом 200.
 */
describe('error pages: контракт статусов', () => {
  it('коды уникальны и покрывают основные сценарии', () => {
    expect(new Set(ERROR_PAGE_CODES).size).toBe(ERROR_PAGE_CODES.length);
    for (const code of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
      expect(ERROR_PAGE_CODES).toContain(code);
    }
  });

  it('у каждого кода есть заголовок и описание в en и ru', () => {
    for (const code of ERROR_PAGE_CODES) {
      for (const language of ['en', 'ru'] as const) {
        const title = translations[language][`error.${code}.title`];
        const description = translations[language][`error.${code}.description`];
        expect(title, `${language} ${code} title`).toBeTruthy();
        expect(description, `${language} ${code} description`).toBeTruthy();
        expect(title, `${language} ${code} raw key`).not.toBe(
          `error.${code}.title`,
        );
      }
    }
  });

  it('у каждого кода есть хотя бы одно осмысленное действие', () => {
    for (const code of ERROR_PAGE_CODES) {
      const actions = ERROR_PAGE_ACTIONS[code];
      expect(
        Object.values(actions).filter(Boolean).length,
        String(code),
      ).toBeGreaterThan(0);
    }
    // 401 обязан вести на вход, 429 — не предлагать мгновенный retry.
    expect(ERROR_PAGE_ACTIONS[401].login).toBe(true);
    expect(ERROR_PAGE_ACTIONS[429].retry).toBeUndefined();
  });

  it('isErrorPageCode принимает число и строку, отвергает мусор', () => {
    expect(isErrorPageCode(404)).toBe(true);
    expect(isErrorPageCode('503')).toBe(true);
    expect(isErrorPageCode(418)).toBe(false);
    expect(isErrorPageCode('nope')).toBe(false);
  });

  it('404 не претендует на статическую страницу: его отдаёт notFound()', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/error/[code]/page.tsx'),
      'utf8',
    );
    expect(source).toContain('code !== 404');
    expect(source).toContain('notFound()');
  });
});
