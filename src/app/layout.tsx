import type { Metadata, Viewport } from 'next';
import { APP } from '@/config/app';
import { fontVariableClassName } from '@/lib/fonts';
import { ToastProvider } from '@/components/ui/Toast';
import { SessionProvider } from '@/store/session';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP.name} — criar publicações`,
    template: `%s · ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  // A aplicação é privada: não queremos indexação de páginas de trabalho.
  robots: { index: false, follow: false },
  openGraph: {
    siteName: APP.name,
    title: `${APP.name} — criar publicações`,
    description: APP.description,
    locale: 'pt_AO',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#050706',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={fontVariableClassName}>
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only-focusable fixed left-4 top-4 z-[90] rounded-[10px] border border-neon/60 bg-ink-900 px-3 py-2 text-[13px] font-medium text-neon"
        >
          Saltar para o conteúdo
        </a>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
