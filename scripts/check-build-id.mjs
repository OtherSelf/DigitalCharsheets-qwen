#!/usr/bin/env node
// ============================================================================
//  scripts/check-build-id.mjs — проверка идентификатора сборки по HTTP
//
//  Что проверяет: HTML отдаёт `data-dpl-id`, ссылки на `/_next/static`
//  подписаны `?dpl=`, и `GET /api/version` возвращает тот же `buildId`.
//  Это контракт, по которому клиентский сторож понимает, что сервер стал
//  другой сборкой; проба смотрит на него снаружи и годится для любого стенда —
//  локального `next start`, dev-стенда и прода.
//
//  Использование:
//    node scripts/check-build-id.mjs                        # http://localhost:3000
//    node scripts/check-build-id.mjs https://dcs.thfree.space
//    npm run check:build-id -- https://dcs.thfree.space
//
//  Код возврата: 0 — всё сошлось; 1 — расхождение; 2 — ошибка аргументов или
//  сети. Отсутствие `data-dpl-id` — не ошибка, а информация: так выглядит
//  запуск без `deploymentId` (образ без `.git`), и тогда клиент сравнивает
//  `.next/BUILD_ID` из `/api/version`.
//  Связано: src/lib/app-info.ts, src/app/api/version/route.ts,
//           docs/deployment.md, scripts/smoke.mjs.
// ============================================================================

const baseUrl = (
  process.argv[2] ||
  process.env.BASE_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

const TIMEOUT_MS = 15_000;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function networkError(url, error) {
  console.error(`✗ ${url}: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}

async function getText(pathname) {
  const url = `${baseUrl}${pathname}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        // Уникальный URL и no-store: прокси и кеш браузера не должны отдать
        // вчерашний ответ.
        'cache-control': 'no-store',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    networkError(url, error);
  }
  if (!response.ok) fail(`${url}: HTTP ${response.status}`);
  return response.text();
}

function countDplStaticRefs(html) {
  const refs = html.match(/\/_next\/static\/[^"'\\\s]*/g) ?? [];
  return {
    total: refs.length,
    withDpl: refs.filter((ref) => ref.includes('dpl=')).length,
    sample: refs.find((ref) => ref.includes('dpl=')) ?? refs[0] ?? null,
  };
}

const html = await getText('/');
const version = JSON.parse(await getText(`/api/version?t=${Date.now()}`));

if (typeof version.buildId !== 'string' || version.buildId.length === 0) {
  fail('GET /api/version: нет непустого buildId');
}

const injected = /data-dpl-id="([^"]+)"/.exec(html);
const staticRefs = countDplStaticRefs(html);

console.log(`Стенд:    ${baseUrl}`);
console.log(`buildId:  ${version.buildId}`);
console.log(`data-dpl-id: ${injected ? injected[1] : 'нет'}`);
console.log(
  `статика:  ${staticRefs.total} ссылок, из них с ?dpl= — ${staticRefs.withDpl}`,
);
if (staticRefs.sample) console.log(`пример:   ${staticRefs.sample}`);

if (!injected) {
  console.log(
    '! deploymentId не задан: Next не подписывает статику, клиент сравнивает buildId из /api/version.',
  );
  process.exit(0);
}

if (injected[1] !== version.buildId) {
  fail(`data-dpl-id (${injected[1]}) не совпал с buildId (${version.buildId})`);
}

if (staticRefs.total === 0) {
  fail('GET /: в HTML нет ни одной ссылки на /_next/static');
}

if (staticRefs.withDpl === 0) {
  fail('GET /: ни одна ссылка на /_next/static не подписана ?dpl=');
}

console.log('✓ buildId, data-dpl-id и подпись статики совпадают');
