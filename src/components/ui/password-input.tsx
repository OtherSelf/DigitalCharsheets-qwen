'use client';

import * as React from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

import { Input } from './input';

/**
 * Поле пароля с глазком (D8). Тип переключается на `text`, значение и все
 * атрибуты (id, name, autocomplete, required, ref) остаются у самого
 * `<input>`: форма и авто-заполнение работают как раньше. Кнопка — обычный
 * `type="button"`, поэтому Enter по-прежнему отправляет форму.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ className, disabled, ...props }, ref) => {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);
  const label = visible ? t('common.hidePassword') : t('common.showPassword');

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        data-testid="password-toggle"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
