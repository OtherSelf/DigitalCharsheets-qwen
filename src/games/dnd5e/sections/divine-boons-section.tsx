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
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import { DivineBoonsDialog } from './divine-boons-dialog';

interface DivineBoonsSectionProps {
  /**
   * Префикс для `id`: нужен, когда секция рендерится ещё и в листе
   * компаньона — иначе на странице появляются дубли `id`, а на них
   * держатся `htmlFor`, `aria-*`, якоря и селекторы `#...` в тестах.
   */
  idPrefix?: string;
  characterId: string;
  initialBoons: string[];
  isCompactView: boolean;
  activeCompactSection: string;
}

export const DndDivineBoonsSection = React.forwardRef<
  { saveAll: () => void },
  DivineBoonsSectionProps
>(
  (
    {
      characterId,
      initialBoons,
      isCompactView,
      activeCompactSection,
      idPrefix,
    },
    ref,
  ) => {
    const idp = idPrefix ? `${idPrefix}-` : '';
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isOpen, setIsOpen] = React.useState(true);
    const [divineBoons, setDivineBoons] =
      React.useState<string[]>(initialBoons);
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
          id={`${idp}divine-boons-section`}
          type="single"
          collapsible
          defaultValue="expanded"
          onValueChange={(val) => setIsOpen(val === 'expanded')}
          className={cn('flex-1', !isOpen && 'md:self-start')}
        >
          <AccordionItem value="expanded" className="border-0">
            <Card className="flex h-full flex-col overflow-hidden border-2">
              <CardHeader className="bg-muted/5 flex flex-row items-center justify-between px-4 pt-2 pb-2">
                <AccordionTrigger className="flex flex-1 items-center justify-between py-0 hover:no-underline">
                  <Label className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
                    {t('dnd.divineBoons')}
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
                    {t('common.add')}
                  </Button>
                )}
              </CardHeader>
              <AccordionContent>
                <CardContent className="p-4 pt-0">
                  {divineBoons.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs italic">
                      {t('dnd.noDivineBoons')}
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
                                    className="text-destructive hover:text-destructive ml-2 h-6 w-6 shrink-0"
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
                                <AccordionContent className="pt-1 pb-3">
                                  <p className="text-muted-foreground text-xs leading-relaxed">
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
              <AlertDialogTitle>{t('dnd.deleteDivineBoon')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dnd.deleteBoonWarning')}
                {boonToDelete !== null && divineBoons[boonToDelete] && (
                  <div className="bg-muted mt-2 rounded p-2">
                    <p className="text-sm font-semibold">
                      {divineBoons[boonToDelete].split(':')[0]}
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteBoon}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  },
);

DndDivineBoonsSection.displayName = 'DndDivineBoonsSection';
