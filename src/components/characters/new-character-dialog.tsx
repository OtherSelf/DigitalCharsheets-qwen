'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { PenSquare, Wand2 } from 'lucide-react';

export function NewCharacterDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Character</DialogTitle>
          <DialogDescription>
            How would you like to start? Use our AI to generate a concept or build a character from scratch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
           <Button
            variant="outline"
            className="h-32 text-lg flex flex-col gap-2"
            onClick={() => router.push('/new')}
          >
            <Wand2 className="h-8 w-8" />
            <span>AI Concept Generator</span>
          </Button>
          <Button
            variant="outline"
            className="h-32 text-lg flex flex-col gap-2"
            onClick={() => router.push('/new/manual')}
          >
            <PenSquare className="h-8 w-8" />
            <span>Create Manually</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
