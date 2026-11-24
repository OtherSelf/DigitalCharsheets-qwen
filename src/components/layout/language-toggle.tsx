'use client';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, t } = useTranslation();
  const { user } = useLocalAuth();

  const handleClick = () => {
    const next = language === 'en' ? 'ru' : 'en';
    setLanguage(next);

    /*
      Профиль — для другого устройства; cookie уже записана `setLanguage`, и
      первый кадр этой сессии от неё и работает. Ошибку сохранения не
      показываем: выбор языка не операция над данными, а при следующем
      переключении запрос повторится.
    */
    if (!user) return;
    void fetch('/api/auth/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next }),
    }).catch(() => {
      // Сеть недоступна — cookie и localStorage уже несут выбор.
    });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('text-xs font-bold', className)}
      onClick={handleClick}
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
