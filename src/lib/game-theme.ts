import { GAME_THEME_TOKENS, type GameTheme } from '@/games/types';

/**
 * ─── LANDMARK: GAME THEME SCOPE ─────────────────────────────────────────────
 * Скоупленная тема игры: манифест объявляет значения токенов, ядро
 * превращает их в CSS-переменные на обёртке `[data-system="<id>"]`.
 *
 * Почему CSS-правилами, а не инлайн-стилем по `useTheme()`: режим сайта
 * (`light`/`dark`) живёт классом на `<html>`, а не в React-состоянии, и
 * сервер не знает выбора игрока. Правило `html.dark [data-system="…"]` даёт
 * правильный цвет сразу, без вспышки чужой темы при гидратации и без
 * расхождения серверной и клиентской разметки.
 *
 * Список токенов принадлежит ядру (`GAME_THEME_TOKENS`): плагин не может
 * добавить переменную или селектор, а базовые значения хоста остаются для
 * всего, что он не переопределил. `systemId` валидируется схемой манифеста
 * (`^[a-z][a-z0-9]*$`), но функция не полагается на это: в селектор попадает
 * только проверенная строка.
 */

const SYSTEM_ID_RE = /^[a-z][a-z0-9]*$/;

function declarations(
  set: Partial<Record<(typeof GAME_THEME_TOKENS)[number], string>> | undefined,
): string {
  if (!set) return '';
  return GAME_THEME_TOKENS.filter((token) => {
    const value = set[token];
    return typeof value === 'string' && value.trim() !== '';
  })
    .map((token) => `--${token}: ${set[token]!.trim()};`)
    .join(' ');
}

/**
 * CSS темы игры: светлый набор — на обёртке, тёмный — под `html.dark`.
 * Пустая строка, если темы нет или объявлять нечего (тогда хост рисует
 * нейтральный вид и обёртка не нужна).
 *
 * @param systemId `systemId` игры (он же `data-system`)
 * @param theme блок `ui.theme` манифеста
 * @returns готовый CSS для `<style>` на странице листа
 */
export function gameThemeCss(
  systemId: string | undefined,
  theme: GameTheme | undefined,
): string {
  if (!systemId || !SYSTEM_ID_RE.test(systemId) || !theme) return '';
  const light = declarations(theme.tokens?.light);
  const dark = declarations(theme.tokens?.dark);
  if (!light && !dark) return '';
  const scope = `[data-system="${systemId}"]`;
  const rules: string[] = [];
  if (light) rules.push(`${scope}{${light}}`);
  if (dark) rules.push(`html.dark ${scope}{${dark}}`);
  return rules.join('');
}
