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

  /* ── OTP email ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setErrorMsg('خطأ: ' + error.message);
    else setSent(true);
    setLoading(false);
  };

  /* ── Social OAuth ── */
  const handleSocial = async (provider: 'google'|'facebook') => {
    setSocialLoading(provider);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setErrorMsg('خطأ: ' + error.message);
      setSocialLoading(null);
    }
    // on success: browser redirects → no need to reset loading
  };

  return (
    <div className="fifa-admin" dir="rtl"
      style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
      <div style={{ width:'100%', maxWidth:460, display:'flex', flexDirection:'column', gap:14 }}>

        {/* back link */}
        <div>
          <Link href="/"
            style={{ color:'var(--fifa-muted)', fontSize:13, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
            <span>←</span> الرئيسية
          </Link>
        </div>

        <div className="fifa-panel" style={{ padding:'28px 24px' }}>

          {/* logo */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{
              width:72, height:72, margin:'0 auto 16px',
              borderRadius:22,
              background:'linear-gradient(135deg,#f0cf84,#a97b26)',
              display:'grid', placeItems:'center', fontSize:34,
              boxShadow:'0 12px 30px rgba(217,178,95,.22)',
            }}>🏆</div>
            <h1 style={{ fontSize:30, fontWeight:900, color:'var(--fifa-gold)', margin:'0 0 6px' }}>الشمعدان</h1>
            <p style={{ fontSize:18, fontWeight:800, color:'var(--fifa-text)', margin:'0 0 10px' }}>× كأس العالم 2026</p>
            <p style={{ fontSize:13, color:'var(--fifa-muted)', margin:0 }}>أحلى من الماتش.. اللي بيحصل جنبيه</p>
          </div>

          {/* ── SUCCESS STATE ── */}
          {sent ? (
            <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:14, padding:'8px 0' }}>
              <div style={{
                width:64, height:64, margin:'0 auto',
                borderRadius:20,
                background:'rgba(217,178,95,.10)',
                border:'1px solid rgba(217,178,95,.22)',
                display:'grid', placeItems:'center', fontSize:30,
              }}>📧</div>
              <h2 style={{ fontSize:24, fontWeight:900, margin:0, color:'var(--fifa-text)' }}>تم إرسال الرابط!</h2>
              <p style={{ fontSize:14, lineHeight:1.8, color:'var(--fifa-muted)', margin:0 }}>
                افتح إيميلك واضغط على الرابط<br/>هتدخل مباشرة على الداشبورد
              </p>
              <button className="fifa-btn fifa-btn-ghost" onClick={()=>setSent(false)} style={{ width:'100%', marginTop:4 }}>
                إرسال مرة تانية
              </button>
            </div>

          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* ── SOCIAL BUTTONS ── */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {/* Google */}
                <button
                  onClick={()=>handleSocial('google')}
                  disabled={!!socialLoading || loading}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                    width:'100%', minHeight:52, borderRadius:18,
                    background:'var(--fifa-surface-3)',
                    border:'1px solid var(--fifa-line)',
                    color:'var(--fifa-text)',
                    fontSize:14, fontWeight:700, cursor:'pointer',
                    opacity: (socialLoading && socialLoading!=='google') ? .5 : 1,
                    transition:'all .18s',
                    fontFamily:'Cairo,Tajawal,sans-serif',
                  }}>
                  {socialLoading==='google' ? (
                    <span style={{ fontSize:18 }}>⏳</span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.5-5 7.2v6h8c4.7-4.3 7.3-10.7 7.3-17.3z"/>
                      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8-6c-2.1 1.4-4.8 2.2-7.9 2.2-6 0-11.1-4-12.9-9.5H3v6.2C6.9 42.8 15 48 24 48z"/>
                      <path fill="#FBBC05" d="M11.1 28.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4V14H3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.6 3 10.8l8.1-5.9z"/>
                      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.5-6.5C35.9 2.5 30.5 0 24 0 15 0 6.9 5.2 3 14l8.1 6.2C12.9 14.5 18 9.5 24 9.5z"/>
                    </svg>
                  )}
                  {socialLoading==='google' ? 'جاري الاتصال...' : 'الدخول بـ Google'}
                </button>

                {/* Facebook */}
                <button
                  onClick={()=>handleSocial('facebook')}
                  disabled={!!socialLoading || loading}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                    width:'100%', minHeight:52, borderRadius:18,
                    background:'var(--fifa-surface-3)',
                    border:'1px solid var(--fifa-line)',
                    color:'var(--fifa-text)',
                    fontSize:14, fontWeight:700, cursor:'pointer',
                    opacity: (socialLoading && socialLoading!=='facebook') ? .5 : 1,
                    transition:'all .18s',
                    fontFamily:'Cairo,Tajawal,sans-serif',
                  }}>
                  {socialLoading==='facebook' ? (
                    <span style={{ fontSize:18 }}>⏳</span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                    </svg>
                  )}
                  {socialLoading==='facebook' ? 'جاري الاتصال...' : 'الدخول بـ Facebook'}
                </button>
              </div>

              {/* divider */}
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, height:1, background:'var(--fifa-line)' }}/>
                <span style={{ color:'var(--fifa-muted)', fontSize:12 }}>أو عن طريق الإيميل</span>
                <div style={{ flex:1, height:1, background:'var(--fifa-line)' }}/>
              </div>

              {/* hint */}
              <div style={{
                background:'rgba(255,255,255,.03)',
                border:'1px solid var(--fifa-line)',
                borderRadius:18, padding:'12px 16px', textAlign:'center',
              }}>
                <p style={{ fontSize:12, color:'var(--fifa-muted)', margin:0 }}>
                  مفيش باسورد — هنبعتلك رابط دخول على إيميلك 🔐
                </p>
              </div>

              {/* error */}
              {errorMsg && <div className="fifa-msg-error">{errorMsg}</div>}

              {/* email form */}
              <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ display:'block', color:'var(--fifa-muted)', marginBottom:8, fontSize:13, fontWeight:700 }}>
                    الإيميل
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    className="fifa-field-input"
                    placeholder="example@gmail.com"
                    required
                    style={{ minHeight:52, fontSize:15 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !!socialLoading}
                  className="fifa-btn fifa-btn-gold"
                  style={{ width:'100%', minHeight:52, fontSize:16, fontWeight:900, borderRadius:18, opacity:(loading||!!socialLoading)?.7:1 }}>
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
