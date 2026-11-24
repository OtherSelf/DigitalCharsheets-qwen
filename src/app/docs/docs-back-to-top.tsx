'use client';

import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';

/**
 * «Наверх» в конце статьи. Кнопка в потоке, а не `fixed`: документация
 * скроллится внутри `.docs-scroll`, а фиксированный элемент внутри
 * масштабируемой обёртки приложения считал бы координаты от неё. Липкое
 * оглавление Fumadocs уже закрывает десктоп, поэтому здесь — конец статьи,
 * где длинный текст и заканчивается.
 */
export function DocsBackToTop() {
  const { t } = useTranslation();

  const scrollToTop = () => {
    document
      .querySelector('.docs-scroll')
      ?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mt-10 flex justify-end border-t pt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={scrollToTop}
        data-testid="docs-back-to-top"
      >
        <ArrowUp className="mr-2 h-4 w-4" />
        {t('docs.backToTop')}
      </Button>
    </div>
  );
}
