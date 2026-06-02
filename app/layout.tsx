import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import InstallPrompt from '@/components/InstallPrompt';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d9b25f',
};

export const metadata: Metadata = {
  title: 'الشمعدان × كأس العالم 2026',
  description: 'توقع نتايج كأس العالم مع الشمعدان',
  applicationName: 'دوري توقعات الشمعدان',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'دوري توقعات الشمعدان',
  },
  icons: {
    icon: '/logo-FF.png',
    apple: '/logo-FF.png',
  },
  openGraph: {
    title: 'الشمعدان × كأس العالم 2026',
    description: 'توقع نتايج كأس العالم مع الشمعدان',
    url: 'https://worldcup.shamaadan.com',
    siteName: 'دوري توقعات الشمعدان',
    locale: 'ar_SA',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-white antialiased">
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
