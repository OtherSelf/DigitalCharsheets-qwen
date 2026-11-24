import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  languageCookieHeader,
  parseLanguage,
  persistLanguageCookie,
  readLanguageCookie,
  resolveLanguage,
} from '@/lib/language';

/** Срок cookie выбора языка; значение повторяется в тестах как контракт. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Выбор языка сайта: нормализация значения, `Accept-Language`, порядок
 * cookie → заголовок → умолчание и обе стороны cookie (сервер и браузер).
 *
 * Клиентские функции (`document.cookie`) проверяются на подставном `document`:
 * окружение vitest — node, DOM здесь нет.
 */

describe('parseLanguage', () => {
  it.each([
    ['ru', 'ru'],
    ['RU', 'ru'],
    [' ru ', 'ru'],
    ['ru-RU', 'ru'],
    ['en_US', 'en'],
  ])('приводит %j к %j', (value, expected) => {
    expect(parseLanguage(value)).toBe(expected);
  });

  it.each([['de'], ['rux'], [''], ['   '], [null], [undefined], [42]])(
    'возвращает null для %j',
    (value) => {
      expect(parseLanguage(value)).toBeNull();
    },
  );
});

describe('Accept-Language', () => {
  const fromHeader = (acceptLanguage: string | null | undefined) =>
    resolveLanguage({ acceptLanguage });

  it('берёт первый поддерживаемый язык по порядку', () => {
    expect(fromHeader('ru-RU,ru;q=0.9,en-US;q=0.8')).toBe('ru');
    expect(fromHeader('en-GB,en;q=0.9')).toBe('en');
  });

  it('уважает q-веса', () => {
    expect(fromHeader('de-DE,ru;q=0.9,en;q=0.5')).toBe('ru');
    expect(fromHeader('ru;q=0.2,en;q=0.7')).toBe('en');
  });

  it('пропускает языки с q=0 и `*`', () => {
    expect(fromHeader('ru;q=0,en;q=0.5')).toBe('en');
    expect(fromHeader('*')).toBe(DEFAULT_LANGUAGE);
    expect(fromHeader('*;q=0.9,ru;q=0.1')).toBe('ru');
  });

  it('без поддерживаемого языка отдаёт умолчание', () => {
    expect(fromHeader('de-DE,de;q=0.9')).toBe(DEFAULT_LANGUAGE);
    expect(fromHeader('')).toBe(DEFAULT_LANGUAGE);
    expect(fromHeader(null)).toBe(DEFAULT_LANGUAGE);
    expect(fromHeader(undefined)).toBe(DEFAULT_LANGUAGE);
  });
});

describe('resolveLanguage', () => {
  it('явная cookie важнее Accept-Language', () => {
    expect(
      resolveLanguage({ cookie: 'en', acceptLanguage: 'ru-RU,ru;q=0.9' }),
    ).toBe('en');
  });

  it('без cookie берёт Accept-Language', () => {
    expect(resolveLanguage({ acceptLanguage: 'ru-RU,ru;q=0.9' })).toBe('ru');
  });

  it('без cookie и заголовка — умолчание', () => {
    expect(resolveLanguage({})).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage({ cookie: 'de', acceptLanguage: 'de-DE' })).toBe(
      DEFAULT_LANGUAGE,
    );
  });
});

describe('languageCookieHeader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ставит год, Path и SameSite, но не HttpOnly', () => {
    const header = languageCookieHeader('ru');
    expect(header).toContain(`${LANGUAGE_COOKIE}=ru`);
    expect(header).toContain('Path=/');
    expect(header).toContain(`Max-Age=${ONE_YEAR_SECONDS}`);
    expect(header).toContain('SameSite=Lax');
    // Значение читает и переключатель языка на клиенте.
    expect(header).not.toContain('HttpOnly');
  });

  it('добавляет Secure по флагу окружения', () => {
    vi.stubEnv('DCS_COOKIE_SECURE', '1');
    expect(languageCookieHeader('en')).toContain('Secure');
  });
});

describe('cookie в браузере', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubDocument(initial = '') {
    const jar = { value: initial };
    vi.stubGlobal('document', {
      get cookie() {
        return jar.value;
      },
      set cookie(value: string) {
        jar.value = value;
      },
    });
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    return jar;
  }

  it('читает язык среди других cookie', () => {
    stubDocument('theme=dark; dcs_language=ru; other=1');
    expect(readLanguageCookie()).toBe('ru');
  });

  it('возвращает null для чужого значения и без cookie', () => {
    stubDocument('dcs_language=de');
    expect(readLanguageCookie()).toBeNull();
    stubDocument('');
    expect(readLanguageCookie()).toBeNull();
  });

  it('декодирует процентное кодирование', () => {
    stubDocument('dcs_language=%72%75');
    expect(readLanguageCookie()).toBe('ru');
  });

  it('записывает cookie с Path, Max-Age и SameSite', () => {
    const jar = stubDocument('');
    persistLanguageCookie('ru');
    expect(jar.value).toContain(`${LANGUAGE_COOKIE}=ru`);
    expect(jar.value).toContain('Path=/');
    expect(jar.value).toContain(`Max-Age=${ONE_YEAR_SECONDS}`);
    expect(jar.value).toContain('SameSite=Lax');
    expect(jar.value).not.toContain('Secure');
  });

  it('добавляет Secure на https', () => {
    const jar = stubDocument('');
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    persistLanguageCookie('en');
    expect(jar.value).toContain('Secure');
  });
});
