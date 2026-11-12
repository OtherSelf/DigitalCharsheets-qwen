'use client';

/**
 * ─── LANDMARK: PLUGIN HOST API (runtime) ───────────────────────────────────
 * Runtime-часть Plugin API: хуки хоста, которые нужны листу и форме плагина.
 * Плагин импортирует их отсюда, а не из `@/context/*` и `@/hooks/*`, — так
 * границы плагинов остаются закрытыми, а хост может менять внутреннее
 * устройство контекстов, не задевая плагины (SDK v1, этап 5).
 *
 *   • `useCharacterContext` — чтение/запись листа и общие настройки листа;
 *   • `useTranslation`      — `t()` текущего языка (полные ключи `ns.key`);
 *   • `useToast`            — тосты хоста.
 *
 * Модуль `'use client'`: его импортируют только клиентские компоненты.
 */
export { useCharacterContext } from '@/context/character-context';
export { useTranslation } from '@/context/language-context';
export { useToast } from '@/hooks/use-toast';
