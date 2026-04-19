'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) { alert('خطأ: ' + error.message); }
    else { setSent(true); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4" dir="rtl">

      {/* Back link */}
      <div className="w-full max-w-md mb-4">
        <a href="/" className="text-zinc-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1">
          <span>←</span> الرئيسية
        </a>
      </div>

      <div className="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 p-7 sm:p-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <span className="text-5xl sm:text-6xl block">🏆</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-red-500 leading-tight">الشمعدان</h1>
            <p className="text-white font-bold text-lg">× كأس العالم 2026</p>
          </div>
          <p className="text-zinc-500 text-sm">أحلى من الماتش.. اللي بيحصل جنبيه</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4 py-4">
            <span className="text-5xl block">📧</span>
            <h2 className="text-xl font-bold">تم إرسال الرابط!</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              افتح إيميلك وضغط على الرابط<br />هتدخل مباشرة على الداشبورد
            </p>
            <button onClick={() => setSent(false)} className="text-zinc-500 text-xs underline mt-2">
              إرسال مرة تانية
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-4 py-3 text-center">
              <p className="text-zinc-400 text-sm">مفيش باسورد — هنبعتلك رابط دخول على إيميلك 🔐</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-zinc-400 mb-2 text-sm font-medium">الإيميل</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[54px] bg-zinc-800 border border-zinc-700 focus:border-red-500 text-white px-5 py-3 rounded-2xl text-base outline-none transition-colors placeholder:text-zinc-600"
                  placeholder="example@gmail.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[54px] bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded-2xl font-black text-lg transition-colors"
              >
                {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
