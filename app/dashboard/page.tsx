'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  profile_completed: boolean;
  bonus_points_awarded: boolean;
  bonus_points?: number;
  facebook_url?: string | null;
  facebook_bonus_awarded?: boolean;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'predict' | 'my' | 'leaders' | 'feed' | 'history'>('predict');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [predForms, setPredForms] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '', facebook_url: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [showReferral, setShowReferral] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [socialFeed, setSocialFeed] = useState<any[]>([]);
  const [historyRankings, setHistoryRankings] = useState<any[]>([]);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [activeHistoryDate, setActiveHistoryDate] = useState('');

  const router = useRouter();
  const rounds = ['Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3'];
  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      loadData(data.user.id);
    });
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (profileData) {
        setProfile(profileData);
        // auto-fill facebook from OAuth metadata if available
        const { data: sessionData } = await supabase.auth.getSession();
        const provider = sessionData?.session?.user?.app_metadata?.provider;
        const fbName = sessionData?.session?.user?.user_metadata?.name || '';
        const fbMeta = provider === 'facebook'
          ? `https://facebook.com/${fbName}`
          : null;
        setProfileForm({
          display_name: profileData.full_name || '',
          phone: profileData.phone || '',
          facebook_url: profileData.facebook_url || fbMeta || '',
        });
      }
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];
      const { data: sbFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,surprise_answer,surprise_question');
      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
        return { ...m, is_open: sb?.is_open ?? false, actual_home_score: sb?.actual_home_score ?? null, actual_away_score: sb?.actual_away_score ?? null, first_scorer: sb?.first_scorer ?? '', went_extra_time: sb?.went_extra_time ?? false, surprise_answer: sb?.surprise_answer ?? '', surprise_question: sb?.surprise_question ?? '' };
      });
      setMatches(merged);
      const { data: userPreds } = await supabase.from('predictions').select('*').eq('user_id', userId);
      setPredictions(userPreds || []);
      const { data: myPointsRow } = await supabase.from('user_points').select('referral_code, referral_count').eq('user_id', userId).maybeSingle();
      if (myPointsRow) { setReferralCode(myPointsRow.referral_code || ''); setReferralCount(myPointsRow.referral_count || 0); }

      // معالجة الـ referral لو جه من رابط دعوة
      // Social Feed
      const { data: feedData } = await supabase
        .from('social_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setSocialFeed(feedData || []);

      // Historical Rankings
      const { data: histData } = await supabase
        .from('historical_rankings')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .order('rank', { ascending: true });
      if (histData && histData.length > 0) {
        const dates = [...new Set(histData.map((r: any) => r.snapshot_date))] as string[];
        setHistoryDates(dates);
        setActiveHistoryDate(dates[0]);
        setHistoryRankings(histData);
      }

      const pendingRef = sessionStorage.getItem('pendingRef');
      if (pendingRef) {
        sessionStorage.removeItem('pendingRef');
        await supabase.rpc('process_referral', { p_referred_id: userId, p_referral_code: pendingRef });
      }
      const { data: userPointsData } = await supabase.from('user_points').select('*').order('total_points', { ascending: false });
      setLeaderboard((userPointsData || []).map((row: any) => ({
        user_id: row.user_id, user_email: row.user_email, display_name: row.full_name || null,
        profile_completed: row.profile_completed || false, totalPoints: row.total_points || 0, count: row.predictions_count || 0,
      })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!profileForm.display_name.trim()) { setProfileMsg('❌ الاسم مطلوب'); return; }
    setProfileSaving(true);
    try {
      const fbUrl = profileForm.facebook_url.trim();
      const fbValid = fbUrl && (fbUrl.includes('facebook.com') || fbUrl.includes('fb.com'));

      // النقاط تُعطى مرة واحدة فقط لما يكمل الثلاثة: اسم + تليفون + فيسبوك
      const hasAll = profileForm.display_name.trim() && profileForm.phone.trim() && fbValid;
      const isCompleting = !profile?.bonus_points_awarded && hasAll;

      const updates: any = {
        full_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        facebook_url: fbValid ? fbUrl : null,
        profile_completed: !!(profileForm.display_name.trim() && profileForm.phone.trim()),
        updated_at: new Date().toISOString(),
      };
      if (isCompleting) { updates.bonus_points_awarded = true; updates.bonus_points = 5; }

      const { error } = await supabase.from('profiles').upsert({ id: user.id, ...updates });
      if (error) throw error;

      if (isCompleting) {
        setProfileMsg('✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉');
      } else if (!hasAll && !profile?.bonus_points_awarded) {
        const missing = [];
        if (!profileForm.phone.trim()) missing.push('التليفون');
        if (!fbValid) missing.push('فيسبوك');
        setProfileMsg(`💾 تم الحفظ — أكمل ${missing.join(' + ')} للحصول على 5 نقاط 🎁`);
      } else {
        setProfileMsg('✅ تم الحفظ!');
      }

      await loadData(user.id);
      setTimeout(() => { setShowProfileModal(false); setProfileMsg(''); }, 2500);
    } catch { setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً'); }
    setProfileSaving(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id === match.fixture.id);
    return { homeScore: ex?.predicted_home_score ?? 0, awayScore: ex?.predicted_away_score ?? 0, firstScorer: ex?.predicted_first_scorer ?? '', extraTime: ex?.predicted_extra_time ?? false, surpriseAnswer: ex?.surprise_answer ?? '' };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms(prev => ({ ...prev, [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch } }));

  const submitPrediction = async (match: any) => {
    if (!user) return;
    setSubmitting(match.fixture.id);
    const form = getForm(match);
    try {
      const ex = predictions.find(p => p.fixture_id === match.fixture.id);
      const payload = {
        user_id: user.id, user_email: user.email, fixture_id: match.fixture.id,
        home_team: match.teams.home.name, away_team: match.teams.away.name,
        predicted_home_score: form.homeScore, predicted_away_score: form.awayScore,
        predicted_first_scorer: form.firstScorer || null, predicted_extra_time: form.extraTime,
        surprise_answer: form.surpriseAnswer || null, submitted_at: new Date().toISOString(),
        points: ex?.points ?? 0, actual_home_score: null, actual_away_score: null,
      };
      if (ex) await supabase.from('predictions').update(payload).eq('id', ex.id);
      else await supabase.from('predictions').insert(payload);
      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      setPredictions(data || []);
      setMessages(m => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch { setMessages(m => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' })); }
    setSubmitting(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const feedEventLabel = (event: string, meta: any) => {
    switch (event) {
      case 'prediction_submitted': return `⚽ توقّع نتيجة ${meta?.home || ''} × ${meta?.away || ''}`;
      case 'referral_bonus': return '🎉 دعا صديقاً جديداً وربح 5 نقاط!';
      case 'profile_completed': return '✅ أكمل بياناته الشخصية وربح 5 نقاط!';
      case 'points_earned': return `🏅 كسب ${meta?.points || ''} نقطة`;
      default: return '🔔 نشاط جديد';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const getReferralLink = () => `${window.location.origin}/login?ref=${referralCode}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(getReferralLink()).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2500);
    });
  };

  const shareOnWhatsApp = () => {
    const txt = encodeURIComponent(`🏆 انضم لمنافسة الشمعدان × كأس العالم 2026!\nسجّل عن طريق رابطي واحصل على نقاط إضافية:\n${getReferralLink()}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(getReferralLink());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
  };

  const shareOnMessenger = () => {
    const url = encodeURIComponent(getReferralLink());
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=1302682795390354&redirect_uri=${url}`, '_blank');
  };

  // ── LOADING ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#070809', display: 'grid', placeItems: 'center', fontFamily: 'Cairo, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');`}</style>
      <div style={{ textAlign: 'center', color: '#a8a39a' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 15 }}>جاري التحميل...</div>
      </div>
    </div>
  );

  const myPoints = predictions.reduce((s, p) => s + (p.points || 0), 0) + (profile?.bonus_points || 0);
  const myRank = leaderboard.findIndex(p => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const medals = ['🥇', '🥈', '🥉'];
  const displayName = profile?.full_name || user?.email?.split('@')[0];
  const profileIncomplete = !profile?.profile_completed;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg: #070809;
          --surface: #111315;
          --surface-2: #171a1d;
          --surface-3: #1d2125;
          --line: rgba(255,255,255,.08);
          --text: #f4f1e8;
          --muted: #a8a39a;
          --gold: #d9b25f;
          --gold-soft: rgba(217,178,95,.14);
          --red: #c93a2f;
          --green: #27b06e;
          --blue: #3b82f6;
          --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Cairo', sans-serif;
          background:
            radial-gradient(circle at top right, rgba(201,58,47,.08), transparent 26%),
            radial-gradient(circle at top left, rgba(217,178,95,.08), transparent 28%),
            #070809;
          color: var(--text);
          direction: rtl;
          min-height: 100vh;
        }

        /* ── TABS ── */
        .tab-btn {
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--muted);
          cursor: pointer;
          font-family: 'Cairo', sans-serif;
          font-size: 14px;
          font-weight: 700;
          transition: all .2s;
        }
        .tab-btn.active {
          background: linear-gradient(90deg, rgba(217,178,95,.18), rgba(217,178,95,.06));
          border-color: rgba(217,178,95,.3);
          color: #fff1ce;
        }

        /* ── ROUND CHIPS ── */
        .round-btn {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--muted);
          cursor: pointer;
          font-family: 'Cairo', sans-serif;
          font-size: 13px;
          font-weight: 700;
          transition: all .2s;
        }
        .round-btn.active {
          color: #fff1ce;
          border-color: rgba(217,178,95,.3);
          background: rgba(217,178,95,.12);
        }

        /* ── MATCH CARD ── */
        .match-card {
          background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 14px;
          box-shadow: var(--shadow);
        }

        /* ── STATUS PILL ── */
        .pill-open {
          font-size: 12px; padding: 6px 12px; border-radius: 999px; font-weight: 700;
          border: 1px solid rgba(39,176,110,.25);
          background: rgba(39,176,110,.12);
          color: #94f0c0;
        }
        .pill-closed {
          font-size: 12px; padding: 6px 12px; border-radius: 999px; font-weight: 700;
          border: 1px solid var(--line);
          background: var(--surface-3);
          color: var(--muted);
        }
        .pill-saved {
          font-size: 12px; padding: 6px 12px; border-radius: 999px; font-weight: 700;
          border: 1px solid rgba(217,178,95,.25);
          background: rgba(217,178,95,.1);
          color: #ffe3a6;
        }

        /* ── SCORE STEPPER ── */
        .score-row {
          display: flex; align-items: center; gap: 12px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 18px; padding: 12px 16px; margin-bottom: 10px;
        }
        .score-btn {
          width: 38px; height: 38px; border-radius: 12px;
          border: 1px solid var(--line); background: var(--surface-3);
          color: var(--text); font-size: 20px; font-weight: 800;
          display: grid; place-items: center; cursor: pointer; transition: all .2s;
          font-family: 'Cairo', sans-serif;
        }
        .score-btn.plus {
          background: linear-gradient(135deg, #e0bc73, #b9892d);
          border: none; color: #231a0c;
        }
        .score-val {
          font-size: 22px; font-weight: 800; min-width: 32px;
          text-align: center; font-variant-numeric: tabular-nums;
        }

        /* ── FIELD INPUT ── */
        .field-row {
          display: flex; align-items: center; gap: 10px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 18px; padding: 12px 16px; margin-bottom: 10px;
        }
        .field-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text); font-family: 'Cairo', sans-serif; font-size: 14px;
          font-weight: 600; text-align: right;
        }
        .field-input::placeholder { color: var(--muted); }
        .field-label { font-size: 13px; color: var(--muted); font-weight: 700; white-space: nowrap; }
        .points-tag {
          font-size: 11px; padding: 4px 10px; border-radius: 999px;
          font-weight: 700; white-space: nowrap;
        }

        /* ── SAVE BUTTON ── */
        .save-btn {
          width: 100%; padding: 14px;
          border-radius: 18px;
          background: linear-gradient(135deg, #e0bc73, #b9892d);
          border: none; color: #211708;
          font-weight: 800; font-size: 15px;
          font-family: 'Cairo', sans-serif; cursor: pointer;
          box-shadow: 0 8px 24px rgba(217,178,95,.2);
          transition: opacity .2s;
        }
        .save-btn:hover { opacity: .88; }
        .save-btn:disabled { opacity: .5; cursor: not-allowed; }

        /* ── PREDICTION BOX (saved preview) ── */
        .pred-box {
          background: rgba(217,178,95,.08);
          border: 1px solid rgba(217,178,95,.18);
          border-radius: 18px; padding: 12px 16px;
        }

        /* ── STAT CARD ── */
        .stat-card {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 22px; padding: 18px;
        }

        /* ── RANK ITEM ── */
        .rank-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center; gap: 14px;
          padding: 14px 18px;
          background: linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01));
          border: 1px solid var(--line); border-radius: 20px;
          margin-bottom: 10px; transition: border-color .2s;
        }
        .rank-item.me {
          border-color: rgba(217,178,95,.28);
          background: linear-gradient(90deg, rgba(217,178,95,.10), rgba(255,255,255,.02));
        }
        .medal-box {
          width: 44px; height: 44px; border-radius: 14px;
          background: rgba(217,178,95,.1); display: grid;
          place-items: center; font-size: 22px;
        }

        /* ── MODAL ── */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.75);
          backdrop-filter: blur(6px); display: grid;
          place-items: center; z-index: 1000; padding: 20px;
        }
        .modal-box {
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015)), var(--surface);
          border: 1px solid rgba(217,178,95,.2);
          border-radius: 28px; padding: 28px;
          width: 100%; max-width: 460px;
          box-shadow: 0 24px 64px rgba(0,0,0,.6);
        }
        .modal-input {
          width: 100%; padding: 13px 16px; border-radius: 14px;
          background: var(--surface-3); border: 1px solid var(--line);
          color: var(--text); font-family: 'Cairo', sans-serif;
          font-size: 14px; outline: none; transition: border-color .2s;
          direction: rtl;
        }
        .modal-input:focus { border-color: rgba(217,178,95,.4); }
      `}</style>

      {/* ══════════════════ HEADER ══════════════════ */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(217,178,95,.06), transparent 100%), var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #f0cf84, #a97b26)',
          display: 'grid', placeItems: 'center', fontSize: 22,
          boxShadow: '0 6px 18px rgba(217,178,95,.25)',
        }}>🏆</div>

        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>الشمعدان × كأس العالم</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>أهلاً {displayName}! 👋</div>
        </div>

        {/* Points + Rank */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.22)', borderRadius: 14, padding: '7px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{myPoints}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>نقطة</div>
          </div>
          {myRank > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '7px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#{myRank}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>ترتيب</div>
            </div>
          )}
        </div>

        {/* Profile Button */}
        <button onClick={() => setShowProfileModal(true)} style={{
          padding: '9px 16px', borderRadius: 12, cursor: 'pointer',
          border: profileIncomplete ? '1px solid rgba(217,178,95,.35)' : '1px solid var(--line)',
          background: profileIncomplete ? 'rgba(217,178,95,.08)' : 'var(--surface-2)',
          color: profileIncomplete ? '#f2d79e' : 'var(--text)',
          fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {profileIncomplete ? '🎁 أكمل ملفك +5 نقاط' : `✏️ ${displayName}`}
        </button>
        

        <a href="/my-leagues" style={{
          padding: '9px 16px', borderRadius: 12, border: '1px solid var(--line)',
          background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>🏆 ليجاتي</a>

        <button onClick={() => setShowReferral(true)} style={{
          padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)',
          background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          🎁 ادعُ صديق {referralCount > 0 && <span style={{ background: 'rgba(39,176,110,.25)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{referralCount}</span>}
        </button>

       
        <button onClick={handleLogout} style={{
          padding: '9px 16px', borderRadius: 12, border: '1px solid var(--line)',
          background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
        }}>خروج</button>
      </header>

      {/* ── INCOMPLETE BANNER ── */}
      {profileIncomplete && (
        <div onClick={() => setShowProfileModal(true)} style={{
          background: 'linear-gradient(90deg, rgba(217,178,95,.1), rgba(217,178,95,.04))',
          borderBottom: '1px solid rgba(217,178,95,.18)',
          padding: '10px 20px', cursor: 'pointer', textAlign: 'center',
          fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#f2d79e',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span>🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً!</span>
          <span style={{ textDecoration: 'underline', fontWeight: 800 }}>اضغط هنا</span>
        </div>
      )}

      {/* ══════════════════ PROFILE MODAL ══════════════════ */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }} style={{
                background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10,
                width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16,
                display: 'grid', placeItems: 'center',
              }}>✕</button>
            </div>
            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.22)', borderRadius: 14, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f2d79e', textAlign: 'center', fontWeight: 700 }}>
                🎁 أكمل <strong>الاسم + التليفون + فيسبوك</strong> واحصل على 5 نقاط!
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12 }}>
                  <span style={{ color: profileForm.display_name.trim() ? '#5effa8' : 'var(--muted)' }}>
                    {profileForm.display_name.trim() ? '✅' : '○'} الاسم
                  </span>
                  <span style={{ color: profileForm.phone.trim() ? '#5effa8' : 'var(--muted)' }}>
                    {profileForm.phone.trim() ? '✅' : '○'} التليفون
                  </span>
                  <span style={{ color: profileForm.facebook_url.trim() ? '#5effa8' : 'var(--muted)' }}>
                    {profileForm.facebook_url.trim() ? '✅' : '○'} فيسبوك
                  </span>
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>
              الاسم الكامل <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input type="text" value={profileForm.display_name}
              onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="اسمك كما تريد أن يظهر في الصدارة"
              className="modal-input" style={{ marginBottom: 14 }} />
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>
              رقم التليفون <span style={{ fontSize: 11, color: 'var(--muted)' }}>(مطلوب للنقاط)</span>
            </label>
            <input type="tel" value={profileForm.phone}
              onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="01012345678"
              className="modal-input" style={{ marginBottom: 14, direction: 'ltr', textAlign: 'right' }} />
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>
              رابط فيسبوك
              {profile?.facebook_bonus_awarded
                ? <span style={{ color: '#5effa8', marginRight: 8 }}>✅ مضاف</span>
                : <span style={{ fontSize: 11, color: 'var(--gold)', marginRight: 8 }}>+5 نقاط عند إكمال الثلاثة</span>
              }
            </label>
            <input
              type="url"
              value={profileForm.facebook_url}
              onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))}
              placeholder="https://facebook.com/username"
              className="modal-input"
              style={{ marginBottom: 20, direction: 'ltr', textAlign: 'right' }}
              readOnly={!!(profile?.facebook_url && profileForm.facebook_url)}
            />
            {profileMsg && (
              <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 14, fontWeight: 700,
                color: profileMsg.startsWith('✅') ? 'var(--green)' : profileMsg.startsWith('💾') ? '#f2d79e' : 'var(--red)'
              }}>{profileMsg}</div>
            )}
            <button onClick={saveProfile} disabled={profileSaving} className="save-btn">
              {profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ REFERRAL MODAL ══════════════════ */}
      {showReferral && (
        <div className="modal-overlay" onClick={() => setShowReferral(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>🎁 ادعُ أصدقاءك</h3>
              <button onClick={() => setShowReferral(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(39,176,110,.08)', border: '1px solid rgba(39,176,110,.2)', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#5effa8' }}>{referralCount}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>أصدقاء انضموا</div>
              </div>
              <div style={{ background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{referralCount * 5}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>نقاط من الدعوات</div>
              </div>
            </div>

            {/* كيف يعمل */}
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}>⚡ كيف يعمل؟</div>
              <div>١. شارك رابطك مع أصدقاءك</div>
              <div>٢. لما يسجلوا عن طريق رابطك → <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+5 نقاط لك</span></div>
              <div>٣. مفيش حد أقصى للدعوات 🚀</div>
            </div>

            {/* الرابط */}
            <div style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                {typeof window !== 'undefined' ? getReferralLink() : '...'}
              </span>
              <button onClick={copyReferralLink} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: referralCopied ? 'rgba(39,176,110,.3)' : 'rgba(217,178,95,.2)', color: referralCopied ? '#5effa8' : 'var(--gold)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', whiteSpace: 'nowrap', transition: 'all .2s' }}>
                {referralCopied ? '✅ تم النسخ' : '📋 نسخ'}
              </button>
            </div>

            {/* أزرار المشاركة */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <button onClick={shareOnWhatsApp} style={{ padding: '12px 8px', borderRadius: 14, border: '1px solid rgba(37,211,102,.25)', background: 'rgba(37,211,102,.08)', color: '#5effa8', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'opacity .2s' }}>
                <span style={{ fontSize: 22 }}>💬</span> واتساب
              </button>
              <button onClick={shareOnFacebook} style={{ padding: '12px 8px', borderRadius: 14, border: '1px solid rgba(24,119,242,.25)', background: 'rgba(24,119,242,.08)', color: '#7db1ff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'opacity .2s' }}>
                <span style={{ fontSize: 22 }}>📘</span> فيسبوك
              </button>
              <button onClick={shareOnMessenger} style={{ padding: '12px 8px', borderRadius: 14, border: '1px solid rgba(0,132,255,.25)', background: 'rgba(0,132,255,.08)', color: '#7db1ff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'opacity .2s' }}>
                <span style={{ fontSize: 22 }}>⚡</span> ماسنجر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MAIN ══════════════════ */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px', fontFamily: 'Cairo, sans-serif' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'نقاطي', value: myPoints, color: 'var(--gold)', icon: '🏅' },
            { label: 'ترتيبي', value: myRank > 0 ? `#${myRank}` : '—', color: 'var(--text)', icon: '📊' },
            { label: 'توقعاتي', value: predictions.length, color: '#8ae0b3', icon: '⚽' },
            { label: 'المتسابقون', value: leaderboard.length, color: '#7db1ff', icon: '👥' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 26, flexWrap: 'wrap' }}>
          {([
            { id: 'predict', label: '⚽ التوقعات' },
            { id: 'my',      label: '📋 توقعاتي' },
            { id: 'leaders', label: '🏆 الصدارة' },
            { id: 'history', label: '📈 السجل التاريخي' },
            { id: 'feed',    label: '🌍 نشاط اللاعبين' },
          ] as const).map(({ id, label }) => (
            <button key={id} className={`tab-btn${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* ════════════════ PREDICT TAB ════════════════ */}
        {activeTab === 'predict' && (
          <div>
            {/* Round chips */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r]} ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                لا توجد ماتشات في هذه الجولة
              </div>
            ) : filteredMatches.map(match => {
              const existing = predictions.find(p => p.fixture_id === match.fixture.id);
              const form = getForm(match);
              const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const msg = messages[match.fixture.id];

              return (
                <div key={match.fixture.id} className="match-card">
                  {/* Match header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                        {match.teams.home.name} &nbsp;×&nbsp; {match.teams.away.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className={match.is_open ? 'pill-open' : 'pill-closed'}>
                        {match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}
                      </span>
                      {existing && <span className="pill-saved">✅ محفوظ</span>}
                    </div>
                  </div>

                  {/* Teams display */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', textAlign: 'center', gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 22, margin: '0 auto 6px' }}>
                        {match.teams.home.logo ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={32} height={32} style={{ borderRadius: 6 }} /> : '⚽'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{match.teams.home.name}</div>
                    </div>
                    <div style={{ fontSize: hasResult ? 28 : 20, fontWeight: 800, color: 'var(--gold)' }}>
                      {hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}
                    </div>
                    <div>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 22, margin: '0 auto 6px' }}>
                        {match.teams.away.logo ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={32} height={32} style={{ borderRadius: 6 }} /> : '⚽'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{match.teams.away.name}</div>
                    </div>
                  </div>

                  {/* Actual result details */}
                  {hasResult && (
                    <div style={{ background: 'rgba(217,178,95,.06)', border: '1px solid rgba(217,178,95,.14)', borderRadius: 16, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>النتيجة الفعلية</div>
                        {match.first_scorer && <div style={{ fontSize: 13, color: 'var(--gold)' }}>⚽ أول هدف: {match.first_scorer}</div>}
                      </div>
                      {existing && (
                        <div style={{ textAlign: 'center', background: 'var(--surface-3)', borderRadius: 14, padding: '8px 18px' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: existing.points >= 10 ? '#ffe3a6' : existing.points >= 5 ? '#94f0c0' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {existing.points || 0}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Prediction form — open */}
                  {match.is_open && (
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontWeight: 700 }}>توقّع النتيجة</div>
                      {[
                        { key: 'homeScore', team: match.teams.home.name },
                        { key: 'awayScore', team: match.teams.away.name },
                      ].map(({ key, team }) => (
                        <div key={key} className="score-row">
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{team}</span>
                          <button className="score-btn" onClick={() => setForm(match.fixture.id, { [key]: Math.max(0, (form[key] || 0) - 1) })}>−</button>
                          <span className="score-val">{form[key] || 0}</span>
                          <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { [key]: (form[key] || 0) + 1 })}>+</button>
                        </div>
                      ))}

                      {/* First scorer */}
                      <div className="field-row">
                        <span className="field-label">⚽ أول هدف</span>
                        <span className="points-tag" style={{ background: 'rgba(39,176,110,.12)', color: '#94f0c0', border: '1px solid rgba(39,176,110,.2)' }}>+3</span>
                        <input type="text" value={form.firstScorer}
                          onChange={e => setForm(match.fixture.id, { firstScorer: e.target.value })}
                          className="field-input" placeholder="مثال: مبابي" />
                      </div>

                      {/* Extra time */}
                      <label className="field-row" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.extraTime}
                          onChange={e => setForm(match.fixture.id, { extraTime: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: 'var(--gold)', flexShrink: 0 }} />
                        <span className="field-label" style={{ flex: 1 }}>⏱️ وقت إضافي؟</span>
                        <span className="points-tag" style={{ background: 'rgba(59,130,246,.12)', color: '#7db1ff', border: '1px solid rgba(59,130,246,.2)' }}>+2</span>
                      </label>

                      {/* Surprise question */}
                      {match.surprise_question && (
                        <div className="field-row" style={{ background: 'rgba(192,132,252,.06)', borderColor: 'rgba(192,132,252,.18)' }}>
                          <span className="field-label" style={{ flex: 1 }}>🎯 {match.surprise_question}</span>
                          <span className="points-tag" style={{ background: 'rgba(192,132,252,.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,.2)' }}>+5</span>
                          <input type="text" value={form.surpriseAnswer}
                            onChange={e => setForm(match.fixture.id, { surpriseAnswer: e.target.value })}
                            className="field-input" style={{ maxWidth: 120 }} placeholder="إجابتك..." />
                        </div>
                      )}

                      {msg && (
                        <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 14, fontWeight: 700, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>
                      )}

                      <button onClick={() => submitPrediction(match)} disabled={submitting === match.fixture.id} className="save-btn">
                        {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}

                  {/* Saved prediction — closed, no result yet */}
                  {!match.is_open && !hasResult && existing && (
                    <div className="pred-box">
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>توقعك المسجّل</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#ffe3a6', fontVariantNumeric: 'tabular-nums' }}>
                        {existing.predicted_home_score} — {existing.predicted_away_score}
                      </div>
                      {existing.predicted_first_scorer && (
                        <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 6 }}>⚽ {existing.predicted_first_scorer}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════ MY PREDICTIONS TAB ════════════════ */}
        {activeTab === 'my' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>توقعاتي</h2>
              <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.22)', borderRadius: 14, padding: '7px 18px', fontSize: 18, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                🏅 {myPoints} نقطة
              </div>
            </div>
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                لم تقدم أي توقعات بعد
              </div>
            ) : predictions.map(p => {
              const hasResult = p.actual_home_score !== null;
              return (
                <div key={p.id} className="match-card" style={hasResult && p.points >= 10 ? { borderColor: 'rgba(217,178,95,.28)', background: 'linear-gradient(90deg, rgba(217,178,95,.07), rgba(255,255,255,.015))' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{p.home_team} × {p.away_team}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                        توقعك: <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.predicted_home_score} — {p.predicted_away_score}</strong>
                        {p.predicted_first_scorer && <span style={{ color: 'var(--gold)', marginRight: 10 }}>⚽ {p.predicted_first_scorer}</span>}
                      </div>
                      {hasResult && (
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          الفعلية: <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.actual_home_score} — {p.actual_away_score}</strong>
                        </div>
                      )}
                    </div>
                    <div style={{
                      minWidth: 54, textAlign: 'center', borderRadius: 14, padding: '10px 14px',
                      background: !hasResult ? 'var(--surface-3)' : p.points >= 10 ? 'rgba(217,178,95,.12)' : p.points >= 5 ? 'rgba(39,176,110,.12)' : 'var(--surface-3)',
                      color: !hasResult ? 'var(--muted)' : p.points >= 10 ? '#ffe3a6' : p.points >= 5 ? '#94f0c0' : 'var(--muted)',
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hasResult ? p.points || 0 : '⏳'}</div>
                      {hasResult && <div style={{ fontSize: 10, marginTop: 2, color: 'var(--muted)' }}>نقطة</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════ LEADERBOARD TAB ════════════════ */}
        {activeTab === 'leaders' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 22 }}>🏆 ترتيب المتسابقين</h2>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                لا توجد نتائج بعد
              </div>
            ) : leaderboard.map((player: any, i) => {
              const isMe = player.user_id === user?.id;
              const name = player.display_name || player.user_email?.split('@')[0];
              return (
                <div key={player.user_id} className={`rank-item${isMe ? ' me' : ''}`}>
                  <div className="medal-box">
                    {i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {name}
                      {isMe && <span style={{ fontSize: 11, background: 'rgba(201,58,47,.15)', color: '#ff9c91', borderRadius: 999, padding: '2px 10px', fontWeight: 700 }}>أنت</span>}
                      {player.profile_completed && <span style={{ fontSize: 13 }}>✅</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{player.count} توقع</div>
                  </div>
                  <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.totalPoints}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>نقطة</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════ HISTORY TAB ════════════════ */}
        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>📈 السجل التاريخي للترتيب</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>لقطات يومية للترتيب منذ بداية البطولة</p>

            {historyDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                لا يوجد سجل تاريخي بعد
              </div>
            ) : (
              <>
                {/* Date chips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
                  {historyDates.map(date => (
                    <button key={date} onClick={() => setActiveHistoryDate(date)}
                      className={`round-btn${activeHistoryDate === date ? ' active' : ''}`}>
                      {new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>

                {/* Rankings for selected date */}
                {historyRankings
                  .filter((r: any) => r.snapshot_date === activeHistoryDate)
                  .map((player: any, i: number) => {
                    const isMe = player.user_id === user?.id;
                    return (
                      <div key={player.user_id} className={`rank-item${isMe ? ' me' : ''}`}>
                        <div className="medal-box">
                          {i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{player.rank}</span>}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {player.user_name || '—'}
                            {isMe && <span style={{ fontSize: 11, background: 'rgba(201,58,47,.15)', color: '#ff9c91', borderRadius: 999, padding: '2px 10px', fontWeight: 700 }}>أنت</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                            {new Date(player.snapshot_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '8px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.total_points}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>نقطة</div>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        )}

        {/* ════════════════ FEED TAB ════════════════ */}
        {activeTab === 'feed' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>🌍 نشاط اللاعبين</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>آخر الأحداث في المنافسة</p>

            {socialFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                لا يوجد نشاط بعد — كن أول من يسجّل!
              </div>
            ) : socialFeed.map((item: any) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                background: 'linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01))',
                border: '1px solid var(--line)', borderRadius: 18, padding: '14px 18px', marginBottom: 10,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(217,178,95,.3), rgba(217,178,95,.1))',
                  display: 'grid', placeItems: 'center', fontSize: 18,
                }}>
                  {item.event_type === 'referral_bonus' ? '🎉' :
                   item.event_type === 'profile_completed' ? '✅' :
                   item.event_type === 'points_earned' ? '🏅' : '⚽'}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {item.user_name || 'لاعب'}
                    {item.user_id === user?.id && (
                      <span style={{ fontSize: 11, background: 'rgba(201,58,47,.15)', color: '#ff9c91', borderRadius: 999, padding: '2px 8px', fontWeight: 700, marginRight: 8 }}>أنت</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {feedEventLabel(item.event_type, item.meta)}
                  </div>
                </div>
                {/* Time */}
                <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {timeAgo(item.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
