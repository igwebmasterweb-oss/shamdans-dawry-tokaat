'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type SocialProvider = 'google' | 'facebook';

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  profile_completed: boolean | null;
  bonus_points: number | null;
  bonus_points_awarded: boolean | null;
  facebook_id: string | null;
  facebook_url: string | null;
  facebook_bonus_awarded: boolean | null;
  google_id: string | null;
  google_bonus_awarded: boolean | null;
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

    if (refParam && !window.sessionStorage.getItem('pendingRef')) {
      window.sessionStorage.setItem('pendingRef', refParam);
    }

    if (leagueParam && !window.sessionStorage.getItem('pendingLeague')) {
      window.sessionStorage.setItem('pendingLeague', leagueParam);
    }
  };

  const generateReferralCode = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `REF${crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;
    }

    return `REF${Math.random().toString(16).slice(2, 9).toUpperCase()}`;
  };

  const syncExistingProfile = async () => {
    if (profileSyncStartedRef.current) return;
    profileSyncStartedRef.current = true;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        profileSyncStartedRef.current = false;
        return;
      }

      const meta = user.user_metadata || {};
      const provider = (user.app_metadata?.provider || 'email') as 'email' | SocialProvider;

      const metaName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        '';

      const metaAvatar =
        meta?.picture?.data?.url ||
        meta?.picture ||
        meta?.avatar_url ||
        null;

      const providerUserId =
        (typeof meta.sub === 'string' && meta.sub) ||
        (typeof meta.id === 'string' && meta.id) ||
        null;

      const facebookUrl =
        provider === 'facebook' && providerUserId
          ? `https://facebook.com/${providerUserId}`
          : null;

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, avatar_url, profile_completed, bonus_points, bonus_points_awarded, facebook_id, facebook_url, facebook_bonus_awarded, google_id, google_bonus_awarded, referral_code'
        )
        .eq('id', user.id)
        .maybeSingle<ProfileRow>();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        profileSyncStartedRef.current = false;
        return;
      }

      // مهم جدًا:
      // المستخدم الجديد يتم إنشاؤه من trigger في قاعدة البيانات.
      // صفحة اللوجن لا تعمل insert هنا نهائيًا.
      if (!existingProfile) {
        persistPendingParams();
        setProfileSynced(true);
        return;
      }

      const hasName = !!metaName;
      const alreadyCompleted = existingProfile.profile_completed === true;
      const alreadyHasPoints = existingProfile.bonus_points_awarded === true;
      const alreadyHasReferral = !!(
        existingProfile.referral_code && existingProfile.referral_code.trim()
      );

      const update: Partial<ProfileRow> & {
        bonus_points?: number;
      } = {};

      if (!existingProfile.full_name || existingProfile.full_name.trim() === '') {
        update.full_name = hasName ? metaName : user.email?.split('@')[0] || '';
      }

      if ((!existingProfile.avatar_url || existingProfile.avatar_url.trim() === '') && metaAvatar) {
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
        update.referral_code = generateReferralCode();
      }

      if (provider === 'facebook') {
        if (!existingProfile.facebook_id && providerUserId) {
          update.facebook_id = providerUserId;
        }

        if (!existingProfile.facebook_url && facebookUrl) {
          update.facebook_url = facebookUrl;
        }

        if (!existingProfile.facebook_bonus_awarded && hasName && !alreadyHasPoints) {
          update.facebook_bonus_awarded = true;
        }
      }

      if (provider === 'google') {
        if (!existingProfile.google_id && providerUserId) {
          update.google_id = providerUserId;
        }

        if (!existingProfile.google_bonus_awarded && hasName && !alreadyHasPoints) {
          update.google_bonus_awarded = true;
        }
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          profileSyncStartedRef.current = false;
          return;
        }
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
      options: {
        emailRedirectTo: buildRedirectUrl(),
      },
    });

    if (error) {
      setErrorMsg('خطأ: ' + error.message);
    } else {
      setSent(true);
    }

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

    if (error) {
      setErrorMsg('خطأ: ' + error.message);
      setSocialLoading(null);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await syncExistingProfile();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncExistingProfile();
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #2a241f 0%, #12100e 45%, #0a0908 100%)',
        color: '#f5efe6',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        fontFamily: 'Cairo, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/"
            style={{
              color: '#c9b8a2',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← الرئيسية
          </Link>
        </div>

        {leagueParam && (
          <div
            style={{
              marginBottom: 18,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 16,
              padding: '14px 16px',
              color: '#f3dfb2',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              🏆 تم دعوتك للانضمام لليج
            </div>
            <div style={{ fontSize: 14, color: '#d7cfc3' }}>
              بعد تسجيل الدخول ستنضم تلقائياً
            </div>
          </div>
        )}

        <div
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 24,
            padding: '28px 22px',
            boxShadow: '0 20px 60px rgba(0,0,0,.35)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 46, marginBottom: 10 }}>🕯️</div>

            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 900,
                lineHeight: 1.15,
                color: '#fff7ea',
              }}
            >
              الشمعدان
            </h1>

            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 800,
                color: '#d9b26b',
              }}
            >
              × كأس العالم 2026
            </div>

            <p
              style={{
                margin: '12px auto 0',
                fontSize: 14,
                lineHeight: 1.8,
                color: '#bfb7ac',
                maxWidth: 280,
              }}
            >
              أحلى من الماتش.. اللي بيحصل جنبيه
            </p>
          </div>

          {sent ? (
            <div
              style={{
                textAlign: 'center',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 18,
                padding: '24px 18px',
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 10 }}>✉️</div>

              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
                تم إرسال الرابط!
              </div>

              <div style={{ color: '#bfb7ac', lineHeight: 1.8, fontSize: 14 }}>
                افتح إيميلك واضغط على الرابط
                <br />
                هتدخل مباشرة على الداشبورد
              </div>

              <button
                onClick={() => setSent(false)}
                style={{
                  marginTop: 16,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,.08)',
                  color: '#a8a39a',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontFamily: 'Cairo, sans-serif',
                  cursor: 'pointer',
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
                style={{
                  width: '100%',
                  minHeight: 52,
                  marginBottom: 10,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,.08)',
                  background: '#ffffff',
                  color: '#151515',
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: 'Cairo, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {socialLoading === 'google'
                  ? '⏳ جاري الدخول...'
                  : 'الدخول بـ Google'}
              </button>

              <button
                onClick={() => handleSocial('facebook')}
                disabled={!!socialLoading || loading}
                className="social-btn"
                style={{
                  width: '100%',
                  minHeight: 52,
                  marginBottom: 20,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,.08)',
                  background: '#1877F2',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: 'Cairo, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {socialLoading === 'facebook'
                  ? '⏳ جاري الدخول...'
                  : 'الدخول بـ Facebook'}
              </button>

              <div
                style={{
                  textAlign: 'center',
                  color: '#9f988f',
                  fontSize: 13,
                  marginBottom: 16,
                  fontWeight: 700,
                }}
              >
                أو عن طريق الإيميل
              </div>

              {errorMsg && (
                <div
                  style={{
                    marginBottom: 14,
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: 'rgba(255, 80, 80, 0.09)',
                    border: '1px solid rgba(255, 80, 80, 0.18)',
                    color: '#ffb3b3',
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.7,
                    textAlign: 'center',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    color: '#d7cfc3',
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  الإيميل
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  required
                  className="field-input"
                  style={{
                    width: '100%',
                    marginBottom: 16,
                    minHeight: 52,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(255,255,255,.05)',
                    color: '#fff',
                    padding: '0 16px',
                    outline: 'none',
                    fontSize: 15,
                    fontFamily: 'Cairo, sans-serif',
                  }}
                />

                <button
                  type="submit"
                  disabled={loading || !!socialLoading}
                  style={{
                    width: '100%',
                    minHeight: 54,
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #f4c56a 0%, #d79a34 100%)',
                    color: '#1a140d',
                    fontSize: 16,
                    fontWeight: 900,
                    fontFamily: 'Cairo, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
                </button>
              </form>
            </>
          )}

          <div
            style={{
              marginTop: 18,
              textAlign: 'center',
              color: '#8f887f',
              fontSize: 12,
              lineHeight: 1.9,
            }}
          >
            بالدخول، أنت موافق على شروط الاستخدام وسياسة الخصوصية
          </div>

          {profileSynced && (
            <div
              style={{
                marginTop: 12,
                textAlign: 'center',
                color: '#8f887f',
                fontSize: 11,
              }}
            >
              تم مزامنة بيانات الحساب
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#fff' }}>جاري التحميل...</div>}>
      <LoginContent />
    </Suspense>
  );
}
