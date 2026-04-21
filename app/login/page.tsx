'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setErrorMsg('خطأ: ' + error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="fifa-admin" dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <Link
            href="/"
            style={{ color: 'var(--fifa-muted)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>←</span>
            الرئيسية
          </Link>
        </div>

        <div className="fifa-panel" style={{ padding: '28px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 16px',
                borderRadius: 22,
                background: 'linear-gradient(135deg,#f0cf84,#a97b26)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 34,
                boxShadow: '0 12px 30px rgba(217,178,95,.22)',
              }}
            >
              🏆
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--fifa-gold)', margin: '0 0 6px' }}>الشمعدان</h1>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--fifa-text)', margin: '0 0 10px' }}>× كأس العالم 2026</p>
            <p style={{ fontSize: 13, color: 'var(--fifa-muted)', margin: 0 }}>أحلى من الماتش.. اللي بيحصل جنبيه</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto',
                  borderRadius: 20,
                  background: 'rgba(217,178,95,.10)',
                  border: '1px solid rgba(217,178,95,.22)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 30,
                }}
              >
                📧
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: 'var(--fifa-text)' }}>تم إرسال الرابط!</h2>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--fifa-muted)', margin: 0 }}>
                افتح إيميلك واضغط على الرابط<br />
                هتدخل مباشرة على الداشبورد
              </p>
              <button className="fifa-btn fifa-btn-ghost" onClick={() => setSent(false)} style={{ width: '100%', marginTop: 4 }}>
                إرسال مرة تانية
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                style={{
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid var(--fifa-line)',
                  borderRadius: 18,
                  padding: '14px 16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--fifa-muted)', margin: 0 }}>
                  مفيش باسورد — هنبعتلك رابط دخول على إيميلك 🔐
                </p>
              </div>

              {errorMsg && <div className="fifa-msg-error">{errorMsg}</div>}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--fifa-muted)', marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
                    الإيميل
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="fifa-field-input"
                    placeholder="example@gmail.com"
                    required
                    style={{ minHeight: 56, fontSize: 15 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="fifa-btn fifa-btn-gold"
                  style={{ width: '100%', minHeight: 56, fontSize: 18, fontWeight: 900, borderRadius: 18, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
