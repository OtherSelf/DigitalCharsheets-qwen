import { cn } from '@/lib/utils';

export function Loader({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-primary animate-spin', className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * Полноэкранный индикатор загрузки страницы.
 *
 * Отдельным компонентом, а не `app/loading.tsx`: файл `loading.tsx` в App
 * Router создаёт Suspense-границу вокруг страницы, и на динамическом маршруте
 * сервер отдаёт оболочку с заглушкой раньше, чем страница успевает вызвать
 * `notFound()` — настоящий 404 превращался в 200 с экраном «не найдено» в
 * теле ответа. Индикатор нужен страницам, которые ждут данные на клиенте.
 */
export function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader />
    </div>
  );
}
