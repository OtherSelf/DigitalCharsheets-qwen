'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';

import { createSandboxDefaults } from './defaults';

/** Форма создания эталонного плагина: без пропсов, контекст/API — от хоста. */
export function SandboxCharacterForm({
  onCreated,
}: { onCreated?: (characterId: string) => void } = {}) {
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [rank, setRank] = React.useState('Novice');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = createSandboxDefaults({ name, rank });
    const created = await addCharacter(
      draft as unknown as Parameters<typeof addCharacter>[0],
    );
    if (created) onCreated?.(created.id);
  };

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{t('sandbox.sheetTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sandbox-name">{t('common.characterName')}</Label>
            <Input
              id="sandbox-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sandbox-rank">{t('sandbox.rank')}</Label>
            <Input
              id="sandbox-rank"
              value={rank}
              onChange={(event) => setRank(event.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">{t('common.createCharacter')}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
