'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type SocialProvider = 'google' | 'facebook';
type ProfileRow = {
  id: string; full_name: string | null; avatar_url: string | null;
  profile_completed: boolean | null; bonus_points: number | null;
  bonus_points_awarded: boolean | null; facebook_id: string | null;
  facebook_url: string | null; facebook_bonus_awarded: boolean | null;
  google_id: string | null; google_bonus_awarded: boolean | null;
  referral_code: string | null;
};

function LoginContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [profileSynced, setProfileSynced] = useState(false);
  const searchParams = useSearchParams();
  const refParam = searchParams.get('ref') || '';
  const leagueParam = searchParams.get('league') || '';
  const profileSyncStartedRef = useRef(false);

  // ═══════════════════════════════════════════
  // LOGIC — محفوظة 100% من الأصل
  // ═══════════════════════════════════════════
  const getSiteUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (envUrl) return envUrl.replace(/\/+$/, '');
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  };

  const buildRedirectUrl = () => {
    const base = `${getSiteUrl()}/dashboard`;
    const params = new URLSearchParams();
    if (refParam) params.set('ref', refParam);
    if (leagueParam) params.set('league', leagueParam);
    return params.toString() ? `${base}?${params.toString()}` : base;
  };

  const persistPendingParams = () => {
    if (typeof window === 'undefined') return;
    if (refParam && !window.sessionStorage.getItem('pendingRef')) window.sessionStorage.setItem('pendingRef', refParam);
    if (leagueParam && !window.sessionStorage.getItem('pendingLeague')) window.sessionStorage.setItem('pendingLeague', leagueParam);
  };

  const generateReferralCode = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      return `REF${crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;
    return `REF${Math.random().toString(16).slice(2, 9).toUpperCase()}`;
  };

  const syncExistingProfile = async () => {
    if (profileSyncStartedRef.current) return;
    profileSyncStartedRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { profileSyncStartedRef.current = false; return; }
      const meta = user.user_metadata || {};
      const provider = (user.app_metadata?.provider || 'email') as 'email' | SocialProvider;
      const metaName = (typeof meta.full_name === 'string' && meta.full_name.trim()) || (typeof meta.name === 'string' && meta.name.trim()) || '';
      const metaAvatar = meta?.picture?.data?.url || meta?.picture || meta?.avatar_url || null;
      const providerUserId = (typeof meta.sub === 'string' && meta.sub) || (typeof meta.id === 'string' && meta.id) || null;
      const facebookUrl = provider === 'facebook' && providerUserId ? `https://facebook.com/${providerUserId}` : null;

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, profile_completed, bonus_points, bonus_points_awarded, facebook_id, facebook_url, facebook_bonus_awarded, google_id, google_bonus_awarded, referral_code')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) { console.error('Error fetching profile:', profileError); profileSyncStartedRef.current = false; return; }

      // مهم: المستخدم الجديد بيتعمل له profile من Trigger في Supabase
      // لذلك لا نعمل insert من صفحة اللوجن
      if (!existingProfile) { persistPendingParams(); setProfileSynced(true); return; }

      const hasName = !!metaName;
      const alreadyCompleted = existingProfile.profile_completed === true;
      const alreadyHasPoints = existingProfile.bonus_points_awarded === true;
      const alreadyHasReferral = !!(existingProfile.referral_code && existingProfile.referral_code.trim());
      const update: Partial<ProfileRow> & { bonus_points?: number } = {};

      if (!existingProfile.full_name || existingProfile.full_name.trim() === '')
        update.full_name = hasName ? metaName : user.email?.split('@')[0] || '';
      if ((!existingProfile.avatar_url || existingProfile.avatar_url.trim() === '') && metaAvatar)
        update.avatar_url = metaAvatar;
      if (!alreadyCompleted && hasName) update.profile_completed = true;
      if (hasName && !alreadyHasPoints) {update.bonus_points_awarded = true;}
      if (!alreadyHasReferral) update.referral_code = generateReferralCode();

      if (provider === 'facebook') {
        if (!existingProfile.facebook_id && providerUserId) update.facebook_id = providerUserId;
        if (!existingProfile.facebook_url && facebookUrl) update.facebook_url = facebookUrl;
        if (!existingProfile.facebook_bonus_awarded && hasName && !alreadyHasPoints) update.facebook_bonus_awarded = true;
      }
      if (provider === 'google') {
        if (!existingProfile.google_id && providerUserId) update.google_id = providerUserId;
        if (!existingProfile.google_bonus_awarded && hasName && !alreadyHasPoints) update.google_bonus_awarded = true;
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase.from('profiles').update(update).eq('id', user.id);
        if (updateError) { console.error('Error updating profile:', updateError); profileSyncStartedRef.current = false; return; }
      }
      persistPendingParams();
      setProfileSynced(true);
    } catch (error) {
      console.error('syncExistingProfile error:', error);
      profileSyncStartedRef.current = false;
    }
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
    if (error) { setErrorMsg('خطأ: ' + error.message); } else { setSent(true); }
    setProfileSynced(false);
    setLoading(false);
  };

  const handleSocial = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    setErrorMsg('');
    persistPendingParams();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildRedirectUrl(),
        scopes: provider === 'facebook' ? 'email,public_profile' : undefined,
      },
    });
    if (error) { setErrorMsg('خطأ: ' + error.message); setSocialLoading(null); }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) await syncExistingProfile();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) syncExistingProfile();
    });
    checkSession();
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════
  // UI — تحسينات بصرية فقط
  // ═══════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        :root{
          --bg:#070809;--surface:#111315;--surface-2:#171a1d;
          --line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;
          --gold:#d9b25f;--red:#c93a2f;--green:#27b06e;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{min-height:100dvh}
        body{
          font-family:'Cairo',sans-serif;direction:rtl;
          background:
            radial-gradient(circle at 80% 10%,rgba(201,58,47,.12),transparent 35%),
            radial-gradient(circle at 20% 90%,rgba(217,178,95,.1),transparent 35%),
            var(--bg);
          color:var(--text);
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:24px 16px;
        }
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rotateBorder{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes checkIn{from{transform:scale(0)}to{transform:scale(1)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

        .card{
          width:100%;max-width:420px;
          background:linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.02));
          border:1px solid var(--line);border-radius:28px;
          padding:36px 32px;
          animation:fadeUp .5s ease both;
          box-shadow:0 24px 60px rgba(0,0,0,.4);
        }

        /* ✅ اللوجو */
        .logo-wrap{
          position:relative;width:96px;height:96px;
          display:flex;align-items:center;justify-content:center;
          animation:logoFloat 4s ease-in-out infinite;
          margin:0 auto 20px;
        }
        .logo-wrap::before{
          content:'';position:absolute;inset:-3px;border-radius:50%;
          background:conic-gradient(rgba(217,178,95,.6),rgba(217,178,95,.08),rgba(217,178,95,.6));
          animation:rotateBorder 4s linear infinite;
        }
        .logo-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--surface);}
        .logo-wrap img{position:relative;z-index:2;object-fit:contain;padding:8px;width:80px;height:80px}

        /* Social buttons — نفس الأصل + بسيط */
        .social-btn{
          width:100%;min-height:52px;border-radius:14px;
          border:1px solid rgba(255,255,255,.08);
          font-size:15px;font-weight:800;font-family:'Cairo',sans-serif;
          cursor:pointer;transition:opacity .18s,transform .18s;
          display:flex;align-items:center;justify-content:center;gap:10px;
        }
        .social-btn:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
        .social-btn:disabled{opacity:.5;cursor:not-allowed}

        .field-input{
          width:100%;min-height:52px;border-radius:14px;
          border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);
          color:#fff;padding:0 16px;outline:none;
          font-size:15px;font-family:'Cairo',sans-serif;direction:ltr;text-align:left;
          margin-bottom:16px;transition:border-color .2s;
        }
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        .submit-btn{
          width:100%;min-height:52px;border-radius:14px;border:none;
          background:linear-gradient(135deg,#d9b25f,#a8761a);color:#211708;
          font-size:15px;font-weight:900;font-family:'Cairo',sans-serif;cursor:pointer;
          transition:opacity .18s,transform .18s;box-shadow:0 4px 20px rgba(217,178,95,.25);
        }
        .submit-btn:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
        .submit-btn:disabled{opacity:.5;cursor:not-allowed}

        .divider{display:flex;align-items:center;gap:12px;margin:16px 0}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08)}
        .divider span{color:var(--muted);font-size:12px;font-weight:700}

        .sent-icon{width:64px;height:64px;border-radius:50%;background:rgba(39,176,110,.12);border:1px solid rgba(39,176,110,.25);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;animation:checkIn .4s cubic-bezier(0.34,1.56,0.64,1)}
      `}</style>

      {/* Back link */}
      <Link href="/" style={{ alignSelf: 'flex-start', color: 'var(--muted)', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        ← الرئيسية
      </Link>

      {/* League banner — نفس الأصل */}
      {leagueParam && (
        <div style={{ width: '100%', maxWidth: 420, background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 16, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, animation: 'slideDown .4s ease both' }}>
          <span style={{ fontSize: 24 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--gold)' }}>تم دعوتك للانضمام لليج</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>بعد تسجيل الدخول ستنضم تلقائياً</div>
          </div>
        </div>
      )}

      {/* CARD */}
      <div className="card">

        {/* ✅ اللوجو فوق العنوان */}
        <div className="logo-wrap">
          <img src="/logo-FF.png" alt="شعار الشمعدان" width={80} height={80} loading="eager" />
        </div>

        {/* Title — نفس النص الأصلي */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900, lineHeight: 1.3, marginBottom: 4 }}>
            <span style={{ background: 'linear-gradient(90deg,#d9b25f,#ffe9a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              الشمعدان
            </span>
          </h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>× كأس العالم 2026</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>أحلى من الماتش.. اللي بيحصل جنبيه</div>
        </div>

        {/* SENT STATE */}
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div className="sent-icon">✉️</div>
            <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>تم إرسال الرابط!</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
              افتح إيميلك واضغط على الرابط<br />هتدخل مباشرة على الداشبورد
            </p>
            <button onClick={() => setSent(false)} style={{ marginTop: 16, background: 'transparent', border: '1px solid rgba(255,255,255,.08)', color: '#a8a39a', fontSize: 12, fontWeight: 700, padding: '10px 20px', borderRadius: 10, fontFamily: 'Cairo, sans-serif', cursor: 'pointer' }}>
              إرسال مرة تانية
            </button>
          </div>
        ) : (
          <>
            {/* ✅ Google — نفس الـ handler الأصلي handleSocial('google') */}
            <button
              onClick={() => handleSocial('google')}
              disabled={!!socialLoading || loading}
              className="social-btn"
              style={{ background: '#ffffff', color: '#151515', marginBottom: 10 }}
            >
              {socialLoading === 'google' ? '⏳ جاري الدخول...' : 'الدخول بـ Google'}
            </button>

            {/* ✅ Facebook — نفس الـ handler الأصلي handleSocial('facebook') */}
            <button
              onClick={() => handleSocial('facebook')}
              disabled={!!socialLoading || loading}
              className="social-btn"
              style={{ background: '#1877F2', color: '#ffffff', marginBottom: 20 }}
            >
              {socialLoading === 'facebook' ? '⏳ جاري الدخول...' : 'الدخول بـ Facebook'}
            </button>

            {/* Divider */}
            <div className="divider"><span>أو عن طريق الإيميل</span></div>

            {/* Error */}
            {errorMsg && (
              <div style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#f08080', fontWeight: 700 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* ✅ Email form — نفس الأصل بالضبط */}
            <form onSubmit={handleLogin}>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 7 }}>الإيميل</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                required
                className="field-input"
              />
              <button type="submit" disabled={loading || !!socialLoading} className="submit-btn">
                {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
              </button>
            </form>
          </>
        )}

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, fontWeight: 700, marginTop: 20, lineHeight: 1.7 }}>
          بالدخول، أنت موافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>

      {/* Sync badge — نفس الأصل */}
      {profileSynced && (
        <div style={{ marginTop: 16, background: 'rgba(39,176,110,.1)', border: '1px solid rgba(39,176,110,.2)', color: '#94f0c0', padding: '8px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700, animation: 'slideDown .3s ease' }}>
          ✓ تم مزامنة بيانات الحساب
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: '#a8a39a', textAlign: 'center', padding: 40, fontFamily: 'Cairo, sans-serif' }}>⏳ جاري التحميل...</div>}>
      <LoginContent />
    </Suspense>
  );
}
