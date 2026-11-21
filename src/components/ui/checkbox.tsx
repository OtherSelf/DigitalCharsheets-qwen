'use client';

import * as React from 'react';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> {
  /**
   * Не рисовать галочку внутри: для маленьких боксов (12px в
   * «Характеристиках») достаточно заливки, иконка не вписывается и выглядит
   * инородно.
   */
  hideIndicator?: boolean;
  /**
   * Компактная точка: видимая часть 12x12, зона нажатия — весь бокс 24x24.
   * Нужна там, где точек много подряд (характеристики DH): увеличивать сам
   * квадратик нельзя — раскладка 5x9 не влезет, а промах пальцем остаётся.
   */
  dot?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, hideIndicator = false, dot = false, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      dot &&
        'group flex h-6 w-6 items-center justify-center border-0 bg-transparent data-[state=checked]:bg-transparent',
      className,
    )}
    {...props}
  >
    {dot ? (
      <span
        aria-hidden
        className="border-primary group-data-[state=checked]:bg-primary h-3 w-3 rounded-sm border"
      />
    ) : (
      !hideIndicator && (
        <CheckboxPrimitive.Indicator
          className={cn('flex items-center justify-center text-current')}
        >
          <Check className="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      )
    )}
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
