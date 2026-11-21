'use client';

import * as React from 'react';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

/**
 * Закрытие правой шторки свайпом: `SheetContent` не знает `onOpenChange`,
 * поэтому Root передаёт колбэк через контекст. Значение `undefined` — шторка
 * вне `Sheet` (или закрытие не контролируется), свайп просто выключен.
 */
const SheetOpenContext = React.createContext<
  ((open: boolean) => void) | undefined
>(undefined);

function Sheet({
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return (
    <SheetOpenContext.Provider value={onOpenChange}>
      <SheetPrimitive.Root onOpenChange={onOpenChange} {...props}>
        {children}
      </SheetPrimitive.Root>
    </SheetOpenContext.Provider>
  );
}

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SWIPE_IGNORE =
  'input, textarea, select, [contenteditable="true"], [data-sheet-swipe-ignore]';
const SWIPE_MIN_DISTANCE = 80;
const SWIPE_MIN_RATIO = 0.25;
const SWIPE_MIN_VELOCITY = 0.5;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, style, children, ...props }, ref) => {
  const { t } = useTranslation();
  const closeSheet = React.useContext(SheetOpenContext);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const gesture = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
    active: boolean;
  } | null>(null);

  const horizontal = side === 'right' || side === 'left';
  const swipeEnabled = horizontal && Boolean(closeSheet);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled || event.pointerType !== 'touch') return;
    if ((event.target as HTMLElement | null)?.closest(SWIPE_IGNORE)) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      active: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (!current.active) {
      const direction = side === 'right' ? dx > 0 : dx < 0;
      if (!direction || Math.abs(dx) <= Math.abs(dy)) return;
      current.active = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    setDragX(side === 'right' ? Math.max(0, dx) : Math.min(0, dx));
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.active) return;

    const dx = event.clientX - current.startX;
    const width = event.currentTarget.offsetWidth;
    const elapsed = Math.max(1, event.timeStamp - current.startedAt);
    const velocity = Math.abs(dx) / elapsed;
    const farEnough =
      Math.abs(dx) > Math.max(SWIPE_MIN_DISTANCE, width * SWIPE_MIN_RATIO);

    setDragging(false);
    setDragX(0);
    if (farEnough || velocity > SWIPE_MIN_VELOCITY) {
      closeSheet?.(false);
    }
  };

  const cancelGesture = () => {
    gesture.current = null;
    setDragging(false);
    setDragX(0);
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          sheetVariants({ side }),
          dragging && 'select-none',
          className,
        )}
        style={{
          ...style,
          touchAction: swipeEnabled ? 'pan-y' : undefined,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-testid="sheet-close"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none md:h-4 md:w-4"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('common.close')}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-foreground text-lg font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
