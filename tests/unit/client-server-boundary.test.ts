import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Клиентские компоненты не должны импортировать серверные модули: Next
 * собирает их в браузерный бандл, и Node-криптография падает уже на импорте.
 * Регрессия: `login/page.tsx` брал `MIN_PASSWORD_LENGTH` из
 * `security/password.ts`, а тот через `scrypt.ts` вызывал
 * `promisify(crypto.scrypt)` — в браузере `crypto.scrypt` отсутствует, и
 * страница входа падала с Runtime TypeError.
 */

const ROOTS = ['src/app', 'src/components', 'src/context', 'src/hooks'];
const CLIENT = /^\s*['"]use client['"]/;
const SERVER_MODULE =
  /^@\/lib\/(security\/(password|scrypt|phrase)|server-auth|server-storage|session|user-schema|user-index|shares|admin-users|admin-auth|character-history|character-schema|game-catalog)$/;
const NODE_MODULE = /^(node:)?(fs|crypto|util|path|os)$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('граница клиент/сервер', () => {
  it('use client файлы не тянут серверные модули и node-встроенные', () => {
    const violations: string[] = [];

    for (const file of ROOTS.flatMap((root) => walk(root))) {
      const source = fs.readFileSync(file, 'utf8');
      if (!CLIENT.test(source.slice(0, 300))) continue;
      for (const line of source.split('\n')) {
        if (/^\s*import\s+type\b/.test(line)) continue;
        const match = /from\s+['"]([^'"]+)['"]/.exec(line);
        if (!match) continue;
        const specifier = match[1];
        if (SERVER_MODULE.test(specifier) || NODE_MODULE.test(specifier)) {
          violations.push(`${file}: ${specifier}`);
        }
      }
    }

    expect(violations, 'серверный импорт в use client').toEqual([]);
  });
});
