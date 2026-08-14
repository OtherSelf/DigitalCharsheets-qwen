import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { CharacterProvider } from '@/context/character-context';
//import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { LanguageProvider } from '@/context/language-context';

export const metadata: Metadata = {
  title: 'Digital Character Sheets',
  description: 'Character sheets for DnD 5e and Dark Heresy',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        //<link rel="preconnect" href="https://fonts.googleapis.com" />
        //<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          //href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={['light', 'dark', 'warm']}
          disableTransitionOnChange
        >
          /*<FirebaseClientProvider>
            <LanguageProvider>
              <CharacterProvider>
                {children}
                <Toaster />
              </CharacterProvider>
            </LanguageProvider>
          </FirebaseClientProvider>*/
        </ThemeProvider>
      </body>
    </html>
  );
}
