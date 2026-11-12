'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

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
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

import { createExampleDefaults } from './defaults';

/** Форма создания эталонного плагина: без пропсов, контекст/API — от хоста. */
export function ExampleCharacterForm() {
  const { addCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [rank, setRank] = React.useState('Novice');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = createExampleDefaults({ name, rank });
    const created = await addCharacter(
      draft as unknown as Parameters<typeof addCharacter>[0],
    );
    if (created) router.push(`/${created.id}`);
  };

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{t('example.sheetTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="example-name">{t('common.characterName')}</Label>
            <Input
              id="example-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="example-rank">{t('example.rank')}</Label>
            <Input
              id="example-rank"
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
