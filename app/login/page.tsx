'use client';
import { supabase } from '../../lib/supabase';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [profileSynced, setProfileSynced] = useState(false);
  const searchParams = useSearchParams();
  // ✅ ref= للـ referral، league= لكود الليج — مستقلان
  const refParam = searchParams.get('ref') || '';
  const leagueParam = searchParams.get('league') || '';

  const upsertProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setProfileSynced(true);

    const meta = user.user_metadata || {};
    const provider = user.app_metadata?.provider || 'email';
    const metaName = meta.full_name || meta.name || '';
    const metaAvatar = meta.picture || meta.avatar_url || (meta.picture?.data?.url) || null;
    const facebookUrl = provider === 'facebook' ? `https://facebook.com/${meta.id}` : null;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,profile_completed,bonus_points,bonus_points_awarded,facebook_id,facebook_url,facebook_bonus_awarded,google_id,google_bonus_awarded,referral_code')
      .eq('id', user.id)
      .single();

    const hasName = !!metaName;
    const alreadyCompleted = existingProfile?.profile_completed === true;
    const alreadyHasPoints = existingProfile?.bonus_points_awarded === true;
    const alreadyHasReferral = !!(existingProfile?.referral_code && existingProfile.referral_code.trim());

    const update: Record<string, any> = {};

    if (!existingProfile?.full_name || existingProfile.full_name === '') {
      update.full_name = hasName ? metaName : (user.email?.split('@')[0] || '');
    }
    if (!existingProfile?.avatar_url || existingProfile.avatar_url === '') {
      update.avatar_url = metaAvatar;
    }
    if (!alreadyCompleted && hasName) {
      update.profile_completed = true;
    }
    if (hasName && !alreadyHasPoints) {
      update.bonus_points = 5;
      update.bonus_points_awarded = true;
    }
    if (!alreadyHasReferral) {
      update.referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    if (provider === 'facebook') {
      if (!existingProfile?.facebook_id) update.facebook_id = meta.sub || meta.id;
      if (!existingProfile?.facebook_url) update.facebook_url = facebookUrl;
      if (!existingProfile?.facebook_bonus_awarded && hasName && !alreadyHasPoints) {
        update.facebook_bonus_awarded = true;
      }
    }
    if (provider === 'google') {
      if (!existingProfile?.google_id) update.google_id = meta.sub || meta.id;
      if (!existingProfile?.google_bonus_awarded && hasName && !alreadyHasPoints) {
        update.google_bonus_awarded = true;
      }
    }

    if (existingProfile) {
      if (Object.keys(update).length > 0) {
        await supabase.from('profiles').update(update).eq('id', user.id);
      }
    } else {
      await supabase.from('profiles').insert({ id: user.id, ...update });
    }

    // ✅ حفظ ref و league في sessionStorage بشكل مستقل
    if (typeof window !== 'undefined') {
      if (refParam && !window.sessionStorage.getItem('pendingRef')) {
        window.sessionStorage.setItem('pendingRef', refParam);
      }
      if (leagueParam && !window.sessionStorage.getItem('pendingLeague')) {
        window.sessionStorage.setItem('pendingLeague', leagueParam);
      }
    }
  };

  const buildRedirectUrl = () => {
    const base = `${window.location.origin}/dashboard`;
    const params = new URLSearchParams();
    if (refParam) params.set('ref', refParam);
    if (leagueParam) params.set('league', leagueParam);
    return params.toString() ? `${base}?${params.toString()}` : base;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildRedirectUrl() },
    });
    if (error) setErrorMsg('خطأ: ' + error.message);
    else setSent(true);
    setProfileSynced(false);
    setLoading(false);
  };

  const handleSocial = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: buildRedirectUrl() },
    });
    if (error) {
      setErrorMsg('خطأ: ' + error.message);
      setSocialLoading(null);
    }
  };

  useEffect(() => {
    if (profileSynced) return;
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) await upsertProfile();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) upsertProfile();
    });
    checkUser();
    return () => subscription.unsubscribe();
  }, [profileSynced]);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(217,178,95,.1),transparent),#070809',
        display: 'grid',
        placeItems: 'center',
        padding: '24px 16px',
        fontFamily: 'Cairo, sans-serif',
        color: '#f4f1e8',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125;
          --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a;
          --gold:#d9b25f; --red:#c93a2f; --green:#27b06e;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .panel{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:24px;padding:32px 28px}
        .social-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:52px;border-radius:18px;background:var(--surface-3);border:1px solid var(--line);color:var(--text);font-size:14px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;transition:all .2s}
        .social-btn:hover:not(:disabled){border-color:rgba(217,178,95,.25);background:rgba(217,178,95,.05)}
        .social-btn:disabled{opacity:.5;cursor:not-allowed}
        .field-input{width:100%;padding:14px 16px;border-radius:14px;background:var(--surface-3);border:1px solid var(--line);color:var(--text);font-family:'Cairo',sans-serif;font-size:15px;outline:none;transition:border-color .2s}
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        .field-input::placeholder{color:var(--muted)}
        .btn-gold{width:100%;min-height:52px;border-radius:18px;border:none;background:linear-gradient(135deg,#e0bc73,#b9892d);color:#211708;font-size:16px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;box-shadow:0 8px 24px rgba(217,178,95,.22);transition:opacity .2s}
        .btn-gold:hover:not(:disabled){opacity:.88}
        .btn-gold:disabled{opacity:.6;cursor:not-allowed}
        .msg-error{padding:12px 16px;border-radius:14px;background:rgba(201,58,47,.12);border:1px solid rgba(201,58,47,.28);color:#ff9c91;font-size:13px;font-weight:700}
      `}</style>

      <a
        href="/"
        dir="rtl"
        style={{
          position: 'absolute', top: 24, left: 24,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#a8a39a', textDecoration: 'none', fontSize: 13, fontWeight: 700,
          padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(255,255,255,.03)',
        }}
      >
        ← الرئيسية
      </a>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* ✅ بانر الليج — يظهر لو جاي من رابط دعوة */}
        {leagueParam && (
          <div style={{ marginBottom: 20, padding: '14px 20px', borderRadius: 18, background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.25)', textAlign: 'center', color: '#ffe3a6', fontSize: 14, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
            🏆 تم دعوتك للانضمام لليج
            <br />
            <span style={{ fontSize: 12, color: '#a8a39a', display: 'block', marginTop: 4 }}>بعد تسجيل الدخول ستنضم تلقائياً</span>
          </div>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d9b25f', marginBottom: 4 }}>الشمعدان</div>
          <div style={{ fontSize: 14, color: '#a8a39a', fontWeight: 600 }}>× كأس العالم 2026</div>
          <div style={{ fontSize: 13, color: 'rgba(168,163,154,.7)', marginTop: 8 }}>أحلى من الماتش.. اللي بيحصل جنبيه</div>
        </div>

        <div className="panel">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#d9b25f', marginBottom: 8 }}>تم إرسال الرابط!</div>
              <div style={{ fontSize: 14, color: '#a8a39a', lineHeight: 1.7 }}>
                افتح إيميلك واضغط على الرابط<br />هتدخل مباشرة على الداشبورد
              </div>
              <button
                onClick={() => setSent(false)}
                style={{
                  marginTop: 16, background: 'transparent',
                  border: '1px solid rgba(255,255,255,.08)', color: '#a8a39a',
                  fontSize: 12, fontWeight: 700, padding: '10px 20px',
                  borderRadius: 10, fontFamily: 'Cairo, sans-serif', cursor: 'pointer',
                }}
              >
                إرسال مرة تانية
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleSocial('google')}
                disabled={!!socialLoading || loading}
                className="social-btn"
                style={{ marginBottom: 10 }}
              >
                <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.2 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 36 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.4 4.2-4.5 5.5l6.2 5.2C40.6 35.4 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                {socialLoading === 'google' ? '⏳ جاري الدخول...' : 'الدخول بـ Google'}
              </button>

              <button
                onClick={() => handleSocial('facebook')}
                disabled={!!socialLoading || loading}
                className="social-btn"
                style={{ marginBottom: 20 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                {socialLoading === 'facebook' ? '⏳ جاري الدخول...' : 'الدخول بـ Facebook'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                <span style={{ fontSize: 12, color: '#a8a39a', fontWeight: 700 }}>أو عن طريق الإيميل</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
              </div>

              {errorMsg && <div className="msg-error" style={{ marginBottom: 14 }}>{errorMsg}</div>}

              <form onSubmit={handleLogin}>
                <label style={{ display: 'block', fontSize: 13, color: '#a8a39a', fontWeight: 700, marginBottom: 8 }}>الإيميل</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="example@gmail.com"
                  required
                  style={{ marginBottom: 16, minHeight: 52 }}
                />
                <button type="submit" disabled={loading || !!socialLoading} className="btn-gold">
                  {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#070809', display: 'grid', placeItems: 'center', fontFamily: 'Cairo, sans-serif', color: '#f4f1e8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 16, color: '#a8a39a' }}>جاري التحميل...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
