'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        // Boons are saved immediately on change, so nothing to do here
      }
    }));

    return (
      <div className={cn(
        "flex-1",
        isCompactView && activeCompactSection !== 'boons-section' && "hidden"
      )}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">
              {t('divineBoons')}
            </CardTitle>
            {showEditButtons && (
              <Button size="sm" variant="outline" onClick={() => setIsBoonsDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {divineBoons.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                No divine boons yet
              </p>
            ) : (
              <div className={cn(
                "grid gap-2",
                divineBoons.length > 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
                "items-start"
              )}>
                {divineBoons.map((boon, i) => {
                  // Parse boon string: "Name: Description" or just "Name"
                  const [boonName, ...boonDescParts] = boon.split(': ');
                  const boonDesc = boonDescParts.join(': ');
                  
                  return (
                    <div key={i} className="min-h-[52px] h-auto">
                      <Accordion 
                        type="single" 
                        collapsible 
                        className="w-full border rounded-lg h-full"
                      >
                        <AccordionItem value={`boon-${i}`} className="px-3 h-full">
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
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Divine Boons Dialog - ADDED THIS */}
            <DivineBoonsDialog
              open={isBoonsDialogOpen}
              onOpenChange={setIsBoonsDialogOpen}
              onAddBoon={handleAddBoon}
            />
            
            {/* Delete Confirmation Dialog */}
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
          </CardContent>
        </Card>
      </div>
    );
  }
);

DndDivineBoonsSection.displayName = 'DndDivineBoonsSection';