'use client';

import * as React from 'react';

import { Plus, Trash2 } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

import { DivineBoonsDialog } from './divine-boons-dialog';

interface DivineBoonsSectionProps {
  characterId: string;
  initialBoons: string[];
  isCompactView: boolean;
  activeCompactSection: string;
}

export const DndDivineBoonsSection = React.forwardRef<
  { saveAll: () => void },
  DivineBoonsSectionProps
>(({ characterId, initialBoons, isCompactView, activeCompactSection }, ref) => {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = React.useState(true);
  const [divineBoons, setDivineBoons] = React.useState<string[]>(initialBoons);
  const [isBoonsDialogOpen, setIsBoonsDialogOpen] = React.useState(false);
  const [boonToDelete, setBoonToDelete] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDivineBoons(initialBoons);
  }, [characterId, initialBoons]);

  const handleAddBoon = (boon: { name: string; description: string }) => {
    const boonString = boon.description
      ? `${boon.name}: ${boon.description}`
      : boon.name;
    const updated = [...divineBoons, boonString];
    setDivineBoons(updated);
    updateCharacter(characterId, { divineBoons: updated });
  };

  const handleDeleteBoon = (index: number) => {
    setBoonToDelete(index);
  };

  const confirmDeleteBoon = () => {
    if (boonToDelete !== null) {
      const updated = divineBoons.filter((_, idx) => idx !== boonToDelete);
      setDivineBoons(updated);
      updateCharacter(characterId, { divineBoons: updated });
      setBoonToDelete(null);
    }
  };

  React.useImperativeHandle(ref, () => ({
    saveAll: () => {},
  }));

  return (
    <>
      <Accordion
        id="divine-boons-section"
        type="single"
        collapsible
        defaultValue="expanded"
        onValueChange={(val) => setIsOpen(val === 'expanded')}
        className={cn('flex-1', !isOpen && 'md:self-start')}
      >
        <AccordionItem value="expanded" className="border-0">
          <Card className="flex h-full flex-col overflow-hidden border-2">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/5 px-4 pb-2 pt-2">
              <AccordionTrigger className="flex flex-1 items-center justify-between py-0 hover:no-underline">
                <Label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                  {t('divineBoons')}
                </Label>
              </AccordionTrigger>
              {showEditButtons && (
                <Button
                  data-testid="add-boon-button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBoonsDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t('add')}
                </Button>
              )}
            </CardHeader>
            <AccordionContent>
              <CardContent className="p-4 pt-0">
                {divineBoons.length === 0 ? (
                  <p className="py-4 text-center text-xs italic text-muted-foreground">
                    {t('noDivineBoons')}
                  </p>
                ) : (
                  <div
                    className={cn(
                      'grid gap-2',
                      divineBoons.length > 4
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1',
                    )}
                  >
                    {divineBoons.map((boon, i) => {
                      const [boonName, ...boonDescParts] = boon.split(': ');
                      const boonDesc = boonDescParts.join(': ');

                      return (
                        <Accordion
                          key={i}
                          type="single"
                          collapsible
                          className="w-full rounded-lg border"
                        >
                          <AccordionItem value={`boon-${i}`} className="px-3">
                            <div className="flex items-center justify-between">
                              <AccordionTrigger className="flex-1 py-2 text-left hover:no-underline">
                                <span className="text-sm font-semibold">
                                  {boonName}
                                </span>
                              </AccordionTrigger>
                              {showEditButtons && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-2 h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBoon(i);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {boonDesc && (
                              <AccordionContent className="pb-3 pt-1">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {boonDesc}
                                </p>
                              </AccordionContent>
                            )}
                          </AccordionItem>
                        </Accordion>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <DivineBoonsDialog
        open={isBoonsDialogOpen}
        onOpenChange={setIsBoonsDialogOpen}
        onAddBoon={handleAddBoon}
      />

      <AlertDialog
        open={boonToDelete !== null}
        onOpenChange={() => setBoonToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDivineBoon')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteBoonWarning')}
              {boonToDelete !== null && divineBoons[boonToDelete] && (
                <div className="mt-2 rounded bg-muted p-2">
                  <p className="text-sm font-semibold">
                    {divineBoons[boonToDelete].split(':')[0]}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBoon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

DndDivineBoonsSection.displayName = 'DndDivineBoonsSection';
