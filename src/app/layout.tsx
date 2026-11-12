// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import './globals.css';

import { RecoveryModalWrapper } from '@/components/recovery-modal-wrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { UIScaleWrapper } from '@/components/ui-scale-wrapper';
import { Toaster } from '@/components/ui/toaster';
import { CharacterProvider } from '@/context/character-context';
import { LanguageProvider } from '@/context/language-context';
import { LocalAuthProvider } from '@/context/local-auth-context';
import { listGamePlugins } from '@/games/registry';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

// Названия игр — из манифестов: новая игра не требует правок layout (этап 2).
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <head>
        <title>Digital Character Sheets</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes"
        />
      </head>
      <body className="font-body h-full overflow-x-hidden antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={['light', 'dark', 'warm']}
          disableTransitionOnChange
        >
          <LocalAuthProvider>
            <LanguageProvider>
              <CharacterProvider>
                {/* LANDMARK: UI_SCALE_WRAPPER_INTEGRATION */}
                <UIScaleWrapper>
                  {children}
                  <RecoveryModalWrapper />
                  <Toaster />
                </UIScaleWrapper>
              </CharacterProvider>
            </LanguageProvider>
          </LocalAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
