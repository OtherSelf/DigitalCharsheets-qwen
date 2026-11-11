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
