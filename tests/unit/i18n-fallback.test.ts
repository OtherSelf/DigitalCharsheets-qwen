import { describe, expect, it } from 'vitest';

import { pluginMessagesFor } from '@/lib/i18n/plugin-messages';

/**
 * Плагин может объявить только `en` или только `ru`. Сайт берёт свой
 * язык, а при его отсутствии — второй язык сайта; `t()` вернёт сырой ключ
 * только если строки нет ни в одной доступной локали.
 */
describe('словарь плагина для языка сайта', () => {
  it('берёт словарь своего языка', () => {
    expect(pluginMessagesFor({ en: { a: 'A' }, ru: { a: 'Б' } }, 'en')).toEqual(
      { a: 'A' },
    );
    expect(pluginMessagesFor({ en: { a: 'A' }, ru: { a: 'Б' } }, 'ru')).toEqual(
      { a: 'Б' },
    );
  });

  it('подставляет второй язык сайта при неполной локали', () => {
    expect(pluginMessagesFor({ ru: { a: 'Б' } }, 'en')).toEqual({ a: 'Б' });
    expect(pluginMessagesFor({ en: { a: 'A' } }, 'ru')).toEqual({ a: 'A' });
  });

  it('дополнительная локаль не мешает fallback', () => {
    expect(pluginMessagesFor({ ru: { a: 'Б' }, de: { a: 'C' } }, 'en')).toEqual(
      { a: 'Б' },
    );
  });

  it('пустой набор локалей отдаёт пустой объект, а не сырой ключ', () => {
    expect(pluginMessagesFor({}, 'en')).toEqual({});
    expect(pluginMessagesFor({}, 'ru')).toEqual({});
  });
});
