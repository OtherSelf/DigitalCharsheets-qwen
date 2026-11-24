'use client';

/**
 * ─── LANDMARK: PLUGIN HOST API (runtime) ───────────────────────────────────
 * Runtime-часть Plugin API: хуки хоста, которые нужны листу и форме плагина.
 * Плагин импортирует их отсюда, а не из `@/context/*` и `@/hooks/*`, — так
 * границы плагинов остаются закрытыми, а хост может менять внутреннее
 * устройство контекстов, не задевая плагины (SDK v1, этап 5).
 *
 *   • `useCharacterContext` — чтение/запись листа и общие настройки листа;
 *   • `useTranslation`      — `t()` текущего языка (полные ключи `ns.key`,
 *                             в том числе собранные из данных плагина);
 *   • `useToast`            — тосты хоста;
 *   • `NarrativeSheet`      — правый Sheet заметок/предыстории с markdown;
 *   • `ConditionsList`      — структурированные состояния (Безумие/Порча);
 *   • `ExperienceLogSheet`  — правый Sheet журнала опыта.
 *
 * Модуль `'use client'`: его импортируют только клиентские компоненты.
 */
import { useTranslation as useHostTranslation } from '@/context/language-context';
import type { TranslationVars } from '@/lib/i18n';

export { useCharacterContext } from '@/context/character-context';
export { useToast } from '@/hooks/use-toast';
export { NarrativeSheet } from '@/components/sheets/narrative-sheet';
export {
  ConditionsList,
  type ConditionsLabels,
} from '@/components/sheets/conditions-list';
export {
  ExperienceLogSheet,
  type ExperienceLogRow,
} from '@/components/sheets/experience-log-sheet';

/**
 * Перевод для плагинов. В отличие от хостового `t`, ключ здесь не типизирован
 * `TranslationKey`: плагин собирает его из своих данных (`dh1.${kind}Abbr`,
 * `dh2.talent.${id}`), и статически такой ключ не вывести. Хостовые
 * компоненты получают строгий `t` из контекста напрямую.
 */
export function useTranslation() {
  const { tUnsafe, ...rest } = useHostTranslation();
  return {
    ...rest,
    t: (key: string, vars?: TranslationVars) => tUnsafe(key, vars),
  };
}
