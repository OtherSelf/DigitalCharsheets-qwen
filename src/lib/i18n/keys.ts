import type { PluginTranslationKey } from '@/games/i18n.keys.generated';
import { en as gamesCoreEn } from '@/games/i18n/en';

import { enTranslations } from './translations.en';

/**
 * ─── LANDMARK: TRANSLATION KEYS ─────────────────────────────────────────────
 * Все допустимые ключи словарей: общий слой, метаданные редакций и словари
 * плагинов. `t()` принимает только этот тип, поэтому опечатка в ключе — ошибка
 * `tsc`, а не пустая строка в интерфейсе.
 *
 * Ключи плагинов приходят из сгенерированного `i18n.keys.generated.ts`:
 * в рантайме `PluginLocalizedMessages` — это `Record<string, string>`, и
 * статически их взять неоткуда.
 *
 * Динамические ключи (собираются из данных: `` `dh1.${kind}Abbr` ``) идут
 * через `tUnsafe` — это явная дверь, а не тихий обход проверки.
 */
export type TranslationKey =
  keyof typeof enTranslations | keyof typeof gamesCoreEn | PluginTranslationKey;

/**
 * База семейства форм числа: `common.noteTabLimit` для ключей
 * `common.noteTabLimit_{one,few,many,other}`. `tPlural` принимает только такие
 * базы — иначе вызов молча вернул бы сам ключ.
 */
type PluralBase<T> = T extends `${infer Base}_other` ? Base : never;
export type PluralKey = PluralBase<TranslationKey>;
