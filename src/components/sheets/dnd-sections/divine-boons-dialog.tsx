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
import { EPIC_BOON_KEYS, type EpicBoonKey } from '@/lib/epic-boons';
import { useTranslation } from '@/context/language-context';

interface DivineBoonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBoon: (boon: { name: string; description: string }) => void;
}

export function DivineBoonsDialog({ open, onOpenChange, onAddBoon }: DivineBoonsDialogProps) {
  const { t } = useTranslation();
  const [selectedBoon, setSelectedBoon] = React.useState<EpicBoonKey | ''>('');
  const [customBoonName, setCustomBoonName] = React.useState('');
  const [customBoonDesc, setCustomBoonDesc] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'official' | 'custom'>('official');

  const handleAddOfficial = () => {
    if (selectedBoon) {
      onAddBoon({
        name: t(selectedBoon),
        description: t(selectedBoon + 'Desc'),
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
          <DialogTitle>{t('addDivineBoon')}</DialogTitle>
          <DialogDescription>{t('chooseEpicBoonDesc')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'official' | 'custom')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">{t('officialBoons')}</TabsTrigger>
            <TabsTrigger value="custom">{t('customBoon')}</TabsTrigger>
          </TabsList>

          <TabsContent value="official" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('selectEpicBoon')}</Label>
              <Select value={selectedBoon} onValueChange={(v) => setSelectedBoon(v as EpicBoonKey)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('chooseABoon')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {EPIC_BOON_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBoon && (
              <div className="p-4 rounded-lg bg-muted border">
                <h4 className="font-semibold mb-2">{t(selectedBoon)}</h4>
                <p className="text-sm text-muted-foreground">{t(selectedBoon + 'Desc')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('boonName')}</Label>
              <Input
                value={customBoonName}
                onChange={(e) => setCustomBoonName(e.target.value)}
                placeholder={t('boonNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                value={customBoonDesc}
                onChange={(e) => setCustomBoonDesc(e.target.value)}
                placeholder={t('boonDescriptionPlaceholder')}
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={activeTab === 'official' ? handleAddOfficial : handleAddCustom}
            disabled={activeTab === 'official' ? !selectedBoon : !customBoonName.trim()}
          >
            {t('addBoon')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}