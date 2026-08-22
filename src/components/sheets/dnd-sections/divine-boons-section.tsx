'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
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
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { DivineBoonsDialog } from './divine-boons-dialog';
import { cn } from '@/lib/utils';

interface DivineBoonsSectionProps {
  characterId: string;
  initialBoons: string[];
  isCompactView: boolean;
  activeCompactSection: string;
}

export const DndDivineBoonsSection = React.forwardRef<{ saveAll: () => void }, DivineBoonsSectionProps>(
  ({ characterId, initialBoons, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();
    
    const [divineBoons, setDivineBoons] = React.useState<string[]>(initialBoons);
    const [isBoonsDialogOpen, setIsBoonsDialogOpen] = React.useState(false);
    const [boonToDelete, setBoonToDelete] = React.useState<number | null>(null); 

    React.useEffect(() => {
      setDivineBoons(initialBoons);
    }, [characterId, initialBoons]);

    const handleAddBoon = (boon: { name: string; description: string }) => {
      const boonString = boon.description ? `${boon.name}: ${boon.description}` : boon.name;
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
      saveAll: () => {
        // Boons are saved immediately on change
      }
    }));

    // FIX: Wrapped everything in a React Fragment (<> ... </>)
    return (
      <>
        <Accordion type="single" collapsible defaultValue="expanded" className="flex-1">
          <AccordionItem value="expanded" className="border-0">
            <Card className="flex flex-col border-2 overflow-hidden h-full">
              <CardHeader className="px-4 pt-2 pb-2 bg-muted/5 flex flex-row items-center justify-between">
                <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">
                    {t('divineBoons')}
                  </Label>
                </AccordionTrigger>
                {showEditButtons && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={(e) => { 
                      e.stopPropagation(); // Prevents accordion from toggling
                      setIsBoonsDialogOpen(true); 
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <AccordionContent>
                <CardContent className="p-4 pt-0">
                  {divineBoons.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      No divine boons yet
                    </p>
                  ) : (
                    <div className={cn(
                      "grid gap-2",
                      divineBoons.length > 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                    )}>
                      {divineBoons.map((boon, i) => {
                        const [boonName, ...boonDescParts] = boon.split(': ');
                        const boonDesc = boonDescParts.join(': ');
                        
                        return (
                          <Accordion 
                            key={i} 
                            type="single" 
                            collapsible 
                            className="w-full border rounded-lg"
                          >
                            <AccordionItem value={`boon-${i}`} className="px-3">
                              <div className="flex items-center justify-between">
                                <AccordionTrigger className="flex-1 text-left hover:no-underline py-2">
                                  <span className="font-semibold text-sm">{boonName}</span>
                                </AccordionTrigger>
                                {showEditButtons && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-2 text-destructive hover:text-destructive shrink-0"
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
                                  <p className="text-xs text-muted-foreground leading-relaxed">
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

        {/* Dialogs moved OUTSIDE Accordion so they work even when collapsed */}
        <DivineBoonsDialog 
          open={isBoonsDialogOpen} 
          onOpenChange={setIsBoonsDialogOpen} 
          onAddBoon={handleAddBoon} 
        />
        <AlertDialog open={boonToDelete !== null} onOpenChange={() => setBoonToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Divine Boon</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this boon? This action cannot be undone.
                {boonToDelete !== null && divineBoons[boonToDelete] && (
                  <div className="mt-2 p-2 rounded bg-muted">
                    <p className="text-sm font-semibold">
                      {divineBoons[boonToDelete].split(':')[0]}
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteBoon}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

DndDivineBoonsSection.displayName = 'DndDivineBoonsSection';