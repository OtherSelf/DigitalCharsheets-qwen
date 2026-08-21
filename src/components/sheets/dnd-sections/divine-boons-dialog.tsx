'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EPIC_BOONS, type EpicBoon } from '@/lib/epic-boons';
import { useTranslation } from '@/context/language-context';

interface DivineBoonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBoon: (boon: { name: string; description: string }) => void;
}

export function DivineBoonsDialog({ open, onOpenChange, onAddBoon }: DivineBoonsDialogProps) {
  const { t } = useTranslation();
  const [selectedBoon, setSelectedBoon] = React.useState<string>('');
  const [customBoonName, setCustomBoonName] = React.useState('');
  const [customBoonDesc, setCustomBoonDesc] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'official' | 'custom'>('official');

  const selectedBoonData = EPIC_BOONS.find(b => b.name === selectedBoon);

  const handleAddOfficial = () => {
    if (selectedBoonData) {
      onAddBoon({
        name: selectedBoonData.name,
        description: selectedBoonData.description,
      });
      setSelectedBoon('');
      onOpenChange(false);
    }
  };

  const handleAddCustom = () => {
    if (customBoonName.trim()) {
      onAddBoon({
        name: customBoonName.trim(),
        description: customBoonDesc.trim(),
      });
      setCustomBoonName('');
      setCustomBoonDesc('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedBoon('');
    setCustomBoonName('');
    setCustomBoonDesc('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Divine Boon</DialogTitle>
          <DialogDescription>
            Choose an official Epic Boon or create a custom one for your character.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'official' | 'custom')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">Official Boons</TabsTrigger>
            <TabsTrigger value="custom">Custom Boon</TabsTrigger>
          </TabsList>

          {/* Official Boons Tab */}
          <TabsContent value="official" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select an Epic Boon</Label>
              <Select value={selectedBoon} onValueChange={setSelectedBoon}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a boon..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {EPIC_BOONS.map((boon) => (
                    <SelectItem key={boon.name} value={boon.name}>
                      {boon.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBoonData && (
              <div className="p-4 rounded-lg bg-muted border">
                <h4 className="font-semibold mb-2">{selectedBoonData.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedBoonData.description}</p>
              </div>
            )}
          </TabsContent>

          {/* Custom Boon Tab */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Boon Name</Label>
              <Input
                value={customBoonName}
                onChange={(e) => setCustomBoonName(e.target.value)}
                placeholder="e.g., Boon of Eternal Vigilance"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={customBoonDesc}
                onChange={(e) => setCustomBoonDesc(e.target.value)}
                placeholder="Describe what this boon does..."
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={activeTab === 'official' ? handleAddOfficial : handleAddCustom}
            disabled={activeTab === 'official' ? !selectedBoon : !customBoonName.trim()}
          >
            Add Boon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}