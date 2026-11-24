'use client';

import Link from 'next/link';

import { FileDown, Settings2, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { downloadJSON } from '@/lib/download';
import { buildBackupExport, exportFileName } from '@/lib/export-utils';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: TOOLS MENU ──────────────────────────────────────────────────
 * Один вход в инструменты вместо дублей на дашборде: редактор характеристик
 * (страница) и резервная копия всех листов (действие). Живёт в шапке, поэтому
 * доступен с любого экрана; на телефоне — та же кнопка, а не отдельные пункты
 * в нижней панели.
 */
export function ToolsMenu() {
  const { t } = useTranslation();
  const { user } = useLocalAuth();

  // «Backup All»: сервер отдаёт листы, клиент упаковывает их в стандартный
  // конверт и называет файл по шаблону dcs_characters_all_<логин>_<дата>.json.
  const handleBackupAll = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/export');
      if (!response.ok) {
        console.error(
          'Backup export failed:',
          response.status,
          await response.text(),
        );
        return;
      }
      const exported = await response.json();
      const backup = buildBackupExport(exported as Character[], user.username);
      downloadJSON(backup, exportFileName('backup', { login: user.username }));
    } catch (error) {
      console.error('Backup export failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.tools')}
          title={t('common.tools')}
          data-testid="tools-menu-trigger"
        >
          <Wrench className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link
            href="/stats-editor"
            className="flex cursor-pointer items-center"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            <span>{t('common.statsEditor')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex cursor-pointer items-center"
          disabled={!user}
          onSelect={() => {
            void handleBackupAll();
          }}
          data-testid="tools-backup"
        >
          <FileDown className="mr-2 h-4 w-4" />
          <span>{t('common.backupAll')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
