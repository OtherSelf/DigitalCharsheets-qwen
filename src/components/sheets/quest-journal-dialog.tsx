'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { type Character, type Quest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface QuestJournalSheetProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuestJournalSheet({ character, open, onOpenChange }: QuestJournalSheetProps) {
  const { updateCharacter } = useCharacterContext();
  const { toast } = useToast();
  const [questLog, setQuestLog] = useState<Quest[]>(character.questLog ?? []);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestDescription, setNewQuestDescription] = useState('');
  const [isNewQuestOpen, setIsNewQuestOpen] = useState(false);

  const handleSaveChanges = () => {
    updateCharacter(character.id, { questLog });
    toast({
      title: 'Quest Journal Saved',
      description: 'Your journal has been updated.',
    });
    onOpenChange(false);
  };

  const handleAddQuest = () => {
    if (!newQuestTitle) {
      toast({
        variant: 'destructive',
        title: 'Title Required',
        description: 'Please enter a title for the new quest.',
      });
      return;
    }
    const newQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: newQuestTitle,
      description: newQuestDescription,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuestLog([newQuest, ...questLog]);
    setNewQuestTitle('');
    setNewQuestDescription('');
    setIsNewQuestOpen(false);
  };
  
  const handleUpdateQuestDescription = (questId: string, description: string) => {
    setQuestLog(questLog.map(q => q.id === questId ? {...q, description, updatedAt: new Date().toISOString()} : q));
  }

  const handleUpdateQuestStatus = (questId: string, status: 'active' | 'completed') => {
      setQuestLog(questLog.map(q => q.id === questId ? {...q, status, updatedAt: new Date().toISOString()} : q));
  }

  const handleDeleteQuest = (questId: string) => {
    setQuestLog(questLog.filter(q => q.id !== questId));
  };
  
  const activeQuests = questLog.filter(q => q.status === 'active');
  const completedQuests = questLog.filter(q => q.status === 'completed');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Quest Journal</SheetTitle>
          <SheetDescription>
            Track your adventures, tasks, and objectives. Changes are saved when you close the journal.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-6">
                <div className="space-y-4">
                    <Collapsible
                        open={isNewQuestOpen}
                        onOpenChange={setIsNewQuestOpen}
                        className="p-4 border rounded-lg bg-background"
                    >
                        <CollapsibleTrigger asChild>
                            <div className="flex justify-between items-center w-full cursor-pointer">
                                <h3 className="text-lg font-semibold">New Quest Entry</h3>
                                <div className="w-9 h-9 flex items-center justify-center">
                                    <ChevronRight className={cn("h-4 w-4 transition-transform", isNewQuestOpen && "rotate-90")} />
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-2 pt-4">
                                <Label htmlFor="new-quest-title">Quest Title</Label>
                                <Input
                                    id="new-quest-title"
                                    value={newQuestTitle}
                                    onChange={(e) => setNewQuestTitle(e.target.value)}
                                    placeholder="e.g., Clear out the goblin cave"
                                />
                                <Label htmlFor="new-quest-description">Description</Label>
                                <Textarea
                                    id="new-quest-description"
                                    value={newQuestDescription}
                                    onChange={(e) => setNewQuestDescription(e.target.value)}
                                    placeholder="Details about the quest..."
                                />
                            </div>
                            <Button onClick={handleAddQuest} className="mt-4 w-full">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Quest to Journal
                            </Button>
                        </CollapsibleContent>
                    </Collapsible>

                    <h3 className="text-lg font-semibold mt-6">Active Quests</h3>
                    {activeQuests.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {activeQuests.map((quest) => (
                                <AccordionItem value={quest.id} key={quest.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full pr-4 items-center">
                                            <span>{quest.title}</span>
                                            <Badge variant="secondary">Active</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`quest-desc-${quest.id}`}>Description</Label>
                                            <Textarea
                                                id={`quest-desc-${quest.id}`}
                                                value={quest.description}
                                                onChange={(e) => handleUpdateQuestDescription(quest.id, e.target.value)}
                                                placeholder="No description provided."
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Updated: {format(new Date(quest.updatedAt), "PPP")}</span>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleUpdateQuestStatus(quest.id, 'completed')}>Mark Completed</Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleDeleteQuest(quest.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : <p className="text-sm text-muted-foreground">No active quests.</p> }
                    
                    <h3 className="text-lg font-semibold mt-6">Completed Quests</h3>
                     {completedQuests.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {completedQuests.map((quest) => (
                                <AccordionItem value={quest.id} key={quest.id}>
                                    <AccordionTrigger>
                                       <div className="flex justify-between w-full pr-4 items-center">
                                            <span className="line-through">{quest.title}</span>
                                            <Badge variant="outline">Completed</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`quest-desc-${quest.id}`}>Description</Label>
                                            <Textarea
                                                id={`quest-desc-${quest.id}`}
                                                value={quest.description}
                                                onChange={(e) => handleUpdateQuestDescription(quest.id, e.target.value)}
                                                placeholder="No description provided."
                                                className="text-sm"
                                            />
                                        </div>
                                         <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Completed: {format(new Date(quest.updatedAt), "PPP")}</span>
                                             <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleUpdateQuestStatus(quest.id, 'active')}>Mark Active</Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleDeleteQuest(quest.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                     ) : <p className="text-sm text-muted-foreground">No completed quests yet.</p> }
                </div>
            </ScrollArea>
        </div>

        <SheetFooter className="pt-4">
          <SheetClose asChild>
            <Button type="button" onClick={handleSaveChanges}>
              Save and Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
