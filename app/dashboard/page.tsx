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
  const [myTotalPoints, setMyTotalPoints] = useState(0);
  const [showReferral, setShowReferral] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [leagueJoinMsg, setLeagueJoinMsg] = useState('');
  const [socialFeed, setSocialFeed] = useState<any[]>([]);
  const [historyRankings, setHistoryRankings] = useState<any[]>([]);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [activeHistoryDate, setActiveHistoryDate] = useState('');
  const router = useRouter();

  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
    'Round of 16': 'دور الـ 16',
    'Quarter-finals': 'ربع النهائي',
    'Semi-finals': 'نصف النهائي',
    '3rd Place Final': 'مباراة الثالث',
    'Final': 'النهائي',
  };
  const rounds = [...new Set(matches.map((m: any) => m.league?.round).filter(Boolean))] as string[];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      if (typeof window !== 'undefined') {
        const msg = window.sessionStorage.getItem('leagueJoinedMsg');
        if (msg) {
          window.sessionStorage.removeItem('leagueJoinedMsg');
          setLeagueJoinMsg(msg);
          setTimeout(() => setLeagueJoinMsg(''), 5000);
        }
      }
      loadData(data.user.id);
    });
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      // SSR-safe referral processing
      const pendingRef = typeof window !== 'undefined' ? window.sessionStorage.getItem('pendingRef') : null;
      if (pendingRef) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('pendingRef');
        await supabase.rpc('process_referral', { p_referred_id: userId, p_referral_code: pendingRef });
      }

      // ✅ NEW: معالجة كود الليج — مستقل عن الـ referral
      const pendingLeague =
        (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('league') : null) ||
        (typeof window !== 'undefined' ? window.sessionStorage.getItem('pendingLeague') : null);
      if (pendingLeague) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('pendingLeague');
        try {
          const { data: lgData } = await supabase
            .from('mini_leagues')
            .select('id, name')
            .eq('code', pendingLeague.toUpperCase())
            .maybeSingle();
          if (lgData) {
            const { data: alreadyMember } = await supabase
              .from('mini_league_members')
              .select('id')
              .eq('league_id', lgData.id)
              .eq('user_id', userId)
              .maybeSingle();
            if (!alreadyMember) {
              await supabase.from('mini_league_members').insert({
                league_id: lgData.id,
                user_id: userId,
                role: 'member',
              });
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('leagueJoinedMsg', '✅ انضممت لليج "' + lgData.name + '" بنجاح! 🏆');
              }
            }
          }
        } catch (e) {
          console.error('League auto-join error:', e);
        }
      }

      // كل الـ queries بالتوازي
      const [
        profileRes,
        sessionRes,
        fixturesApiRes,
        sbFixturesRes,
        userPredsRes,
        myPointsRowRes,
        feedDataRes,
        histDataRes,
        userPointsDataRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.auth.getSession(),
        fetch('/api/fixtures').then(res => res.json()),
        supabase.from('fixtures').select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,surprise_answer,surprise_question'),
        supabase.from('predictions').select('*').eq('user_id', userId),
        supabase.from('user_points').select('referral_code,referral_count,total_points').eq('user_id', userId).maybeSingle(),
        supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('historical_rankings').select('*').order('week_start', { ascending: false }).order('total_points', { ascending: false }),
        supabase.from('user_points').select('*').order('total_points', { ascending: false }),
      ]);

      const profileData = profileRes.data;
      const sessionData = sessionRes.data;
      const apiMatches = (fixturesApiRes as any)?.response || [];
      const sbFixtures = sbFixturesRes.data;
      const userPreds = userPredsRes.data;
      const myPointsRow = myPointsRowRes.data;

// FIX: لو مفيش referral_code نولده دلوقتي
let finalReferralCode = myPointsRow?.referral_code || '';
if (!finalReferralCode && userId) {
  finalReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  // نحفظه في الداتابيز
  supabase.from('user_points').upsert({ 
    user_id: userId, 
    referral_code: finalReferralCode,
    referral_count: myPointsRow?.referral_count || 0,
    total_points: myPointsRow?.total_points || 0
  }).then(() => {});
}
      const feedData = feedDataRes.data;
      const histData = histDataRes.data;
      const userPointsData = userPointsDataRes.data;

      // ─── userNameMap: نجيب أسماء اللاعبين من user_points ───
      const userNameMap: Record<string, string> = {};
      (userPointsData || []).forEach((row: any) => {
        userNameMap[row.user_id] = row.full_name || row.user_email?.split('@')[0] || 'لاعب';
      });

      if (profileData) {
        setProfile(profileData);
        const provider = sessionData?.session?.user?.app_metadata?.provider;
        const fbName = sessionData?.session?.user?.user_metadata?.name || '';
        const fbMeta = provider === 'facebook' && fbName ? `https://facebook.com/${fbName}` : null;
        setProfileForm({
          display_name: profileData.full_name || '',
          phone: profileData.phone || '',
          facebook_url: profileData.facebook_url || fbMeta || '',
        });
      }

      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb: any = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open: sb?.is_open ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer: sb?.first_scorer ?? '',
          went_extra_time: sb?.went_extra_time ?? false,
          surprise_answer: sb?.surprise_answer ?? '',
          surprise_question: sb?.surprise_question ?? '',
        };
      });
      setMatches(merged);
      // ✅ اضبط activeRound أوتوماتيك على أول راوند موجود
      const availableRounds = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (availableRounds.length > 0) {
        setActiveRound(prev => availableRounds.includes(prev) ? prev : availableRounds[0]);
      }
      setPredictions(userPreds || []);

      // ─── FIX ١+٢: مصدر النقاط والـ referral code ───
      // لو مفيش row في user_points، نجيبه من leaderboard (userPointsData)
      if (myPointsRow) {
        setReferralCode(myPointsRow.referral_code || '');
        setReferralCount(myPointsRow.referral_count || 0);
        setMyTotalPoints(myPointsRow.total_points || 0);
      } else {
        // fallback: دور على المستخدم في الـ leaderboard data
        const myRow = (userPointsData || []).find((r: any) => r.user_id === userId);
        setReferralCode(myRow?.referral_code || '');
        setReferralCount(myRow?.referral_count || 0);
        setMyTotalPoints(myRow?.total_points || 0);
      }

      setSocialFeed((feedData || []).map((item: any) => ({
        ...item,
        user_name: userNameMap[item.user_id] || 'لاعب',
      })));

      if (histData && histData.length > 0) {
        const dates = [...new Set(histData.map((r: any) => r.week_start))] as string[];
        setHistoryDates(dates);
        setActiveHistoryDate(prev => prev || dates[0]);
        setHistoryRankings(histData.map((row: any) => ({
          ...row,
          display_name: userNameMap[row.user_id] || 'لاعب',
        })));
      } else {
        setHistoryDates([]);
        setActiveHistoryDate('');
        setHistoryRankings([]);
      }

      setLeaderboard((userPointsData || []).map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        profile_completed: row.profile_completed || false,
        totalPoints: row.total_points || 0,
        count: row.predictions_count || 0,
      })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);

    // ✅ FIX قوي: فيسبوك مطلوب عشان ياخد 5 نقاط
    if (!profileForm.display_name.trim() || !profileForm.phone.trim() || !profileForm.facebook_url.trim()) {
      setProfileMsg('❌ لازم تملى الاسم + التليفون + رابط فيسبوك عشان تاخد 5 نقاط');
      setProfileSaving(false);
      return;
    }

    const fbUrl = profileForm.facebook_url.trim();
    const fbValid = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/.+/i.test(fbUrl);
    if (!fbValid) {
      setProfileMsg('❌ رابط فيسبوك غير صحيح، يجب أن يبدأ بـ https://facebook.com/');
      setProfileSaving(false);
      return;
    }

    try {
      const hasAll = !!(profileForm.display_name.trim() && profileForm.phone.trim() && fbUrl && fbValid);
      const isCompleting = !profile?.bonus_points_awarded && hasAll;
      const updates: any = {
        full_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        facebook_url: fbUrl,
        profile_completed: true,
        bonus_points_awarded: true,
        bonus_points: 5,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert({ id: user.id, ...updates });
      if (error) throw error;

      setProfileMsg('✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉');
      await loadData(user.id);
      setTimeout(() => { setShowProfileModal(false); setProfileMsg(''); }, 2500);
    } catch {
      setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً');
    }
    setProfileSaving(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id === match.fixture.id);
    return {
      homeScore: ex?.predicted_home_score ?? 0,
      awayScore: ex?.predicted_away_score ?? 0,
      firstScorer: ex?.predicted_first_scorer ?? '',
      extraTime: ex?.predicted_extra_time ?? false,
      surpriseAnswer: ex?.surprise_answer ?? '',
    };
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
        user_id: user.id,
        user_email: user.email,
        fixture_id: match.fixture.id,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        predicted_home_score: form.homeScore,
        predicted_away_score: form.awayScore,
        predicted_first_scorer: form.firstScorer || null,
        predicted_extra_time: form.extraTime,
        surprise_answer: form.surpriseAnswer || null,
        submitted_at: new Date().toISOString(),
        //points: ex?.points ?? 0,
        //actual_home_score: null,
        //actual_away_score: null,
      };
      if (ex) await supabase.from('predictions').update(payload).eq('id', ex.id);
      else {
        await supabase.from('predictions').insert(payload);
        // ✅ سجّل في social_feed عند أول توقع
        await supabase.from('social_feed').insert({
          user_id: user.id,
          type: 'share_predictions',
          data: {
            home: match.teams.home.name,
            away: match.teams.away.name,
            fixture_id: match.fixture.id,
          },
        });
      }
      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      setPredictions(data || []);
      setMessages(m => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch {
      setMessages(m => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' }));
    }
    setSubmitting(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const feedEventLabel = (type: string, data: any) => {
    switch (type) {
      case 'invite_friend':     return '🎉 دعا صديقاً جديداً وربح نقاط!';
      case 'joined_league':     return `🏆 انضم للبطولة ${data?.league_name || ''}`;
      case 'share_league':      return '🔗 شارك رابط البطولة';
      case 'completed_profile': return '✅ أكمل بياناته الشخصية وربح 5 نقاط!';
      case 'share_predictions': return `⚽ شارك توقعاته (${data?.home || ''} × ${data?.away || ''})`;
      default:                  return '🔔 نشاط جديد';
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

  const getReferralLink = () => {
    // FIX ٢: لو referralCode فاضي، مترجعش رابط ناقص
    if (!referralCode) return '';
    if (typeof window === 'undefined') return `/login?ref=${referralCode}`;
    return `${window.location.origin}/login?ref=${referralCode}`;
  };

  const copyReferralLink = () => {
    const link = getReferralLink();
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2500);
    });
  };

  const shareOnWhatsApp = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    const txt = encodeURIComponent(`🏆 انضم لمنافسة الشمعدان × كأس العالم 2026!\nسجّل عن طريق رابطي واحصل على نقاط إضافية:\n${link}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };

  const shareOnFacebook = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank', 'width=600,height=400');
  };

  const shareOnMessenger = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    const url = encodeURIComponent(link);
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=1302682795390354&redirect_uri=${url}`, '_blank');
  };

  if (loading) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#070809', display: 'grid', placeItems: 'center', fontFamily: 'Cairo, sans-serif', color: '#f4f1e8' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 16, color: '#a8a39a' }}>جاري التحميل...</div>
      </div>
    </div>
  );

  // FIX ٦: استخدام myTotalPoints مباشرة (مش myPoints محسوب يدوي)
  const myPoints = myTotalPoints;
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
          --bg: #070809; --surface: #111315; --surface-2: #171a1d; --surface-3: #1d2125;
          --line: rgba(255,255,255,.08); --text: #f4f1e8; --muted: #a8a39a;
          --gold: #d9b25f; --gold-soft: rgba(217,178,95,.14);
          --red: #c93a2f; --green: #27b06e; --blue: #3b82f6;
          --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; background: radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%), radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%), #070809; color: var(--text); direction: rtl; min-height: 100vh; }
        .tab-btn { padding:10px 22px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; transition:all .2s; }
        .tab-btn.active { background:linear-gradient(90deg,rgba(217,178,95,.18),rgba(217,178,95,.06)); border-color:rgba(217,178,95,.3); color:#fff1ce; }
        .round-btn { padding:8px 16px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:all .2s; }
        .round-btn.active { color:#fff1ce; border-color:rgba(217,178,95,.3); background:rgba(217,178,95,.12); }
        .match-card { background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015)); border:1px solid var(--line); border-radius:24px; padding:20px; margin-bottom:14px; box-shadow:var(--shadow); }
        .pill-open { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid rgba(39,176,110,.25); background:rgba(39,176,110,.12); color:#94f0c0; }
        .pill-closed { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid var(--line); background:var(--surface-3); color:var(--muted); }
        .pill-saved { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid rgba(217,178,95,.25); background:rgba(217,178,95,.1); color:#ffe3a6; }
        .score-row { display:flex; align-items:center; gap:12px; background:var(--surface-2); border:1px solid var(--line); border-radius:18px; padding:12px 16px; margin-bottom:10px; }
        .score-btn { width:38px; height:38px; border-radius:12px; border:1px solid var(--line); background:var(--surface-3); color:var(--text); font-size:20px; font-weight:800; display:grid; place-items:center; cursor:pointer; transition:all .2s; font-family:'Cairo',sans-serif; }
        .score-btn.plus { background:linear-gradient(135deg,#e0bc73,#b9892d); border:none; color:#231a0c; }
        .score-val { font-size:22px; font-weight:800; min-width:32px; text-align:center; font-variant-numeric:tabular-nums; }
        .field-row { display:flex; align-items:center; gap:10px; background:var(--surface-2); border:1px solid var(--line); border-radius:18px; padding:12px 16px; margin-bottom:10px; }
        .field-input { flex:1; background:transparent; border:none; outline:none; color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; font-weight:600; text-align:right; }
        .field-input::placeholder { color:var(--muted); }
        .field-label { font-size:13px; color:var(--muted); font-weight:700; white-space:nowrap; }
        .points-tag { font-size:11px; padding:4px 10px; border-radius:999px; font-weight:700; white-space:nowrap; }
        .save-btn { width:100%; padding:14px; border-radius:18px; background:linear-gradient(135deg,#e0bc73,#b9892d); border:none; color:#211708; font-weight:800; font-size:15px; font-family:'Cairo',sans-serif; cursor:pointer; box-shadow:0 8px 24px rgba(217,178,95,.2); transition:opacity .2s; }
        .save-btn:hover { opacity:.88; }
        .save-btn:disabled { opacity:.5; cursor:not-allowed; }
        .pred-box { background:rgba(217,178,95,.08); border:1px solid rgba(217,178,95,.18); border-radius:18px; padding:12px 16px; }
        .stat-card { background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:18px; }
        .rank-item { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:14px; padding:14px 18px; background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01)); border:1px solid var(--line); border-radius:20px; margin-bottom:10px; transition:border-color .2s; }
        .rank-item.me { border-color:rgba(217,178,95,.28); background:linear-gradient(90deg,rgba(217,178,95,.10),rgba(255,255,255,.02)); }
        .medal-box { width:44px; height:44px; border-radius:14px; background:rgba(217,178,95,.1); display:grid; place-items:center; font-size:22px; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px); display:grid; place-items:center; z-index:1000; padding:20px; }
        .modal-box { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015)),var(--surface); border:1px solid rgba(217,178,95,.2); border-radius:28px; padding:28px; width:100%; max-width:460px; box-shadow:0 24px 64px rgba(0,0,0,.6); }
        .modal-input { width:100%; padding:13px 16px; border-radius:14px; background:var(--surface-3); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; outline:none; transition:border-color .2s; direction:rtl; }
        .modal-input:focus { border-color:rgba(217,178,95,.4); }
      `}</style>

      {/* ══ HEADER ══ */}
      <div dir="rtl" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', borderBottom: '1px solid var(--line)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>الشمعدان × كأس العالم</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>أهلاً {displayName}! 👋</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--gold-soft)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 12, padding: '6px 14px', minWidth: 60 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{myPoints}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>نقطة</span>
          </div>
          {myRank > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 12, padding: '6px 14px', minWidth: 60 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>#{myRank}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>ترتيب</span>
            </div>
          )}
          <button onClick={() => setShowProfileModal(true)} style={{ padding: '9px 16px', borderRadius: 12, cursor: 'pointer', border: profileIncomplete ? '1px solid rgba(217,178,95,.35)' : '1px solid var(--line)', background: profileIncomplete ? 'rgba(217,178,95,.08)' : 'var(--surface-2)', color: profileIncomplete ? '#f2d79e' : 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
            {profileIncomplete ? '🎁 أكمل ملفك +5 نقاط' : `✏️ ${displayName}`}
          </button>
          <a href="/my-leagues" style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(217,178,95,.25)', background: 'rgba(217,178,95,.06)', color: '#f2d79e', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>🏆 ليجاتي</a>
          <button onClick={() => setShowReferral(true)} style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)', background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🎁 ادعُ صديق
            {referralCount > 0 && <span style={{ background: 'rgba(39,176,110,.2)', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>{referralCount}</span>}
          </button>
          <button onClick={handleLogout} style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(201,58,47,.25)', background: 'rgba(201,58,47,.06)', color: '#ff9c91', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>خروج</button>
        </div>
      </div>

      {/* ── INCOMPLETE BANNER ── */}
      {profileIncomplete && (
        <div onClick={() => setShowProfileModal(true)} style={{ background: 'linear-gradient(90deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', borderBottom: '1px solid rgba(217,178,95,.18)', padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#f2d79e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً! &nbsp;<strong>اضغط هنا</strong>
        </div>
      )}

      {leagueJoinMsg && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 20px 0' }}>
          <div style={{ padding: '14px 20px', borderRadius: 16, background: 'rgba(39,176,110,.12)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span>{leagueJoinMsg}</span>
            <a href="/my-leagues" style={{ color: '#ffe3a6', textDecoration: 'underline', fontWeight: 800, flexShrink: 0 }}>اضغط هنا لرؤية الليج ←</a>
          </div>
        </div>
      )}

      {/* ══ PROFILE MODAL ══ */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f2d79e', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6 }}>
                🎁 أكمل <strong>الاسم + التليفون + فيسبوك</strong> واحصل على 5 نقاط!
                <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12 }}>
                  <span>{profileForm.display_name.trim() ? '✅' : '○'} الاسم</span>
                  <span>{profileForm.phone.trim() ? '✅' : '○'} التليفون</span>
                  <span>{profileForm.facebook_url.trim() ? '✅' : '○'} فيسبوك</span>
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>الاسم الكامل &nbsp;<span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="text" value={profileForm.display_name} onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))} placeholder="اسمك كما تريد أن يظهر في الصدارة" className="modal-input" style={{ marginBottom: 14 }} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>رقم التليفون &nbsp;<span style={{ color: 'var(--muted)', fontWeight: 400 }}>(مطلوب للنقاط)</span></label>
            <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" className="modal-input" style={{ marginBottom: 14, direction: 'ltr', textAlign: 'right' }} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>
              رابط فيسبوك &nbsp;
              {profile?.facebook_bonus_awarded
                ? <span style={{ color: '#94f0c0', fontSize: 11 }}>✅ مضاف</span>
                : <span style={{ color: 'var(--gold)', fontSize: 11 }}>+5 نقاط عند إكمال الثلاثة</span>}
            </label>
            {/* FIX ٤: إزالة readOnly — الحقل قابل للتعديل دائماً */}
            <input
              type="url"
              value={profileForm.facebook_url}
              onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))}
              placeholder="https://facebook.com/username"
              className="modal-input"
              style={{ marginBottom: 20, direction: 'ltr', textAlign: 'right' }}
            />
            {profileMsg && <div style={{ padding: '12px 16px', borderRadius: 12, background: profileMsg.startsWith('✅') ? 'rgba(39,176,110,.12)' : 'rgba(201,58,47,.12)', border: `1px solid ${profileMsg.startsWith('✅') ? 'rgba(39,176,110,.25)' : 'rgba(201,58,47,.25)'}`, color: profileMsg.startsWith('✅') ? '#94f0c0' : '#ff9c91', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{profileMsg}</div>}
            <button onClick={saveProfile} disabled={profileSaving} className="save-btn">{profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}</button>
          </div>
        </div>
      )}

      {/* ══ REFERRAL MODAL ══ */}
      {showReferral && (
        <div className="modal-overlay" onClick={() => setShowReferral(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>🎁 ادعُ أصدقاءك</h3>
              <button onClick={() => setShowReferral(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)' }}>{referralCount}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>أصدقاء انضموا</div>
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#94f0c0' }}>{referralCount * 5}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>نقاط من الدعوات</div>
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 16, fontSize: 13, color: 'var(--muted)', fontFamily: 'Cairo, sans-serif', lineHeight: 2 }}>
              <strong style={{ color: 'var(--gold)' }}>⚡ كيف يعمل؟</strong><br />
              ١. شارك رابطك مع أصدقاءك<br />
              ٢. لما يسجلوا عن طريق رابطك → <span style={{ color: '#94f0c0', fontWeight: 700 }}>+5 نقاط لك</span><br />
              ٣. مفيش حد أقصى للدعوات 🚀
            </div>
            {/* FIX ٢: إظهار رسالة لو الكود مش موجود بعد */}
            {referralCode ? (
              <>
                <div style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', wordBreak: 'break-all', marginBottom: 12, direction: 'ltr', textAlign: 'left' }}>
                  {typeof window !== 'undefined' ? getReferralLink() : '...'}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={copyReferralLink} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: referralCopied ? 'rgba(39,176,110,.15)' : 'var(--surface-2)', color: referralCopied ? '#94f0c0' : 'var(--text)', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700 }}>{referralCopied ? '✅ تم النسخ' : '📋 نسخ'}</button>
                  <button onClick={shareOnWhatsApp} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(39,176,110,.25)', background: 'rgba(39,176,110,.1)', color: '#94f0c0', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700 }}>💬 واتساب</button>
                  <button onClick={shareOnFacebook} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(59,130,246,.25)', background: 'rgba(59,130,246,.1)', color: '#93c5fd', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700 }}>📘 فيسبوك</button>
                  <button onClick={shareOnMessenger} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(99,102,241,.25)', background: 'rgba(99,102,241,.1)', color: '#c4b5fd', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700 }}>⚡ ماسنجر</button>
                </div>
              </>
            ) : (
              <div style={{ background: 'rgba(217,178,95,.06)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#f2d79e', fontFamily: 'Cairo, sans-serif' }}>
                ⏳ جاري تحميل رابط الدعوة... حاول مجدداً بعد لحظة
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MAIN ══ */}
      <div dir="rtl" style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'نقاطي', value: myPoints, color: 'var(--gold)', icon: '🏅' },
            { label: 'ترتيبي', value: myRank > 0 ? `#${myRank}` : '—', color: 'var(--text)', icon: '📊' },
            { label: 'توقعاتي', value: predictions.length, color: '#8ae0b3', icon: '⚽' },
            { label: 'المتسابقون', value: leaderboard.length, color: '#7db1ff', icon: '👥' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
          {([
            { id: 'predict', label: '⚽ التوقعات' },
            { id: 'my', label: '📋 توقعاتي' },
            { id: 'leaders', label: '🏆 الصدارة' },
            { id: 'history', label: '📈 السجل التاريخي' },
            { id: 'feed', label: '🌍 نشاط اللاعبين' },
          ] as const).map(({ id, label }) => (
            <button key={id} className={`tab-btn${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </div>

        {/* ════ PREDICT TAB ════ */}
        {activeTab === 'predict' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r]} ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
            </div>
            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div>لا توجد ماتشات في هذه الجولة</div>
              </div>
            ) : filteredMatches.map(match => {
              const existing = predictions.find(p => p.fixture_id === match.fixture.id);
              const form = getForm(match);
              const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const msg = messages[match.fixture.id];
              return (
                <div key={match.fixture.id} className="match-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{match.teams.home.name} &nbsp;×&nbsp; {match.teams.away.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={match.is_open ? 'pill-open' : 'pill-closed'}>{match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}</span>
                      {existing && <span className="pill-saved">✅ محفوظ</span>}
                    </div>
                  </div>
                  {/* Teams */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      {match.teams.home.logo ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={48} height={48} style={{ margin: '0 auto 6px', objectFit: 'contain' }} /> : <span style={{ fontSize: 32 }}>⚽</span>}
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{match.teams.home.name}</div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, color: hasResult ? 'var(--gold)' : 'var(--muted)' }}>{hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}</div>
                    <div style={{ textAlign: 'center' }}>
                      {match.teams.away.logo ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={48} height={48} style={{ margin: '0 auto 6px', objectFit: 'contain' }} /> : <span style={{ fontSize: 32 }}>⚽</span>}
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{match.teams.away.name}</div>
                    </div>
                  </div>
                  {/* Actual result */}
                  {hasResult && (
                    <div style={{ background: 'rgba(39,176,110,.08)', border: '1px solid rgba(39,176,110,.16)', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#94f0c0', marginBottom: 6 }}>النتيجة الفعلية</div>
                      {match.first_scorer && <div style={{ fontSize: 12, color: 'var(--muted)' }}>⚽ أول هدف: {match.first_scorer}</div>}
                      {existing && (
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: (existing.points || 0) >= 10 ? '#ffe3a6' : (existing.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {existing.points || 0}&nbsp; نقطة
                        </div>
                      )}
                    </div>
                  )}
                  {/* Prediction form */}
                  {match.is_open && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>توقّع النتيجة</div>
                      {[{ key: 'homeScore', team: match.teams.home.name }, { key: 'awayScore', team: match.teams.away.name }].map(({ key, team }) => (
                        <div key={key} className="score-row">
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{team}</span>
                          <button className="score-btn" onClick={() => setForm(match.fixture.id, { [key]: Math.max(0, (form[key] || 0) - 1) })}>−</button>
                          <span className="score-val">{form[key] || 0}</span>
                          <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { [key]: (form[key] || 0) + 1 })}>+</button>
                        </div>
                      ))}
                      <div className="field-row">
                        <span className="field-label">⚽ أول هدف</span>
                        <span className="points-tag" style={{ background: 'rgba(217,178,95,.1)', color: 'var(--gold)' }}>+3</span>
                        <input type="text" value={form.firstScorer} onChange={e => setForm(match.fixture.id, { firstScorer: e.target.value })} className="field-input" placeholder="مثال: مبابي" />
                      </div>
                      <div className="field-row">
                        <input type="checkbox" checked={form.extraTime} onChange={e => setForm(match.fixture.id, { extraTime: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--gold)', flexShrink: 0 }} />
                        <span className="field-label">⏱️ وقت إضافي؟</span>
                        <span className="points-tag" style={{ background: 'rgba(59,130,246,.1)', color: '#93c5fd' }}>+2</span>
                      </div>
                      {match.surprise_question && (
                        <div className="field-row">
                          <span className="field-label">🎯 {match.surprise_question}</span>
                          <span className="points-tag" style={{ background: 'rgba(99,102,241,.1)', color: '#c4b5fd' }}>+5</span>
                          <input type="text" value={form.surpriseAnswer} onChange={e => setForm(match.fixture.id, { surpriseAnswer: e.target.value })} className="field-input" style={{ maxWidth: 120 }} placeholder="إجابتك..." />
                        </div>
                      )}
                      {msg && <div style={{ padding: '10px', borderRadius: 12, background: msg.startsWith('✅') ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', color: msg.startsWith('✅') ? '#94f0c0' : '#ff9c91', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{msg}</div>}
                      <button onClick={() => submitPrediction(match)} disabled={submitting === match.fixture.id} className="save-btn">
                        {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}
                  {!match.is_open && !hasResult && existing && (
                    <div className="pred-box">
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>توقعك المسجّل</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{existing.predicted_home_score} — {existing.predicted_away_score}</div>
                      {existing.predicted_first_scorer && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>⚽ {existing.predicted_first_scorer}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ MY PREDICTIONS TAB ════ */}
        {activeTab === 'my' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18 }}>توقعاتي</h2>
              {/* FIX ٦: عرض النقاط من myTotalPoints مباشرة */}
              <div style={{ background: 'var(--gold-soft)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 12, padding: '8px 16px', fontSize: 15, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>🏅 {myPoints} نقطة</div>
            </div>
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>لم تقدم أي توقعات بعد</div>
              </div>
            ) : predictions.map(p => {
              const hasResult = p.actual_home_score !== null;
              return (
                <div key={p.id} className="match-card" style={p.points >= 10 ? { borderColor: 'rgba(217,178,95,.28)', background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{p.home_team} × {p.away_team}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        توقعك: <strong style={{ color: 'var(--text)' }}>{p.predicted_home_score} — {p.predicted_away_score}</strong>
                        {p.predicted_first_scorer && <span style={{ marginRight: 10 }}>⚽ {p.predicted_first_scorer}</span>}
                      </div>
                      {hasResult && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>الفعلية: <strong style={{ color: 'var(--text)' }}>{p.actual_home_score} — {p.actual_away_score}</strong></div>}
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 56, background: !hasResult ? 'var(--surface-3)' : (p.points || 0) >= 10 ? 'rgba(217,178,95,.12)' : (p.points || 0) >= 5 ? 'rgba(39,176,110,.12)' : 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, padding: '8px', color: !hasResult ? 'var(--muted)' : (p.points || 0) >= 10 ? '#ffe3a6' : (p.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{hasResult ? (p.points || 0) : '⏳'}</div>
                      {hasResult && <div style={{ fontSize: 10, fontWeight: 700 }}>نقطة</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ LEADERBOARD TAB ════ */}
        {activeTab === 'leaders' && (
          <div>
            <h2 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 20 }}>🏆 ترتيب المتسابقين</h2>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                <div>لا توجد نتائج بعد</div>
              </div>
            ) : leaderboard.map((player: any, i) => {
              const isMe = player.user_id === user?.id;
              const name = player.display_name || player.user_email?.split('@')[0];
              return (
                <div key={player.user_id} className={`rank-item${isMe ? ' me' : ''}`}>
                  <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontWeight: 800, fontSize: 14 }}>#{i + 1}</span>}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name} {isMe && <span style={{ background: 'rgba(217,178,95,.15)', color: 'var(--gold)', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>أنت</span>} {player.profile_completed && <span style={{ fontSize: 12 }}>✅</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{player.count} توقع</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.totalPoints}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ HISTORY TAB ════ */}
        {activeTab === 'history' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>📈 السجل التاريخي للترتيب</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>لقطات يومية للترتيب منذ بداية البطولة</p>
            </div>
            {historyDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div>لا يوجد سجل تاريخي بعد</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {historyDates.map(date => (
                    <button key={date} onClick={() => setActiveHistoryDate(date)} className={`round-btn${activeHistoryDate === date ? ' active' : ''}`}>
                      {new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>
                {historyRankings.filter((r: any) => r.week_start === activeHistoryDate).map((player: any, i: number) => {
                  const isMe = player.user_id === user?.id;
                  return (
                    <div key={player.user_id + player.week_start} className={`rank-item${isMe ? ' me' : ''}`}>
                      <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontWeight: 800, fontSize: 14 }}>#{i + 1}</span>}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{player.display_name || '—'} {isMe && <span style={{ background: 'rgba(217,178,95,.15)', color: 'var(--gold)', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>أنت</span>}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(player.week_start).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.total_points}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ════ FEED TAB ════ */}
        {activeTab === 'feed' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>🌍 نشاط اللاعبين</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>آخر الأحداث في المنافسة</p>
            </div>
            {socialFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div>لا يوجد نشاط بعد — كن أول من يسجّل!</div>
              </div>
            ) : socialFeed.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,.025)', border: '1px solid var(--line)', borderRadius: 18, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(217,178,95,.1)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>
                  {item.type === 'invite_friend' ? '🎉' : item.type === 'completed_profile' ? '✅' : item.type === 'joined_league' ? '🏆' : item.type === 'share_league' ? '🔗' : '⚽'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Cairo, sans-serif' }}>
                    {item.user_name || 'لاعب'} {item.user_id === user?.id && <span style={{ background: 'rgba(217,178,95,.15)', color: 'var(--gold)', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>أنت</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{feedEventLabel(item.type, item.data)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{timeAgo(item.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
