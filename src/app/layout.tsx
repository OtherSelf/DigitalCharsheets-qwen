// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { RecoveryModalWrapper } from '@/components/recovery-modal-wrapper';
import { CharacterProvider } from '@/context/character-context';
import { LocalAuthProvider } from '@/context/local-auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { LanguageProvider } from '@/context/language-context';
// 🎯 LANDMARK: REMOVED DynamicFavicon IMPORT FROM HERE

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Digital Character Sheets',
  description: 'Character sheets for DnD 5e and Dark Heresy',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        <title>Digital Character Sheets</title>
      </head>
      <body className="h-full font-body antialiased">
        {/* 🎯 LANDMARK: REMOVED DynamicFavicon FROM HERE */}
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
                {children}
                <RecoveryModalWrapper />
                <Toaster />
              </CharacterProvider>
            </LanguageProvider>
          </LocalAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}