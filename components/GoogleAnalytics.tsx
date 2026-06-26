'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// .trim() مهم: لو القيمة في الـ env فيها مسافة أو سطر جديد، بتكسر الـ inline script.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

// أي مسار بيبدأ بالقيم دي مش هيتسجّل في Google Analytics (صفحات الإدارة + الـ API).
const EXCLUDED_PREFIXES = ['/admin', '/api'];

const isExcluded = (path: string | null) =>
  !!path && EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

export default function GoogleAnalytics() {
  const pathname = usePathname();

  // تتبّع تغيّر الصفحات في الـ SPA (Next App Router مبيعملش full reload).
  // بنبعت page_view بس لو الصفحة مش مستثناة.
  useEffect(() => {
    if (!GA_ID) return;
    if (typeof window === 'undefined' || typeof (window as any).gtag !== 'function') return;
    if (isExcluded(pathname)) return;
    (window as any).gtag('config', GA_ID, { page_path: pathname });
  }, [pathname]);

  // لو مفيش ID متظبّط، مفيش تتبّع خالص.
  // ملاحظة: بنحمّل الـ scripts مرة واحدة وبنخليها ثابتة (مبنفكّش mount مع تغيّر المسار)
  // عشان نتجنّب خطأ appendChild في Next عند إعادة حقن inline script.
  if (!GA_ID) return null;

  return (
    <>
      <Script
        id="ga-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false });`,
        }}
      />
    </>
  );
}
