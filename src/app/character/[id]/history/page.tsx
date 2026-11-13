'use client';

import { useParams } from 'next/navigation';

import Loading from '@/app/loading';
import { HistoryView } from '@/components/history/history-view';
import { UnavailableState } from '@/components/unavailable-state';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

/**
 * Страница истории листа. Лист берётся из общего `CharacterProvider`; сама
 * история загружается отдельным owner-only API-запросом.
 */
export default function CharacterHistoryPage() {
  const params = useParams<{ id: string }>();
  const { getCharacter, isLoaded, loadError, retryCharacters } =
    useCharacterContext();
  const { t } = useTranslation();
  const character = getCharacter(params.id);

  if (!isLoaded) return <Loading />;

  if (loadError) {
    return (
      <UnavailableState
        testId="history-load-error"
        title={t('common.error')}
        description={t('history.loadError')}
        actionLabel={t('common.retry')}
        onAction={() => void retryCharacters()}
      />
    );
  }

  if (!character) {
    return (
      <UnavailableState
        testId="history-character-not-found"
        title={t('common.characterNotFound')}
        description={t('common.characterNotFoundDesc')}
      />
    );
  }

  return <HistoryView character={character} />;
}
