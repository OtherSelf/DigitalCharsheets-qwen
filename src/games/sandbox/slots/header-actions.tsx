'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  useCharacterContext,
  useToast,
  useTranslation,
} from '@/games/plugin-host';

import { getSandboxCapabilities } from '../capabilities';
import type { SandboxCharacter } from '../types';

/**
 * Слот `HeaderActions`: действие игры в шапке листа. Плагин сам решает, что
 * предложить игроку; хост только даёт место и контекст. Здесь — «усилить
 * Мощь»: кнопка показывает, что слот умеет писать в лист через host API и
 * сообщать результат тостом.
 */
export function SandboxHeaderActions({
  character,
}: {
  character: SandboxCharacter;
  isCompactView: boolean;
}) {
  const { updateCharacter } = useCharacterContext();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { maxStat } = getSandboxCapabilities();

  const boost = () => {
    const might = Math.min(maxStat, character.stats.might + 1);
    updateCharacter(character.id, {
      stats: { ...character.stats, might },
      total: might + character.stats.wits,
    });
    toast({
      title: t('sandbox.headerAction'),
      description: t('sandbox.headerActionDone'),
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-2 h-7 shrink-0 px-2"
      onClick={boost}
      aria-label={t('sandbox.headerAction')}
      data-testid="sandbox-boost"
      disabled={character.stats.might >= maxStat}
    >
      <Sparkles className="h-4 w-4 xl:mr-2" />
      <span className="hidden xl:inline">{t('sandbox.boost')}</span>
    </Button>
  );
}
