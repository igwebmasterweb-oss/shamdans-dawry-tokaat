'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white" dir="rtl">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/80 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <span className="font-bold text-red-500 text-base sm:text-lg">الشمعدان</span>
            <span className="text-zinc-600 text-base">×</span>
            <span className="font-bold text-white text-base sm:text-lg">كأس العالم 2026</span>
          </div>
          <Link href="/login">
            <button className="bg-red-600 hover:bg-red-500 transition-colors text-white font-bold px-5 py-2 rounded-2xl text-sm">
              سجّل دلوقتي
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center min-h-screen px-5 pt-16 text-center">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-bold px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            كأس العالم 2026 — المكسيك · كندا · الولايات المتحدة
          </div>

          {/* Title */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <span className="text-6xl sm:text-7xl">🏆</span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-black text-white leading-tight">
              الشمعدان
            </h1>
            <p className="text-2xl sm:text-3xl font-bold text-red-500">
              × كأس العالم 2026
            </p>
          </div>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed">
            أحلى من الماتش.. اللي بيحصل جنبيه
          </p>

          {/* Points system preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { icon: '🏆', label: 'نتيجة كاملة', pts: '10' },
              { icon: '✅', label: 'الفايز صح',   pts: '5'  },
              { icon: '⚽', label: 'أول هدف',     pts: '+3' },
              { icon: '🎯', label: 'سؤال المفاجأة', pts: '+5' },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-4">
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-yellow-400 font-black text-xl">{item.pts}</p>
                <p className="text-zinc-500 text-xs mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link href="/login">
              <button className="w-full sm:w-auto bg-red-600 hover:bg-red-500 transition-all text-white text-xl font-black px-12 py-5 rounded-3xl inline-flex items-center justify-center gap-3">
                ابدأ التوقعات دلوقتي
                <span className="text-2xl">🔥</span>
              </button>
            </Link>
            <p className="text-zinc-600 text-xs">مفيش باسورد — رابط على إيميلك وبس 🔐</p>
          </div>

        </div>
      </main>
    </div>
  );
}
