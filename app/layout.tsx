import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import InstallPrompt from '@/components/InstallPrompt';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { Analytics } from '@vercel/analytics/next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d9b25f',
};

export const metadata: Metadata = {
  title: 'الشمعدان × كأس العالم 2026',
  description: 'توقع نتايج كأس العالم مع الشمعدان',
  applicationName: 'دوري الشمعدان',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'دوري توقعات الشمعدان',
  },
  icons: {
    icon: '/Shedan_logo.png',
    apple: '/Shedan_logo.png',
  },
  openGraph: {
    title: 'الشمعدان × كأس العالم 2026',
    description: 'توقع نتايج كأس العالم مع الشمعدان',
    url: 'https://worldcup.elshamadan.net/',
    siteName: 'دوري الشمعدان',
    locale: 'ar_SA',
    type: 'website',
    images: [
      {
        url: '/share-logo.jpeg',
        width: 1200,
        height: 630,
        alt: 'الشمعدان × كأس العالم 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الشمعدان × كأس العالم 2026',
    description: 'توقع نتايج كأس العالم مع الشمعدان',
    images: ['/share-logo.jpeg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <GoogleAnalytics />
        <Analytics />
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
