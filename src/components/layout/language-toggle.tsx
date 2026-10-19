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
      className={cn("font-bold text-xs", className)}
      onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
      title={language === 'en' ? t('switchToRussian') : t('switchToEnglish')}
    >
      {language === 'en' ? 'EN' : 'RU'}
    </Button>
  );
}