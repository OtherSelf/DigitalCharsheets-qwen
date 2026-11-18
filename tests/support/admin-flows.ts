/**
 * Хелперы админских тестов: PATCH/DELETE-запросы, `params` сегмента uid и
 * засев аккаунтов через серверные функции (без HTTP-регистрации).
 */

import { expect } from 'vitest';

import { createServiceAdmin, registerUser } from '@/lib/server-auth';

/** PATCH с JSON-телом по заглушке URL: роут читает только метод и тело. */
export const patch = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/admin/test', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

export const del = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'DELETE', headers });

export const get = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'GET', headers });

export const params = (uid: string) => ({
  params: Promise.resolve({ uid }),
});

export function seedAdmin(username = 'admin', password = 'admin-pass-1') {
  const result = createServiceAdmin(username, password, 'Administrator');
  expect(result.success).toBe(true);
  return { uid: result.user!.uid, username, password };
}

export function seedUser(username = 'hero', password = 'user-pass-1234') {
  const result = registerUser(
    username,
    password,
    'Hero',
    'amber cobalt lantern',
  );
  expect(result.success).toBe(true);
  return { uid: result.user!.uid, username, password };
}
