'use client';
import { supabase } from '../../lib/supabase';
import { useState, useEffect, Suspense, useRef } from 'react';
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

  // ✅ FIX: useRef يمنع تشغيل upsertProfile أكتر من مرة
  const profileSyncedRef = useRef(false);

  const upsertProfile = async () => {
    // ✅ FIX: guard بالـ ref بدل state فقط
    if (profileSyncedRef.current) return;
    profileSyncedRef.current = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setProfileSynced(true);

    const meta = user.user_metadata || {};
    const provider = user.app_metadata?.provider || 'email';
    const metaName = meta.full_name || meta.name || '';
    // ✅ FIX: Facebook avatar — يجرب كل المصادر بالترتيب الصح
    const metaAvatar = meta.picture?.data?.url || meta.picture || meta.avatar_url || null;
    const facebookUrl = provider === 'facebook' ? `https://facebook.com/${meta.sub || meta.id}` : null;

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

  // ✅ FIX: useEffect يستخدم الـ ref بدل state لمنع التكرار
  useEffect(() => {
    if (profileSyncedRef.current) return;
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) await upsertProfile();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) upsertProfile();
    });
    checkUser();
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#070809', color: '#f4f1e8', fontFamily: "'Cairo', sans-serif", direction: 'rtl', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        .social-btn{width:100%;padding:13px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#f4f1e8;cursor:pointer;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;transition:background .18s}
        .social-btn:hover:not(:disabled){background:rgba(255,255,255,.08)}
        .social-btn:disabled{opacity:.5;cursor:not-allowed}
        .field-input{width:100%;padding:13px 16px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#f4f1e8;font-family:'Cairo',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        .submit-btn{width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#d9b25f,#a8761a);color:#1a1200;font-family:'Cairo',sans-serif;font-size:15px;font-weight:800;cursor:pointer;transition:opacity .18s}
        .submit-btn:hover:not(:disabled){opacity:.88}
        .submit-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <a href="/" style={{ position: 'fixed', top: 16, right: 16, padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: '#a8a39a', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Cairo,sans-serif' }}>← الرئيسية</a>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* ✅ بانر الليج — يظهر لو جاي من رابط دعوة */}
        {leagueParam && (
          <div style={{ padding: '12px 18px', borderRadius: 14, marginBottom: 16, background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#ffe3a6', marginBottom: 4 }}>🏆 تم دعوتك للانضمام لليج</div>
            <div style={{ fontSize: 12, color: '#a8a39a' }}>بعد تسجيل الدخول ستنضم تلقائياً</div>
          </div>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'linear-gradient(135deg,rgba(217,178,95,.2),rgba(217,178,95,.06))', border: '1px solid rgba(217,178,95,.2)', borderRadius: 20, fontSize: 28, marginBottom: 12 }}>🕯️</div>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: .5 }}>الشمعدان</div>
          <div style={{ color: 'rgba(217,178,95,.8)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>× كأس العالم 2026</div>
          <div style={{ color: '#a8a39a', fontSize: 12 }}>أحلى من الماتش.. اللي بيحصل جنبيه</div>
        </div>

        <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 28 }}>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✉️</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>تم إرسال الرابط!</div>
              <div style={{ color: '#a8a39a', fontSize: 13, marginBottom: 4 }}>افتح إيميلك واضغط على الرابط</div>
              <div style={{ color: '#a8a39a', fontSize: 13, marginBottom: 20 }}>هتدخل مباشرة على الداشبورد</div>
              <button
                onClick={() => setSent(false)}
                style={{ marginTop: 16, background: 'transparent', border: '1px solid rgba(255,255,255,.08)', color: '#a8a39a', fontSize: 12, fontWeight: 700, padding: '10px 20px', borderRadius: 10, fontFamily: 'Cairo, sans-serif', cursor: 'pointer' }}
              >
                إرسال مرة تانية
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => handleSocial('google')} disabled={!!socialLoading || loading} className="social-btn" style={{ marginBottom: 10 }}>
                {socialLoading === 'google' ? '⏳ جاري الدخول...' : 'الدخول بـ Google'}
              </button>
              <button onClick={() => handleSocial('facebook')} disabled={!!socialLoading || loading} className="social-btn" style={{ marginBottom: 20 }}>
                {socialLoading === 'facebook' ? '⏳ جاري الدخول...' : 'الدخول بـ Facebook'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                <span style={{ color: '#a8a39a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>أو عن طريق الإيميل</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
              </div>

              {errorMsg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9090', fontSize: 13, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{errorMsg}</div>}

              <form onSubmit={handleLogin}>
                <label style={{ fontSize: 13, color: '#a8a39a', fontWeight: 700, display: 'block', marginBottom: 8 }}>الإيميل</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-input" placeholder="example@gmail.com" required style={{ marginBottom: 16, minHeight: 52 }} />
                <button type="submit" disabled={loading || !!socialLoading} className="submit-btn">
                  {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#a8a39a', fontWeight: 700 }}>
          بالدخول، أنت موافق على شروط الاستخدام وسياسة الخصوصية
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#070809', display: 'grid', placeItems: 'center', color: '#f4f1e8', fontFamily: 'Cairo,sans-serif' }}>جاري التحميل...</div>}>
      <LoginContent />
    </Suspense>
  );
}
