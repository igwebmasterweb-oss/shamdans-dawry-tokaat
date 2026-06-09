'use client';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // ابدأ بـ true لتفادي flash
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsIos(ios);
    setIsStandalone(standalone);
    setReady(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // انتظر حتى يتم فحص البيئة أولاً
  if (!ready) return null;
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  return (
    <>
      <style>{`
        .pwa-banner {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          background: linear-gradient(135deg, rgba(17,19,21,.97), rgba(23,26,29,.97));
          border: 1px solid rgba(217,178,95,.25);
          border-radius: 16px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 360px;
          width: calc(100% - 40px);
          box-shadow: 0 8px 32px rgba(0,0,0,.5);
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          animation: slideUp .35s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .pwa-banner img {
          width: 40px; height: 40px; object-fit: contain; flex-shrink: 0;
        }
        .pwa-banner-text { flex: 1; }
        .pwa-banner-title {
          font-size: 13px; font-weight: 800; color: #f4f1e8; margin-bottom: 2px;
        }
        .pwa-banner-sub {
          font-size: 11px; color: #a8a39a; line-height: 1.5;
        }
        .pwa-install-btn {
          background: linear-gradient(135deg,#d9b25f,#a8761a);
          color: #0a0800; border: none; border-radius: 10px;
          padding: 8px 14px; font-size: 12px; font-weight: 800;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          font-family: 'Cairo', sans-serif; transition: opacity .15s;
        }
        .pwa-install-btn:hover { opacity: .85; }
        .pwa-dismiss-btn {
          background: none; border: none; color: #a8a39a;
          font-size: 18px; cursor: pointer; padding: 2px 4px;
          flex-shrink: 0; line-height: 1;
        }
      `}</style>

      <div className="pwa-banner">
        <img src="/logo-FF.png" alt="الشمعدان" />
        <div className="pwa-banner-text">
          <div className="pwa-banner-title">ثبّت دوري توقعات الشمعدان</div>
          <div className="pwa-banner-sub">
            {isIos ? (
              <>اضغط <strong>مشاركة ↑</strong> ثم <strong>&quot;إضافة إلى الشاشة الرئيسية&quot;</strong></>
            ) : (
              <>ثبّته على موبايلك للوصول السريع 🚀</>
            )}
          </div>
        </div>
        {!isIos && (
          <button className="pwa-install-btn" onClick={handleInstall}>
            تثبيت
          </button>
        )}
        <button
          className="pwa-dismiss-btn"
          onClick={() => setDismissed(true)}
          aria-label="إغلاق"
        >
          ×
        </button>
      </div>
    </>
  );
}
