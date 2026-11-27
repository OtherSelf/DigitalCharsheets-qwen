'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/**
 * ─── LANDMARK: NARRATIVE MARKDOWN ──────────────────────────────────────────
 * Markdown для `notes`/`backstory` и публичных документов (`/privacy`).
 * Рендер без `rehype-raw`: сырой HTML в тексте игрока не исполняется,
 * react-markdown показывает его как текст.
 * `@tailwindcss/typography` в проекте нет, поэтому стили заданы через
 * `components` — это дешевле, чем новый плагин.
 *
 * `variant="document"` — для юридического текста: базовый кегль вместо
 * мелкого «заметки», воздух между разделами и разделитель перед каждым
 * `h2`, чтобы длинный документ читался как страница, а не как поле листа.
 */
export type NarrativeMarkdownVariant = 'note' | 'document';

const STYLES = {
  note: {
    root: 'text-sm leading-relaxed break-words',
    h1: 'mt-5 mb-2 text-lg font-semibold first:mt-0',
    h2: 'mt-4 mb-2 text-base font-semibold first:mt-0',
    h3: 'mt-3 mb-1.5 text-sm font-semibold first:mt-0',
    p: 'my-2 first:mt-0',
    ul: 'my-2 list-disc pl-5',
    ol: 'my-2 list-decimal pl-5',
    li: 'my-1',
    // В заметке ссылку видно по цвету: вокруг текст игрока, контраст не гейтится.
    a: 'text-primary underline-offset-2 hover:underline',
  },
  document: {
    root: 'text-15px leading-7 break-words md:text-base md:leading-8',
    h1: 'mt-8 mb-3 text-2xl font-bold text-balance first:mt-0',
    h2: 'border-border mt-8 mb-3 border-t pt-6 text-xl font-semibold text-balance first:mt-0 first:border-t-0 first:pt-0',
    h3: 'mt-5 mb-2 text-base font-semibold',
    p: 'my-3 first:mt-0',
    ul: 'my-3 list-disc space-y-1.5 pl-5',
    ol: 'my-3 list-decimal space-y-1.5 pl-5',
    li: 'my-0',
    // В документе ссылка остаётся цвета текста: `text-primary` на фоне страницы
    // не проходит порог контраста WCAG AA для обычного кегля (ловит a11y-гейт),
    // а подчёркивание и так отличает её от прозы.
    a: 'text-foreground underline underline-offset-2',
  },
} as const;

export function NarrativeMarkdown({
  value,
  variant = 'note',
}: {
  value: string;
  variant?: NarrativeMarkdownVariant;
}) {
  const s = STYLES[variant];

  return (
    <div className={s.root}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={s.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={s.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={s.h3}>{children}</h3>,
          p: ({ children }) => <p className={s.p}>{children}</p>,
          ul: ({ children }) => <ul className={s.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={s.ol}>{children}</ol>,
          li: ({ children }) => <li className={s.li}>{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              className={s.a}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                'border-muted-foreground/40 text-muted-foreground my-2 border-l-2 pl-3 italic',
                variant === 'document' && 'my-4',
              )}
            >
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => (
            <code
              className={
                className
                  ? 'font-mono text-xs'
                  : 'bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]'
              }
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted my-2 overflow-x-auto rounded-md p-3 text-xs [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border px-2 py-1 text-left align-top font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border px-2 py-1 align-top">{children}</td>
          ),
          hr: () => <hr className="border-border my-4" />,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          input: (props) => (
            // GFM-чекбоксы в списках: read-only, иначе лист выглядит редактируемым.
            <input
              {...props}
              disabled
              className="mr-1.5 h-3.5 w-3.5 align-middle"
            />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
