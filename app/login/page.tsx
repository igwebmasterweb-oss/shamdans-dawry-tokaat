'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 p-6 sm:p-10 shadow-2xl">

        <div className="text-center mb-8">
          <span className="text-6xl">🏆</span>
          <h1 className="text-3xl sm:text-4xl font-bold mt-4 text-red-600 leading-tight">
            الشمعدان × كأس العالم 2026
          </h1>
          <p className="text-white/40 text-sm mt-2">أحلى من الماتش.. اللي بيحصل جنبيه</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <span className="text-5xl">📧</span>
            <h2 className="text-xl font-bold text-white">تم إرسال الرابط!</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              افتح إيميلك وضغط على الرابط<br />
              هتدخل مباشرة على الداشبورد
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-white/40 text-xs underline mt-4"
            >
              إرسال مرة تانية
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 text-white">
              تسجيل الدخول
            </h2>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-white/60 mb-2 text-sm">الإيميل</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[52px] bg-zinc-800 border border-zinc-700 focus:border-red-600 text-white px-5 py-3 rounded-2xl text-base outline-none transition-colors"
                  placeholder="example@gmail.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[54px] bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-2xl font-bold text-lg transition-colors"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال رابط الدخول'}
              </button>
            </form>

            <p className="text-center text-white/30 text-xs mt-6 leading-relaxed">
              هنبعتلك رابط على إيميلك<br />
              مفيش باسورد 🔐
            </p>
          </>
        )}
      </div>
    </div>
  );
}
