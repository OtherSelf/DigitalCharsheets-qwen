import type { PluginLocalizedMessages, SiteLanguage } from '@/games/types';

/**
 * Словарь плагина для языка сайта: свои строки, иначе второй язык сайта.
 * Плагин обязан объявить хотя бы одну из локалей `en`/`ru`, поэтому пустой
 * объект здесь возможен только для защитного вызова до валидации.
 */
export function pluginMessagesFor(
  messages: PluginLocalizedMessages,
  language: SiteLanguage,
): Readonly<Record<string, string>> {
  const fallback: SiteLanguage = language === 'en' ? 'ru' : 'en';
  return messages[language] ?? messages[fallback] ?? {};
}
