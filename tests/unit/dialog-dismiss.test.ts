import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Все модальные окна должны закрываться Esc и кликом мимо. Radix Dialog и
 * Sheet это умеют по умолчанию; блокируют поведение только явные
 * `onEscapeKeyDown`/`onInteractOutside`/`onPointerDownOutside` с
 * `preventDefault`. Тест ловит такое в ядре и плагинах: исключений сейчас нет,
 * а «не закрывать, пока идёт запрос» решается в `onOpenChange`, не здесь.
 */
function walk(dir: string, result: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push(full);
  }
  return result;
}

const BLOCKING =
  /on(?:EscapeKeyDown|InteractOutside|PointerDownOutside)\s*=\s*\{[^}]*preventDefault/;

describe('модальные окна закрываются Esc и кликом мимо', () => {
  it('в src нет обработчиков, блокирующих закрытие', () => {
    const offenders = walk(path.join(process.cwd(), 'src'))
      .filter((file) => BLOCKING.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it('AlertDialog построен на Dialog, а не на Radix AlertDialog', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/alert-dialog.tsx'),
      'utf8',
    );
    expect(source).toContain("from '@radix-ui/react-dialog'");
    expect(source).not.toContain("from '@radix-ui/react-alert-dialog'");
  });
});
