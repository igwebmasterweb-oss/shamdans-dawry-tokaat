'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// أي مسار بيبدأ بالقيم دي مش هيتسجّل في Google Analytics (صفحات الإدارة).
const EXCLUDED_PREFIXES = ['/admin', '/api'];

const isExcluded = (path: string | null) =>
  !!path && EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

export default function GoogleAnalytics() {
  const pathname = usePathname();

  // تتبّع تغيّر الصفحات في الـ SPA (Next App Router مبيعملش full reload).
  useEffect(() => {
    if (!GA_ID) return;
    if (isExcluded(pathname)) return;
    if (typeof window === 'undefined' || typeof (window as any).gtag !== 'function') return;
    (window as any).gtag('config', GA_ID, { page_path: pathname });
  }, [pathname]);

  // مفيش ID متظبّط، أو إحنا جوه صفحة إدارة → مفيش تتبّع خالص.
  if (!GA_ID || isExcluded(pathname)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
