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
import { useTranslation } from '@/context/language-context';
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
  const { t } = useTranslation();
  
  const [questLog, setQuestLog] = useState<Quest[]>(character.questLog ?? []);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [newObjectiveText, setNewObjectiveText] = useState<Record<string, string>>({});

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

  const handleAddQuest = () => {
    if (!newQuestTitle.trim()) {
      toast({ variant: 'destructive', title: t('toastTitleRequired'), description: t('toastEnterTitle') });
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

  const filteredQuests = questLog.filter(q => {
    if (filter === 'active') return q.status === 'active';
    if (filter === 'completed') return q.status === 'completed';
    return true;
  });

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'main': return <Badge variant="destructive" className="text-[9px] h-4 px-1.5">{t('mainQuest')}</Badge>;
      case 'personal': return <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-yellow-500/20 text-yellow-600 border-yellow-500/50">{t('personalQuest')}</Badge>;
      default: return <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-blue-500 border-blue-500/50">{t('sideQuest')}</Badge>;
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
            <ScrollText className="h-5 w-5 text-primary" /> {t('questJournalTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('questJournalDesc')}
          </SheetDescription>
          
          <div className="flex gap-2 mt-4">
            {(['all', 'active', 'completed'] as FilterType[]).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-8 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? t('filterAll') : f === 'active' ? t('filterActive') : t('filterCompleted')}
                {f === 'active' && ` (${questLog.filter(q => q.status === 'active').length})`}
              </Button>
            ))}
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-grow">
          <div className="p-6 space-y-6">
            
            {filter !== 'completed' && (
              <div className="flex gap-2">
                <Input
                  placeholder={t('newQuestTitlePlaceholder')}
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
                            {isCompleted ? t('questDone') : t('questActive')}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 space-y-4 border-t bg-muted/5">
                        
                        <div className="flex gap-2">
                          <Select value={quest.priority || 'side'} onValueChange={(v: any) => updateQuest(quest.id, { priority: v })}>
                            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">{t('selectMainQuest')}</SelectItem>
                              <SelectItem value="side">{t('selectSideQuest')}</SelectItem>
                              <SelectItem value="personal">{t('selectPersonalQuest')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs flex-1"
                            onClick={() => updateQuest(quest.id, { status: isCompleted ? 'active' : 'completed' })}
                          >
                            {isCompleted ? t('markAsActive') : t('markAsCompleted')}
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <ScrollText className="h-3 w-3" /> {t('questDescription')}
                          </Label>
                          <Textarea
                            defaultValue={quest.description}
                            onBlur={(e) => updateQuest(quest.id, { description: e.target.value })}
                            placeholder={t('questDescriptionPlaceholder')}
                            className="text-sm min-h-[60px]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t('questObjectives')}
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
                              placeholder={t('addObjectivePlaceholder')} 
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <Gift className="h-3 w-3" /> {t('questRewards')}
                            </Label>
                            <Input 
                              defaultValue={quest.rewards || ''}
                              onBlur={(e) => updateQuest(quest.id, { rewards: e.target.value })}
                              placeholder={t('questRewardsPlaceholder')}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {t('questLocations')}
                            </Label>
                            <Input 
                              defaultValue={quest.locations || ''}
                              onBlur={(e) => updateQuest(quest.id, { locations: e.target.value })}
                              placeholder={t('questLocationsPlaceholder')}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {t('questNpcs')}
                            </Label>
                            <Input 
                              defaultValue={quest.npcs || ''}
                              onBlur={(e) => updateQuest(quest.id, { npcs: e.target.value })}
                              placeholder={t('questNpcsPlaceholder')}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <StickyNote className="h-3 w-3" /> {t('questNotes')}
                          </Label>
                          <Textarea
                            defaultValue={quest.notes || ''}
                            onBlur={(e) => updateQuest(quest.id, { notes: e.target.value })}
                            placeholder={t('questNotesPlaceholder')}
                            className="text-xs min-h-[50px]"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-[10px] text-muted-foreground">
                            {t('updated')} {format(new Date(quest.updatedAt), "MMM d, yyyy")}
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
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ScrollText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">
                  {filter === 'all' ? t('journalEmpty') : filter === 'active' ? t('noActiveQuests') : t('noCompletedQuests')}
                </p>
                <p className="text-xs mt-1">
                  {filter === 'all' ? t('journalEmptyDesc') : t('noFilteredQuestsDesc')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}