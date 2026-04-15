'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <nav className="bg-black border-b border-red-600/30 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div className="flex items-center">
              <span className="text-3xl font-bold text-red-600 font-tajawal">الشمعدان</span>
              <span className="text-3xl font-bold text-white mx-2">×</span>
              <span className="text-3xl font-bold text-white font-tajawal">كأس العالم 2026</span>
            </div>
          </div>

          <Link href="/login">
            <button className="bg-red-600 hover:bg-red-700 transition-all text-white font-bold px-8 py-3 rounded-2xl text-lg font-tajawal">
              سجل دلوقتي وابدأ التوقعات
            </button>
          </Link>
        </div>
      </nav>

      <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center pt-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-3 mb-10">
            <span className="text-8xl">🏆</span>
            <h1 className="text-7xl font-bold text-red-600 font-tajawal">الشمعدان</h1>
            <div className="flex items-center gap-4 text-6xl font-bold">
              <span className="text-white">×</span>
              <span className="text-white font-tajawal">كأس العالم 2026</span>
            </div>
          </div>

          <p className="text-3xl text-white/90 mb-12 font-tajawal">
            أحلى من الماتش.. اللي بيحصل جنبيه
          </p>

          <Link href="/login">
            <button className="bg-red-600 hover:bg-red-700 transition-all text-white text-3xl font-bold px-16 py-7 rounded-3xl flex items-center gap-4 mx-auto font-tajawal">
              ابدأ التوقعات دلوقتي
              <span className="text-4xl">🔥</span>
            </button>
          </Link>
        </div>
      </main>
    </>
  );
}