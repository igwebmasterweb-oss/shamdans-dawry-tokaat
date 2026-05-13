'use client';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google'|'facebook'|null>(null);
  const [sent, setSent]         = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setErrorMsg('خطأ: ' + error.message);
    else setSent(true);
    setLoading(false);
  };

  const handleSocial = async (provider: 'google'|'facebook') => {
    setSocialLoading(provider); setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) { setErrorMsg('خطأ: ' + error.message); setSocialLoading(null); }
  };

  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at top left, rgba(217,178,95,.12), transparent 28%),
        radial-gradient(circle at bottom right, rgba(201,58,47,.10), transparent 26%),
        #070809
      `,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: "'Cairo', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125;
          --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a;
          --gold:#d9b25f; --red:#c93a2f; --green:#27b06e;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .panel {
          background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
          border: 1px solid var(--line); border-radius: 24px; padding: 32px 28px;
        }
        .social-btn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          width: 100%; min-height: 52px; border-radius: 18px;
          background: var(--surface-3); border: 1px solid var(--line);
          color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer;
          font-family: 'Cairo', sans-serif; transition: all .2s;
        }
        .social-btn:hover:not(:disabled) { border-color: rgba(217,178,95,.25); background: rgba(217,178,95,.05); }
        .social-btn:disabled { opacity: .5; cursor: not-allowed; }
        .field-input {
          width: 100%; padding: 14px 16px; border-radius: 14px;
          background: var(--surface-3); border: 1px solid var(--line);
          color: var(--text); font-family: 'Cairo', sans-serif; font-size: 15px;
          outline: none; transition: border-color .2s;
        }
        .field-input:focus { border-color: rgba(217,178,95,.4); }
        .field-input::placeholder { color: var(--muted); }
        .btn-gold {
          width: 100%; min-height: 52px; border-radius: 18px; border: none;
          background: linear-gradient(135deg, #e0bc73, #b9892d);
          color: #211708; font-size: 16px; font-weight: 800; cursor: pointer;
          font-family: 'Cairo', sans-serif;
          box-shadow: 0 8px 24px rgba(217,178,95,.22); transition: opacity .2s;
        }
        .btn-gold:hover:not(:disabled) { opacity: .88; }
        .btn-gold:disabled { opacity: .6; cursor: not-allowed; }
        .btn-ghost {
          width: 100%; min-height: 48px; border-radius: 14px;
          background: transparent; border: 1px solid var(--line);
          color: var(--muted); font-size: 14px; font-weight: 700; cursor: pointer;
          font-family: 'Cairo', sans-serif; transition: all .2s;
        }
        .btn-ghost:hover { border-color: rgba(217,178,95,.25); color: #f2d79e; }
        .msg-error {
          padding: 12px 16px; border-radius: 14px;
          background: rgba(201,58,47,.12); border: 1px solid rgba(201,58,47,.28);
          color: #ff9c91; font-size: 13px; font-weight: 700;
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
          <span style={{ fontSize: 16 }}>←</span> الرئيسية
        </Link>

        <div className="panel">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width:74, height:74, margin:'0 auto 16px', borderRadius:22, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:36, boxShadow:'0 12px 32px rgba(217,178,95,.28)' }}>🏆</div>
            <h1 style={{ fontSize:28, fontWeight:800, color:'#d9b25f', margin:'0 0 6px' }}>الشمعدان</h1>
            <p style={{ fontSize:17, fontWeight:700, color:'#f4f1e8', margin:'0 0 8px' }}>× كأس العالم 2026</p>
            <p style={{ fontSize:13, color:'#a8a39a', margin:0 }}>أحلى من الماتش.. اللي بيحصل جنبيه</p>
          </div>

          {sent ? (
            <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ width:66, height:66, margin:'0 auto', borderRadius:20, background:'rgba(217,178,95,.10)', border:'1px solid rgba(217,178,95,.22)', display:'grid', placeItems:'center', fontSize:32 }}>📧</div>
              <h2 style={{ fontSize:22, fontWeight:800, margin:0, color:'#f4f1e8' }}>تم إرسال الرابط!</h2>
              <p style={{ fontSize:14, lineHeight:1.8, color:'#a8a39a', margin:0 }}>افتح إيميلك واضغط على الرابط<br/>هتدخل مباشرة على الداشبورد</p>
              <button className="btn-ghost" onClick={()=>setSent(false)}>إرسال مرة تانية</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button className="social-btn" onClick={()=>handleSocial('google')} disabled={!!socialLoading||loading}>
                  {socialLoading==='google' ? <span>⏳</span> : (
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.5-5 7.2v6h8c4.7-4.3 7.3-10.7 7.3-17.3z"/>
                      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8-6c-2.1 1.4-4.8 2.2-7.9 2.2-6 0-11.1-4-12.9-9.5H3v6.2C6.9 42.8 15 48 24 48z"/>
                      <path fill="#FBBC05" d="M11.1 28.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4V14H3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.6 3 10.8l8.1-5.9z"/>
                      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.5-6.5C35.9 2.5 30.5 0 24 0 15 0 6.9 5.2 3 14l8.1 6.2C12.9 14.5 18 9.5 24 9.5z"/>
                    </svg>
                  )}
                  {socialLoading==='google' ? 'جاري الاتصال...' : 'الدخول بـ Google'}
                </button>

                <button className="social-btn" onClick={()=>handleSocial('facebook')} disabled={!!socialLoading||loading}>
                  {socialLoading==='facebook' ? <span>⏳</span> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                    </svg>
                  )}
                  {socialLoading==='facebook' ? 'جاري الاتصال...' : 'الدخول بـ Facebook'}
                </button>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, height:1, background:'var(--line)' }}/>
                <span style={{ color:'var(--muted)', fontSize:12 }}>أو عن طريق الإيميل</span>
                <div style={{ flex:1, height:1, background:'var(--line)' }}/>
              </div>

              <div style={{ background:'rgba(217,178,95,.06)', border:'1px solid rgba(217,178,95,.14)', borderRadius:16, padding:'12px 16px', textAlign:'center' }}>
                <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>مفيش باسورد — هنبعتلك رابط دخول على إيميلك 🔐</p>
              </div>

              {errorMsg && <div className="msg-error">{errorMsg}</div>}

              <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ display:'block', color:'var(--muted)', marginBottom:8, fontSize:13, fontWeight:700 }}>الإيميل</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    className="field-input" placeholder="example@gmail.com"
                    required style={{ minHeight:52 }} />
                </div>
                <button type="submit" className="btn-gold" disabled={loading||!!socialLoading}>
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
