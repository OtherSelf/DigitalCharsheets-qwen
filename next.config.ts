import type { NextConfig } from 'next';

import { readGitCheckoutSync } from './src/lib/git-commit';

/**
 * ─── LANDMARK: SECURITY HEADERS ─────────────────────────────────────────────
 * Браузерные границы приложения. CSP, anti-frame и nosniff закрывают класс
 * атак, которых серверный код не видит: встраивание в чужой iframe
 * (кликджекинг), подмена типа ответа, утечка полного URL во внешние ресурсы.
 *
 * CSP собрана под Next 16: inline-скрипты бутстрапа и inline-стили требуют
 * `'unsafe-inline'`, а dev-режим — ещё и `'unsafe-eval'` с websocket для HMR.
 * Внешние картинки разрешены только с явно перечисленных хостов (демо-данные),
 * всё остальное — `'self'`.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * ─── LANDMARK: DEPLOYMENT ID ────────────────────────────────────────────────
 * `deploymentId` — framework-нативная защита от «старой» вкладки: Next ставит
 * `?dpl=` в URL статики, `data-dpl-id` в `<html>` и делает hard navigation,
 * если клиент и сервер разошлись по id. Своё сравнение версий не пишем.
 *
 * Значение берётся здесь, а не из окружения systemd: у юнита только
 * `NODE_ENV=production`, и деплой-скрипт не может положить в него переменную.
 * `next start` заново читает этот конфиг, поэтому id одинаков у сборки и у
 * рантайма (`NEXT_DEPLOYMENT_ID` из окружения Next всё равно приоритетнее).
 *
 * Только production: в dev `?dpl=` попал бы в HMR-URL и ничего не даёт.
 * В образе без `.git` и без `DCS_GIT_COMMIT` id не задаётся — тогда клиент
 * сравнивает `.next/BUILD_ID` из `/api/version` (см. `src/lib/app-info.ts`).
 */
const deploymentId = isDev
  ? undefined
  : process.env.DCS_GIT_COMMIT?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    readGitCheckoutSync()?.commit ||
    undefined;

const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    // HMR и React Refresh в dev собирают код через eval.
    isDev ? "'unsafe-eval'" : '',
  ]
    .filter(Boolean)
    .join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos",
  "font-src 'self' data:",
  ["connect-src 'self'", isDev ? 'ws: wss:' : ''].filter(Boolean).join(' '),
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  deploymentId,
  /*
    Next 16 по умолчанию блокирует cross-origin обращения к dev-ресурсам
    (/_next/hmr и т.п.). Дев-стенд открывается через nginx по
    https://dcs-dev.thfree.space, поэтому его хост нужно явно разрешить —
    иначе клиент не подключается к HMR и страницы не гидратируются.
  */
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'dcs-dev.thfree.space',
    'dcs.thfree.space',
  ],
  // `X-Powered-By: Next.js` сообщает стек без пользы для приложения.
  poweredByHeader: false,
  /*
    Image optimizer не используется (в приложении нет `next/image`), но
    `/_next/image` оставался открытым эндпоинтом, который по URL тянет чужие
    ресурсы от имени сервера. `unoptimized` выключает оптимизацию и убирает
    эту поверхность; внешние картинки демо-данных грузит сам браузер.
  */
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Все ответы, включая статику и API.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        /*
          ─── LANDMARK: HTML_MUST_REVALIDATE ─────────────────────────────────
          HTML живёт по стабильному URL (`/`, `/login`, `/demo`), но ссылается
          на клиентские чанки с контент-хэшем в имени. Пересборка удаляет
          старые файлы из `.next/static`, поэтому закэшированная копия HTML
          запрашивает уже несуществующие чанки: `nosniff` не позволяет
          исполнить HTML-тело ответа 404, гидратация не стартует, и
          пререндеренный скелет остаётся навсегда — на `/` это бесконечный
          спиннер.

          Поэтому HTML не кэшируется вовсе — так же, как его отдаёт dev-стенд,
          и строже дефолта `next start`, который помечает пререндеренные
          страницы как `s-maxage=31536000`. Правило идёт после общего, чтобы
          переопределить `Cache-Control` только на нестатике: вечно кэшируется
          лишь статика с хэшем в имени.
        */
        source: '/((?!_next/static|api/characters).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        /*
          Список листов — единственный API GET с валидатором: ETag/304
          разрешают браузеру хранить копию, но требуют ревалидации. HTML и
          остальные API остаются no-store (правило выше). Подпути
          /api/characters/* — ссылки и история — по-прежнему no-store: в них
          токен/приватные данные.
        */
        source: '/api/characters',
        headers: [{ key: 'Cache-Control', value: 'private, no-cache' }],
      },
      {
        source: '/api/characters/:path+',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        /*
          Чанки, шрифты и media адресуются по контент-хэшу: имя меняется
          вместе с содержимым, поэтому их можно отдавать как immutable.
        */
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        /*
          Токен гостевой ссылки живёт в URL: его нельзя индексировать,
          кэшировать и отдавать во внешний Referer. Правило идёт после общего,
          чтобы переопределить Referrer-Policy именно на /share/*.
        */
        source: '/share/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
