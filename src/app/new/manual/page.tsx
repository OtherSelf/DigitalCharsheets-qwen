'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type GameSystem } from '@/lib/types';
import { DndCharacterForm } from '@/components/characters/forms/dnd-character-form';
import { DarkHeresyCharacterForm } from '@/components/characters/forms/dark-heresy-character-form';

export default function ManualCharacterCreationPage() {
  const [gameSystem, setGameSystem] = useState<GameSystem | ''>('');

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-headline font-bold tracking-tight">Create New Character</h1>
                <p className="text-muted-foreground">Build your character from the ground up</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
        </div>
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Game System</CardTitle>
              <CardDescription>Select the game system for your new character.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select onValueChange={(value) => setGameSystem(value as GameSystem)} value={gameSystem}>
                <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue placeholder="Select a game system..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dungeons & Dragons">Dungeons & Dragons</SelectItem>
                  <SelectItem value="Dark Heresy">Warhammer 40k: Dark Heresy</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {gameSystem === 'Dungeons & Dragons' && <DndCharacterForm />}
          {gameSystem === 'Dark Heresy' && <DarkHeresyCharacterForm />}
        </div>
      </main>
    </div>
  );
}
