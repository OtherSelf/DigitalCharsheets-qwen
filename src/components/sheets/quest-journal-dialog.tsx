'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
import { type Character, type Quest, type QuestObjective } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ChevronUp, ChevronDown, ScrollText, CheckCircle2, Circle, Swords, Star, User, MapPin, Gift, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface QuestJournalSheetProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterType = 'all' | 'active' | 'completed';

export function QuestJournalSheet({ character, open, onOpenChange }: QuestJournalSheetProps) {
  const { updateCharacter } = useCharacterContext();
  const { toast } = useToast();
  
  const [questLog, setQuestLog] = useState<Quest[]>(character.questLog ?? []);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [newObjectiveText, setNewObjectiveText] = useState<Record<string, string>>({});

  // --- AUTO-SAVE CORE ---
  const saveLog = (newLog: Quest[]) => {
    setQuestLog(newLog);
    updateCharacter(character.id, { questLog: newLog });
  };

  const updateQuest = (questId: string, updates: Partial<Quest>) => {
    const updatedLog = questLog.map(q =>
      q.id === questId ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
    );
    saveLog(updatedLog);
  };

  // --- QUEST ACTIONS ---
  const handleAddQuest = () => {
    if (!newQuestTitle.trim()) {
      toast({ variant: 'destructive', title: 'Title Required', description: 'Please enter a title.' });
      return;
    }
    const newQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: newQuestTitle.trim(),
      description: '',
      status: 'active',
      priority: 'side',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objectives: [],
      notes: '',
      rewards: '',
      npcs: '',
      locations: '',
    };
    saveLog([newQuest, ...questLog]);
    setNewQuestTitle('');
  };

  const handleDeleteQuest = (questId: string) => {
    saveLog(questLog.filter(q => q.id !== questId));
  };

  const moveQuest = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questLog.length) return;
    const newLog = [...questLog];
    [newLog[index], newLog[newIndex]] = [newLog[newIndex], newLog[index]];
    saveLog(newLog);
  };

  // --- OBJECTIVE ACTIONS ---
  const addObjective = (questId: string) => {
    const text = newObjectiveText[questId]?.trim();
    if (!text) return;
    const quest = questLog.find(q => q.id === questId);
    if (!quest) return;
    const newObj: QuestObjective = { id: `obj-${Date.now()}`, text, completed: false };
    updateQuest(questId, { objectives: [...(quest.objectives || []), newObj] });
    setNewObjectiveText(prev => ({ ...prev, [questId]: '' }));
  };

  const toggleObjective = (questId: string, objId: string) => {
    const quest = questLog.find(q => q.id === questId);
    if (!quest) return;
    const objs = (quest.objectives || []).map(o => o.id === objId ? { ...o, completed: !o.completed } : o);
    updateQuest(questId, { objectives: objs });
  };

  const deleteObjective = (questId: string, objId: string) => {
    const quest = questLog.find(q => q.id === questId);
    if (!quest) return;
    const objs = (quest.objectives || []).filter(o => o.id !== objId);
    updateQuest(questId, { objectives: objs });
  };

  // --- FILTERING & DERIVED DATA ---
  const filteredQuests = questLog.filter(q => {
    if (filter === 'active') return q.status === 'active';
    if (filter === 'completed') return q.status === 'completed';
    return true;
  });

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'main': return <Badge variant="destructive" className="text-[9px] h-4 px-1.5">Main</Badge>;
      case 'personal': return <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-yellow-500/20 text-yellow-600 border-yellow-500/50">Personal</Badge>;
      default: return <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-blue-500 border-blue-500/50">Side</Badge>;
    }
  };

  const getProgressText = (quest: Quest) => {
    if (!quest.objectives || quest.objectives.length === 0) return null;
    const done = quest.objectives.filter(o => o.completed).length;
    return <span className="text-[10px] font-bold text-muted-foreground ml-2">{done}/{quest.objectives.length}</span>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" /> Quest Journal
          </SheetTitle>
          <SheetDescription>
            Track your adventures. Changes save automatically.
          </SheetDescription>
          
          {/* Quick Filters */}
          <div className="flex gap-2 mt-4">
            {(['all', 'active', 'completed'] as FilterType[]).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-8 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f} {f === 'active' && `(${questLog.filter(q => q.status === 'active').length})`}
              </Button>
            ))}
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-grow">
          <div className="p-6 space-y-6">
            
            {/* Add Quest Form */}
            {filter !== 'completed' && (
              <div className="flex gap-2">
                <Input
                  placeholder="New quest title..."
                  value={newQuestTitle}
                  onChange={(e) => setNewQuestTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddQuest()}
                  className="flex-1"
                />
                <Button onClick={handleAddQuest} size="icon" className="shrink-0">
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Quest List */}
            {filteredQuests.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {filteredQuests.map((quest, index) => {
                  const isCompleted = quest.status === 'completed';
                  return (
                    <AccordionItem key={quest.id} value={quest.id} className="border rounded-lg bg-background shadow-sm overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between w-full items-center gap-2 pr-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getPriorityBadge(quest.priority)}
                            <span className={cn("font-semibold truncate text-sm", isCompleted && "line-through text-muted-foreground")}>
                              {quest.title}
                            </span>
                            {getProgressText(quest)}
                          </div>
                          <Badge variant={isCompleted ? 'secondary' : 'default'} className="text-[9px] h-4 px-1.5 shrink-0">
                            {isCompleted ? 'Done' : 'Active'}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 space-y-4 border-t bg-muted/5">
                        
                        {/* Status & Priority Controls */}
                        <div className="flex gap-2">
                          <Select value={quest.priority || 'side'} onValueChange={(v: any) => updateQuest(quest.id, { priority: v })}>
                            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">Main Quest</SelectItem>
                              <SelectItem value="side">Side Quest</SelectItem>
                              <SelectItem value="personal">Personal</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs flex-1"
                            onClick={() => updateQuest(quest.id, { status: isCompleted ? 'active' : 'completed' })}
                          >
                            Mark as {isCompleted ? 'Active' : 'Completed'}
                          </Button>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <ScrollText className="h-3 w-3" /> Description
                          </Label>
                          <Textarea
                            defaultValue={quest.description}
                            onBlur={(e) => updateQuest(quest.id, { description: e.target.value })}
                            placeholder="What is this quest about?"
                            className="text-sm min-h-[60px]"
                          />
                        </div>

                        {/* Objectives / Subtasks */}
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Objectives
                          </Label>
                          <div className="space-y-1">
                            {(quest.objectives || []).map(obj => (
                              <div key={obj.id} className="flex items-center gap-2 group">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => toggleObjective(quest.id, obj.id)}
                                >
                                  {obj.completed ? 
                                    <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                  }
                                </Button>
                                <Input 
                                  defaultValue={obj.text}
                                  onBlur={(e) => {
                                    const q = questLog.find(q => q.id === quest.id);
                                    const objs = (q?.objectives || []).map(o => o.id === obj.id ? {...o, text: e.target.value} : o);
                                    updateQuest(quest.id, { objectives: objs });
                                  }}
                                  className={cn("h-7 text-xs flex-1", obj.completed && "line-through text-muted-foreground")}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => deleteObjective(quest.id, obj.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Add objective..." 
                              value={newObjectiveText[quest.id] || ''}
                              onChange={(e) => setNewObjectiveText(prev => ({ ...prev, [quest.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addObjective(quest.id)}
                              className="h-7 text-xs flex-1"
                            />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addObjective(quest.id)}>
                              <PlusCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Details Grid (Rewards, NPCs, Locations) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <Gift className="h-3 w-3" /> Rewards
                            </Label>
                            <Input 
                              defaultValue={quest.rewards || ''}
                              onBlur={(e) => updateQuest(quest.id, { rewards: e.target.value })}
                              placeholder="XP, Gold, Items..."
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Locations
                            </Label>
                            <Input 
                              defaultValue={quest.locations || ''}
                              onBlur={(e) => updateQuest(quest.id, { locations: e.target.value })}
                              placeholder="Where to go..."
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Related NPCs
                            </Label>
                            <Input 
                              defaultValue={quest.npcs || ''}
                              onBlur={(e) => updateQuest(quest.id, { npcs: e.target.value })}
                              placeholder="Who is involved..."
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <StickyNote className="h-3 w-3" /> Notes
                          </Label>
                          <Textarea
                            defaultValue={quest.notes || ''}
                            onBlur={(e) => updateQuest(quest.id, { notes: e.target.value })}
                            placeholder="Session notes, clues, GM hints..."
                            className="text-xs min-h-[50px]"
                          />
                        </div>

                        {/* Footer: Reorder & Delete */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-[10px] text-muted-foreground">
                            Updated {format(new Date(quest.updatedAt), "MMM d, yyyy")}
                          </span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuest(questLog.findIndex(q => q.id === quest.id), 'up')} disabled={index === 0}>
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuest(questLog.findIndex(q => q.id === quest.id), 'down')} disabled={index === questLog.length - 1}>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteQuest(quest.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ScrollText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">
                  {filter === 'all' ? 'Your journal is empty.' : `No ${filter} quests.`}
                </p>
                <p className="text-xs mt-1">
                  {filter === 'all' ? 'Add a new quest above to begin your adventure.' : 'Try changing the filter or add a new quest.'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}