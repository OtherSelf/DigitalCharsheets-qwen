'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * ─── LANDMARK: NARRATIVE MARKDOWN ──────────────────────────────────────────
 * Markdown для `notes`/`backstory` (D11). Рендер без `rehype-raw`: сырой HTML
 * в тексте игрока не исполняется, react-markdown показывает его как текст.
 * `@tailwindcss/typography` в проекте нет, поэтому стили заданы через
 * `components` — это дешевле, чем новый плагин (D2).
 */
export function NarrativeMarkdown({ value }: { value: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2 text-lg font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-2 first:mt-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="my-1">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-muted-foreground/40 text-muted-foreground my-2 border-l-2 pl-3 italic">
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
