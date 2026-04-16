'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // ← الرابط الصحيح للداشبورد
        emailRedirectTo: 'https://shamdans-dawry-tokaat.vercel.app/dashboard'
      }
    });

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      alert('✅ تم إرسال رابط الدخول على الإيميل\n(اضغط عليه عشان تدخل مباشرة للداشبورد)');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="bg-zinc-900 p-10 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="text-center mb-10">
          <span className="text-6xl">🏆</span>
          <h1 className="text-4xl font-bold mt-4 font-tajawal text-red-600">
            الشمعدان × كأس العالم 2026
          </h1>
        </div>

        <h2 className="text-2xl font-tajawal text-center mb-8">تسجيل الدخول</h2>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white/70 mb-3 font-tajawal text-lg">الإيميل</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-red-600 text-white px-6 py-5 rounded-3xl text-lg focus:outline-none transition-all"
              placeholder="example@gmail.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 py-5 rounded-3xl font-bold text-xl font-tajawal transition-all"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رابط الدخول'}
          </button>
        </form>

        <p className="text-center text-white/50 text-sm mt-8">
          بعد ما تضغط على الرابط في الإيميل،<br />
          هتدخل مباشرة على الداشبورد
        </p>
      </div>
    </div>
  );
}
