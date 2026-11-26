// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';
import { cookies, headers } from 'next/headers';

import './globals.css';

import { BuildWatcher } from '@/components/layout/build-watcher';
import { ClientErrorGuard } from '@/components/layout/client-error-guard';
import { RecoveryModalWrapper } from '@/components/recovery-modal-wrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { UIScaleWrapper } from '@/components/ui-scale-wrapper';
import { Toaster } from '@/components/ui/toaster';
import { CharacterProvider } from '@/context/character-context';
import {
  InstanceConfigProvider,
  type PublicInstanceConfig,
} from '@/context/instance-config-context';
import { LanguageProvider } from '@/context/language-context';
import { LocalAuthProvider } from '@/context/local-auth-context';
import { listGamePlugins } from '@/games/registry';
import { getAppInfo } from '@/lib/app-info';
import { getInstanceConfig } from '@/lib/config';
import { LANGUAGE_COOKIE, resolveLanguage } from '@/lib/language';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { readSiteSettingsCached } from '@/lib/site-settings';

/*
  Обе гарнитуры — с кириллицей: `Space Grotesk` её не содержит, и русские
  заголовки рисовались системным фолбэком с другими метриками. `Manrope` —
  геометрический гротеск, ближайший к прежнему заголовочному шрифту.
*/
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-headline',
});

// Названия игр — из манифестов: новая игра не требует правок layout.
const GAME_TITLES = [
  ...new Set(listGamePlugins().map((plugin) => plugin.manifest.game.name.en)),
];

export const metadata: Metadata = {
  title: 'Digital Character Sheets',
  description: `Character sheets for ${GAME_TITLES.join(', ')}`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
    Id сборки, с которой отрендерен этот документ: сторож сравнивает его с
    `/api/version` и понимает, что сервер уже другой. `data-dpl-id` для этого
    не годится — Next удаляет атрибут до гидратации.
  */
  const { buildId } = await getAppInfo();

  /*
    Язык читается на сервере, чтобы первый же HTML был отдан с правильными
    `<html lang>` и текстами: клиентский выбор языка после гидратации давал
    английский кадр и «прыжок» вёрстки. Cookie и `Accept-Language` —
    динамические API, поэтому страницы рендерятся на запрос; HTML всё равно
    отдаётся `no-store` (LANDMARK: HTML_MUST_REVALIDATE в next.config.ts),
    так что этот выбор не отнимает у документа HTTP-кэш, только экономию
    пререндера.
  */
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const language = resolveLanguage({
    cookie: cookieStore.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: requestHeaders.get('accept-language'),
  });

  /*
    Публичная часть настроек — в провайдер: клиенту нужны включённость
    политики/условий, открытость регистрации и возрастной порог, а читать
    `dcs.config.json` из браузера нельзя. Переключатели из data-dir читаются
    на каждый запрос (кэш — секунда), поэтому тумблер в админке виден сразу.
  */
  const instanceConfig = getInstanceConfig();
  const siteSettings = await readSiteSettingsCached();
  const publicConfig: PublicInstanceConfig = {
    privacy: {
      enabled: instanceConfig.legal.privacy.enabled,
      version: PRIVACY_VERSION,
    },
    terms: { enabled: instanceConfig.legal.terms.enabled },
    registration: { open: siteSettings.registration.open },
    access: {
      loginRestrictedToStaff: siteSettings.access.loginRestrictedToStaff,
    },
    ageMinimum: instanceConfig.legal.ageMinimum,
  };

  return (
    <html
      lang={language}
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} h-full`}
    >
      {/*
        Ни `<title>`, ни `<meta name="viewport">` здесь не дублируются: их
        отдают `metadata` и `viewport` выше. App Router вставляет их в <head>
        сам, а ручная копия давала два viewport-тега в документе.
      */}
      <body className="font-body h-full overflow-x-hidden antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={['light', 'dark', 'warm']}
          disableTransitionOnChange
        >
          <InstanceConfigProvider config={publicConfig}>
            <LocalAuthProvider>
              <LanguageProvider initialLanguage={language}>
                <CharacterProvider>
                  {/* LANDMARK: UI_SCALE_WRAPPER_INTEGRATION */}
                  <UIScaleWrapper>
                    {children}
                    <RecoveryModalWrapper />
                    <Toaster />
                    <BuildWatcher ownBuildId={buildId} />
                    <ClientErrorGuard />
                  </UIScaleWrapper>
                </CharacterProvider>
              </LanguageProvider>
            </LocalAuthProvider>
          </InstanceConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
