import type { NextConfig } from 'next';

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
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
