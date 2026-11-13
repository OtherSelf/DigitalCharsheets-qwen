import type { NextConfig } from 'next';

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
