'use client';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage } = useTranslation();
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('text-xs font-bold', className)}
      onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
      title={
        language === 'en'
          ? t('common.switchToRussian')
          : t('common.switchToEnglish')
      }
    >
      {language === 'en' ? 'EN' : 'RU'}
    </Button>
  );
}
