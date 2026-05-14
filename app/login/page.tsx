'use client';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google'|'facebook'|null>(null);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [profileSynced, setProfileSynced] = useState(false);

  // ── دمج الـ metadata من فيسبوك/جوجل في الـ profile مع احترام البيانات القديمة ──
  const upsertProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // لو الـ sync حصل قبل كدة، ما تعملش حاجة
    setProfileSynced(true);

    const meta = user.user_metadata || {};
    const isSocial = user.app_metadata?.provider !== 'email';
    const provider = user.app_metadata?.provider || 'email';

    // اسم المستخدم: فيسبوك بيبعت name، جوجل بيبعت full_name + name
    const metaName = meta.full_name || meta.name || '';

    //url الصورة: جوجل picture، فيسبوك picture.data.url أو avatar
    const metaAvatar = meta.picture || meta.avatar_url || (meta.picture?.data?.url) || null;
    const facebookUrl = provider === 'facebook' ? `https://facebook.com/${meta.id}` : null;

    // ── قراءة الـ profile الحالي عشان ما نمسحش بيانات ──
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, profile_completed, bonus_points, bonus_points_awarded, facebook_id, facebook_url, facebook_bonus_awarded, google_id, google_bonus_awarded, referral_code')
      .eq('id', user.id)
      .single();

    const hasName = !!metaName;
    const alreadyCompleted = existingProfile?.profile_completed === true;
    const alreadyHasPoints = existingProfile?.bonus_points_awarded === true;
    const alreadyHasReferral = !!(existingProfile?.referral_code && existingProfile.referral_code.trim());

    // نبني الـ update: نديفأي الفيلدات الفاضية وبس
    const update: Record<string, any> = {};

    // الاسم والصورة: لو فاضيين نملأهم
    if (!existingProfile?.full_name || existingProfile.full_name === '') {
      update.full_name = hasName ? metaName : (user.email?.split('@')[0] || '');
    }
    if (!existingProfile?.avatar_url || existingProfile.avatar_url === '') {
      update.avatar_url = metaAvatar;
    }

    // profile_completed: لو عندك اسم وهتكمل لأول مرة
    if (!alreadyCompleted && hasName) {
      update.profile_completed = true;
    }

    // bonus_points: 5 نقاط مرة واحدة لما تكمل البروفايل
    if (hasName && !alreadyHasPoints) {
      update.bonus_points = 5;
      update.bonus_points_awarded = true;
    }

    // referral_code:Generate مرة واحدة
    if (!alreadyHasReferral) {
      update.referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // ── فيسبوك ──
    if (provider === 'facebook') {
      if (!existingProfile?.facebook_id) {
        update.facebook_id = meta.sub || meta.id;
      }
      if (!existingProfile?.facebook_url) {
        update.facebook_url = facebookUrl;
      }
      if (!existingProfile?.facebook_bonus_awarded && hasName && !alreadyHasPoints) {
        update.facebook_bonus_awarded = true;
      }
    }

    // ── جوجل ──
    if (provider === 'google') {
      if (!existingProfile?.google_id) {
        update.google_id = meta.sub || meta.id;
      }
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
  };

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
    setProfileSynced(false);
    setLoading(false);
  };

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
  };

  // ── الاستماع لحدوث الـ login والعمل بعد ما المستخدم يتسجل ──
  useEffect(() => {
    if (profileSynced) return; // لمنع التكرار

    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await upsertProfile();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        upsertProfile();
      }
    });

    checkUser();
    return () => subscription.unsubscribe();
  }, [profileSynced]);

  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
      :root { --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125; --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a; --gold:#d9b25f; --red:#c93a2f; --green:#27b06e; }
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
    <div dir="rtl" style={{minHeight:'100vh',background:'radial-gradient(ellipse 80% 50% at 50% 30%,hsla(45,50%,20%,.15),var(--bg))',color:'var(--text)',fontFamily:'"Cairo",sans-serif',padding:'min(10vh,60px) 20px 40px',position:'relative',overflow:'hidden',userSelect:'none'}}>      
      <a href="/" dir="rtl" style={{position:'absolute',top:24,left:24,display:'inline-flex',alignItems:'center',gap:6,color:'var(--muted)',textDecoration:'none',fontSize:14,fontWeight:700}}>
        ←&nbsp;الرئيسية
      </a>

      <div className="panel" style={{maxWidth:380,width:'100%',margin:'auto',position:'relative',zIndex:2,
        background:`
          radial-gradient(circle at 10% 10%,rgba(217,178,95,.08),transparent 40%),
          radial-gradient(circle at 90% 20%,rgba(217,178,95,.05),transparent 35%),
          linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))
        `,boxShadow:'0 20px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)'}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:42,marginBottom:4}}>🏆</div>
          <div style={{fontSize:26,fontWeight:800,background:'linear-gradient(135deg,#f7d880,#b9892d)',backgroundClip:'text',color:'transparent',letterSpacing:'.5px'}}>الشمعدان</div>
          <div style={{fontSize:13,fontWeight:600,color:'var(--muted)',marginTop:6,background:'linear-gradient(135deg,rgba(217,178,95,.5),rgba(217,178,95,.2))',display:'inline-block',borderRadius:999,padding:'4px 14px',letterSpacing:'.5px'}}>× كأس العالم 2026</div>
        </div>

        <p style={{textAlign:'center',fontSize:13,color:'var(--muted)',fontWeight:600,margin:'0 0 20px'}}>أحلى من الماتش.. اللي بيحصل جنبيه</p>

        {sent ? (
          <div dir="rtl" style={{padding:22,borderRadius:18,background:'rgba(39,176,110,.08)',border:'1px solid rgba(39,176,110,.22)',textAlign:'center'}}>
            <div style={{fontSize:26,marginBottom:8}}>✉</div>
            <div style={{fontSize:15,fontWeight:800,color:'var(--green)',marginBottom:8}}>تم إرسال الرابط!</div>
            <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>افتح إيميلك واضغط على الرابط<br/>هتدخل مباشرة على الداشبورد</p>
            <button type="button" onClick={()=>setSent(false)} style={{marginTop:16,background:'transparent',border:'1px solid var(--line)',color:'var(--muted)',fontSize:12,fontWeight:700,padding:'10px 20px',borderRadius:10,fontFamily:'"Cairo",sans-serif',cursor:'pointer'}}>إرسال مرة تانية</button>
          </div>
        ) : (
          <>
            <button type="button" className="social-btn"
              onClick={()=>handleSocial('google')}
              disabled={!!socialLoading||loading}>
              <span aria-hidden>🔵</span> الدخول بـ Google
            </button>
            <div style={{height:10}}/>
            <button type="button" className="social-btn"
              onClick={()=>handleSocial('facebook')}
              disabled={!!socialLoading||loading}>
              <span aria-hidden>♟</span> الدخول بـ Facebook
            </button>
            <div style={{height:14,display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,height:1,background:'var(--line)'}}/>
              <span style={{color:'var(--muted)',fontSize:12,fontWeight:700}}>أو عن طريق الإيميل</span>
              <div style={{flex:1,height:1,background:'var(--line)'}}/>
            </div>

            {errorMsg && <div className="msg-error">{errorMsg}</div>}

            <form onSubmit={handleLogin} style={{marginTop:14,display:'flex',flexDirection:'column',gap:12}}>
              <label style={{ display:'block', color:'var(--muted)', marginBottom:8, fontSize:13, fontWeight:700 }}>الإيميل
                <input
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  className="field-input"
                  placeholder="example@gmail.com"
                  required
                  style={{ minHeight:52 }}
                />
              </label>
              <button
                type="submit"
                className="btn-gold"
                disabled={loading}
              >
                {loading ? '⏳ جاري الإرسال...' : '🔥 إرسال رابط الدخول'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
