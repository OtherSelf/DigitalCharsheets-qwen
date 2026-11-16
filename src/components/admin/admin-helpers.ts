import { getGameDefinition } from '@/games/games';
import { getGameModule } from '@/games/registry';
import type { AdminActionReason } from '@/lib/admin-types';

type Translate = (key: string) => string;

/**
 * Локализованное сообщение по машиночитаемой причине отказа админского API.
 * `null` — причина неизвестна, показываем текст с сервера.
 */
export function adminReasonMessage(
  reason: AdminActionReason | undefined,
  t: Translate,
): string | null {
  switch (reason) {
    case 'username_taken':
      return t('admin.usernameTaken');
    case 'last_admin':
      return t('admin.lastAdmin');
    case 'self':
      return t('admin.selfAction');
    case 'not_found':
      return t('admin.userNotFound');
    default:
      return null;
  }
}

/** Дата в коротком формате текущей локали; null/мусор — прочерк. */
export function formatAdminDate(
  iso: string | null,
  language: 'en' | 'ru',
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

/** Подпись уровня/ранга в диалоге листов. */
export function adminCharacterLevelLabel(
  character: { level: number | null; rank: string | null },
  t: Translate,
): string {
  if (character.level !== null) return `${t('admin.level')} ${character.level}`;
  if (character.rank) return `${t('admin.rank')} ${character.rank}`;
  return '—';
}

/**
 * Ярлык игры в «Списке чарлистов»: короткий код редакции (`dh2e`) и полное
 * имя игры с редакцией для tooltip. `nameKey` модуля — только редакция
 * («2nd Edition»), поэтому игра добавляется по `gameId`. Неизвестный или
 * неустановленный плагин показываем сырым `systemId`/`gameSystem`, без
 * выдуманного имени.
 */
export function adminGameBadge(
  character: { systemId: string | null; gameSystem: string },
  t: Translate,
): { code: string; title: string | null } {
  const gameModule = character.systemId
    ? getGameModule(character.systemId)
    : undefined;
  if (!gameModule) {
    return { code: character.systemId ?? character.gameSystem, title: null };
  }

  const gameDefinition = getGameDefinition(gameModule.gameId);
  const title = [
    gameDefinition ? t(gameDefinition.nameKey) : null,
    t(gameModule.nameKey),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  return { code: gameModule.shortCode, title };
}
