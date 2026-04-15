'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email) return alert('اكتب الإيميل بتاعك');
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'http://localhost:3000/dashboard',
      }
    });

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      alert('✅ تم إرسال كود التأكيد على الإيميل!');
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto">
        
        {/* Header بولد */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3">
            <span className="text-5xl">🏆</span>
            <div className="flex items-center">
              <span className="text-4xl font-bold text-red-600 font-tajawal">الشمعدان</span>
              <span className="text-4xl font-bold text-white mx-3">×</span>
              <span className="text-4xl font-bold text-white font-tajawal">كأس العالم 2026</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-red-600/40 rounded-3xl p-10 shadow-2xl">
          <h1 className="text-4xl font-bold text-center text-white mb-10 font-tajawal">
            تسجيل الدخول
          </h1>

          <div className="space-y-6">
            <div>
              <label className="block text-white/70 mb-2 font-tajawal">الإيميل</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full bg-zinc-800 text-white px-6 py-5 rounded-2xl focus:outline-none text-lg font-tajawal"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading || !email}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-5 rounded-2xl text-2xl font-tajawal transition"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال كود التأكيد على الإيميل'}
            </button>
          </div>
        </div>

        <p className="text-center text-white/40 text-sm mt-8 font-tajawal">
          Powered by DMB Agency
        </p>
      </div>
    </main>
  );
}