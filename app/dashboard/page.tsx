'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

// ✅ PlayerSelect — dropdown لاعبين من fixture_players أو input عادي لو مافيش
function PlayerSelect({ fixtureId, value, onChange }: {
  fixtureId: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const [players, setPlayers] = useState<{ player_name: string; team_name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    supabase
      .from('fixture_players')
      .select('player_name, team_name')
      .eq('api_fixture_id', fixtureId)
      .then(({ data }) => {
        if (data && data.length > 0) setPlayers(data);
        setLoaded(true);
      });
  }, [fixtureId, loaded]);

  if (players.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="field-input"
        placeholder={loaded ? 'اكتب اسم الهداف...' : '⏳ جاري التحميل...'}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        flex: 1,
        background: 'var(--surface-3)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        color: value ? 'var(--text)' : 'var(--muted)',
        fontFamily: 'Cairo, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        padding: '8px 12px',
        outline: 'none',
        cursor: 'pointer',
        direction: 'rtl',
      }}
    >
      <option value="">اختر الهداف...</option>
      {players.map(p => (
        <option key={`${p.team_name}-${p.player_name}`} value={p.player_name}>
          {p.player_name} ({p.team_name})
        </option>
      ))}
    </select>
  );
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
  const [pointsBreakdown, setPointsBreakdown] = useState<any[]>([]);
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueJoining, setLeagueJoining] = useState(false);
  const [leagueQuickMsg, setLeagueQuickMsg] = useState('');
  const [upcomingAlert, setUpcomingAlert] = useState<any>(null);

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
      const pendingRef = typeof window !== 'undefined' ? window.sessionStorage.getItem('pendingRef') : null;
      if (pendingRef) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('pendingRef');
        const { error: refErr } = await supabase.rpc('process_referral', {
          p_referred_id: userId,
          p_referral_code: pendingRef,
        });
        if (!refErr) {
          await supabase.from('social_feed').insert({
            user_id: userId,
            type: 'invite_friend',
            data: { referral_code: pendingRef },
          });
        }
      }

      const pendingLeague =
        (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('league') : null) ||
        (typeof window !== 'undefined' ? window.sessionStorage.getItem('pendingLeague') : null);
      if (pendingLeague) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('pendingLeague');
        try {
          const { data: lgData } = await supabase
            .from('mini_leagues').select('id, name')
            .eq('code', pendingLeague.toUpperCase()).maybeSingle();
          if (lgData) {
            const { data: alreadyMember } = await supabase
              .from('mini_league_members').select('id')
              .eq('league_id', lgData.id).eq('user_id', userId).maybeSingle();
            if (!alreadyMember) {
              await supabase.from('mini_league_members').insert({ league_id: lgData.id, user_id: userId, role: 'member' });
              await supabase.from('social_feed').insert({
                user_id: userId,
                type: 'joined_league',
                data: { league_name: lgData.name, league_id: lgData.id },
              });
              if (typeof window !== 'undefined')
                window.sessionStorage.setItem('leagueJoinedMsg', `✅ انضممت لليج "${lgData.name}" بنجاح! 🏆`);
            }
          }
        } catch (e) { console.error('League auto-join error:', e); }
      }

      const [
        profileRes, sessionRes, fixturesApiRes, sbFixturesRes,
        userPredsRes, myPointsRowRes, feedDataRes, histDataRes, userPointsDataRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.auth.getSession(),
        fetch('/api/fixtures').then(res => res.json()),
        // ✅ تعديل 1: أضفنا الـ 3 حقول الجديدة + حذفنا surprise_*
        supabase.from('fixtures').select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,red_card_in_match,penalty_in_match,both_teams_scored'),
        supabase.from('predictions').select('*').eq('user_id', userId),
        supabase.from('user_points').select('referral_count,total_points').eq('user_id', userId).maybeSingle(),
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
      const finalReferralCode = profileData?.referral_code || '';
      const feedData = feedDataRes.data;
      const histData = histDataRes.data;
      const userPointsData = userPointsDataRes.data;

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

      // ✅ تعديل 2: merged مع الـ 3 حقول الجديدة
      const merged = apiMatches.map((m: any) => {
        const sb: any = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open:            sb?.is_open ?? false,
          actual_home_score:  sb?.actual_home_score ?? null,
          actual_away_score:  sb?.actual_away_score ?? null,
          first_scorer:       sb?.first_scorer ?? '',
          went_extra_time:    sb?.went_extra_time ?? false,
          red_card_in_match:  sb?.red_card_in_match ?? false,
          penalty_in_match:   sb?.penalty_in_match ?? false,
          both_teams_scored:  sb?.both_teams_scored ?? false,
        };
      });

      setMatches(merged);
      const availableRounds = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (availableRounds.length > 0) setActiveRound(prev => availableRounds.includes(prev) ? prev : availableRounds[0]);

      const openUnpredicted = merged.find((m: any) => {
        const hasResult = m.actual_home_score !== null;
        const predicted = (userPreds || []).find((p: any) => p.fixture_id === m.fixture.id);
        return m.is_open && !hasResult && !predicted;
      });
      setUpcomingAlert(openUnpredicted || null);

      setPredictions(userPreds || []);

      if (myPointsRow) {
        setReferralCode(finalReferralCode);
        setReferralCount(myPointsRow.referral_count || 0);
        setMyTotalPoints(myPointsRow.total_points || 0);
      } else {
        const myRow = (userPointsData || []).find((r: any) => r.user_id === userId);
        setReferralCode(finalReferralCode);
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

      const breakdown = (userPreds || [])
        .filter((p: any) => p.actual_home_score !== null && p.points > 0)
        .sort((a: any, b: any) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
      setPointsBreakdown(breakdown);

    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const quickJoinLeague = async () => {
    if (!user || !leagueCode.trim()) return;
    setLeagueJoining(true);
    setLeagueQuickMsg('');
    try {
      const { data: lgData } = await supabase
        .from('mini_leagues').select('id, name')
        .eq('code', leagueCode.trim().toUpperCase()).maybeSingle();
      if (!lgData) { setLeagueQuickMsg('❌ كود غير صحيح'); setLeagueJoining(false); return; }
      const { data: already } = await supabase
        .from('mini_league_members').select('id')
        .eq('league_id', lgData.id).eq('user_id', user.id).maybeSingle();
      if (already) { setLeagueQuickMsg(`✅ أنت بالفعل عضو في "${lgData.name}"`); setLeagueJoining(false); return; }
      await supabase.from('mini_league_members').insert({ league_id: lgData.id, user_id: user.id, role: 'member' });
      await supabase.from('social_feed').insert({
        user_id: user.id, type: 'joined_league',
        data: { league_name: lgData.name, league_id: lgData.id },
      });
      setLeagueQuickMsg(`🎉 انضممت لـ "${lgData.name}" بنجاح!`);
      setLeagueCode('');
    } catch { setLeagueQuickMsg('❌ حدث خطأ، حاول مجدداً'); }
    setLeagueJoining(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    if (!profileForm.display_name.trim() || !profileForm.phone.trim() || !profileForm.facebook_url.trim()) {
      setProfileMsg('❌ لازم تملى الاسم + التليفون + رابط فيسبوك عشان تاخد 5 نقاط');
      setProfileSaving(false); return;
    }
    const fbUrl = profileForm.facebook_url.trim();
    const fbValid = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/.+/i.test(fbUrl);
    if (!fbValid) {
      setProfileMsg('❌ رابط فيسبوك غير صحيح، يجب أن يبدأ بـ https://facebook.com/');
      setProfileSaving(false); return;
    }
    try {
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
      if (!profile?.bonus_points_awarded) {
        await supabase.from('social_feed').insert({
          user_id: user.id, type: 'completed_profile',
          data: { display_name: profileForm.display_name.trim() },
        });
      }
      setProfileMsg('✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉');
      await loadData(user.id);
      setTimeout(() => { setShowProfileModal(false); setProfileMsg(''); }, 2500);
    } catch { setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً'); }
    setProfileSaving(false);
  };

  // ✅ تعديل 3: getForm — استبدل surpriseAnswer بالـ 3 الجديدة
  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id === match.fixture.id);
    return {
      homeScore:            ex?.predicted_home_score ?? 0,
      awayScore:            ex?.predicted_away_score ?? 0,
      firstScorer:          ex?.predicted_first_scorer ?? '',
      extraTime:            ex?.predicted_extra_time ?? false,
      predicted_red_card:   ex?.predicted_red_card ?? false,
      predicted_penalty:    ex?.predicted_penalty ?? false,
      predicted_both_teams: ex?.predicted_both_teams ?? false,
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
      // ✅ تعديل 4: payload — استبدل surprise_answer بالـ 3 الجديدة
      const payload = {
        user_id: user.id,
        user_email: user.email,
        fixture_id: match.fixture.id,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        predicted_home_score:  form.homeScore,
        predicted_away_score:  form.awayScore,
        predicted_first_scorer: form.firstScorer || null,
        predicted_extra_time:  form.extraTime,
        predicted_red_card:    form.predicted_red_card ?? false,
        predicted_penalty:     form.predicted_penalty ?? false,
        predicted_both_teams:  form.predicted_both_teams ?? false,
        submitted_at: new Date().toISOString(),
      };
      if (ex) {
        await supabase.from('predictions').update(payload).eq('id', ex.id);
      } else {
        await supabase.from('predictions').insert(payload);
        await supabase.from('social_feed').insert({
          user_id: user.id, type: 'share_predictions',
          data: { home: match.teams.home.name, away: match.teams.away.name, fixture_id: match.fixture.id },
        });
      }
      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      setPredictions(data || []);
      setMessages(m => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch { setMessages(m => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' })); }
    setSubmitting(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const feedEventLabel = (type: string, data: any) => {
    switch (type) {
      case 'invite_friend':    return '🎉 دعا صديقاً جديداً وربح نقاط!';
      case 'joined_league':    return `🏆 انضم للبطولة ${data?.league_name || ''}`;
      case 'share_league':     return '🔗 شارك رابط البطولة';
      case 'completed_profile': return '✅ أكمل بياناته الشخصية وربح 5 نقاط!';
      case 'share_predictions': return `⚽ شارك توقعاته (${data?.home || ''} × ${data?.away || ''})`;
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

  const getReferralLink = () => {
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
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#070809', color: '#d9b25f', fontFamily: "'Cairo',sans-serif", gap: 16, fontSize: 18 }}>
      <div style={{ fontSize: 40 }}>🏆</div>
      <div>جاري التحميل...</div>
    </div>
  );

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
        body {
          font-family: 'Cairo', sans-serif;
          background: radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%),
                      radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%), #070809;
          color: var(--text); direction: rtl; min-height: 100vh;
        }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
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
        .quick-input { flex:1; padding:12px 16px; border-radius:14px; background:var(--surface-2); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; outline:none; transition:border-color .2s; direction:ltr; text-align:center; letter-spacing:.1em; }
        .quick-input:focus { border-color:rgba(217,178,95,.4); }
        .alert-banner { animation: slideDown .4s cubic-bezier(0.16,1,0.3,1); }
        .pulse { animation: pulse 2s ease-in-out infinite; }
      `}</style>

      {/* ══ HEADER ══ */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 26 }}>🏆</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>الشمعدان × كأس العالم</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>أهلاً {displayName}! 👋</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginRight: 'auto' }}>
          <span style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', color: 'var(--gold)', fontSize: 13, fontWeight: 800 }}>🏅 {myPoints} <span style={{ fontWeight: 400, fontSize: 11 }}>نقطة</span></span>
          {myRank > 0 && (<span style={{ padding: '6px 14px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 800 }}>#{myRank} <span style={{ fontWeight: 400, fontSize: 11 }}>ترتيب</span></span>)}
        </div>
        <button onClick={() => setShowProfileModal(true)} style={{ padding: '9px 16px', borderRadius: 12, cursor: 'pointer', border: profileIncomplete ? '1px solid rgba(217,178,95,.35)' : '1px solid var(--line)', background: profileIncomplete ? 'rgba(217,178,95,.08)' : 'var(--surface-2)', color: profileIncomplete ? '#f2d79e' : 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
          {profileIncomplete ? '🎁 أكمل ملفك +5 نقاط' : `✏️ ${displayName}`}
        </button>
        <Link href="/my-leagues" style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>🏆 ليجاتي</Link>
        <button onClick={() => setShowReferral(true)} style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)', background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          🎁 ادعُ صديق {referralCount > 0 && <span style={{ background: 'rgba(39,176,110,.2)', borderRadius: 999, padding: '1px 8px', fontSize: 11 }}>{referralCount}</span>}
        </button>
        <button onClick={handleLogout} style={{ padding: '9px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>خروج</button>
      </div>

      {profileIncomplete && (
        <div onClick={() => setShowProfileModal(true)} style={{ background: 'linear-gradient(90deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', borderBottom: '1px solid rgba(217,178,95,.18)', padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#f2d79e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً! <strong>اضغط هنا</strong>
        </div>
      )}

      {leagueJoinMsg && (
        <div className="alert-banner" style={{ background: 'rgba(39,176,110,.1)', borderBottom: '1px solid rgba(39,176,110,.2)', padding: '10px 20px', textAlign: 'center', fontSize: 13, color: '#5effa8', fontFamily: 'Cairo,sans-serif' }}>
          {leagueJoinMsg} <Link href="/my-leagues" style={{ color: '#5effa8', fontWeight: 700 }}>اضغط هنا لرؤية الليج ←</Link>
        </div>
      )}

      {upcomingAlert && (
        <div className="alert-banner" style={{ background: 'rgba(59,130,246,.08)', borderBottom: '1px solid rgba(59,130,246,.2)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'Cairo,sans-serif', fontSize: 13 }}>
          <span className="pulse">⚡</span>
          <span>ماتش لم تتوقع عليه بعد: <strong>{upcomingAlert.teams.home.name} × {upcomingAlert.teams.away.name}</strong></span>
          <button onClick={() => { setActiveTab('predict'); setActiveRound(upcomingAlert.league.round); setUpcomingAlert(null); }} style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,.2)', border: '1px solid rgba(59,130,246,.3)', color: '#93c5fd', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>توقع الآن</button>
        </div>
      )}

      {/* ══ PROFILE MODAL ══ */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#f2d79e', lineHeight: 1.8 }}>
                🎁 أكمل <strong>الاسم + التليفون + فيسبوك</strong> واحصل على 5 نقاط!
                <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12 }}>
                  <span>{profileForm.display_name.trim() ? '✅' : '○'} الاسم</span>
                  <span>{profileForm.phone.trim() ? '✅' : '○'} التليفون</span>
                  <span>{profileForm.facebook_url.trim() ? '✅' : '○'} فيسبوك</span>
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>الاسم الكامل <span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="text" value={profileForm.display_name} onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))} placeholder="اسمك كما تريد أن يظهر في الصدارة" className="modal-input" style={{ marginBottom: 14 }} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>رقم التليفون <span style={{ fontSize: 11, color: 'var(--muted)' }}>(مطلوب للنقاط)</span></label>
            <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" className="modal-input" style={{ marginBottom: 14, direction: 'ltr', textAlign: 'right' }} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
              رابط فيسبوك {profile?.facebook_bonus_awarded ? <span style={{ color: 'var(--green)', fontSize: 11 }}>✅ مضاف</span> : <span style={{ color: 'var(--gold)', fontSize: 11 }}>+5 نقاط عند إكمال الثلاثة</span>}
            </label>
            <input type="url" value={profileForm.facebook_url} onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/username" className="modal-input" style={{ marginBottom: 20, direction: 'ltr', textAlign: 'right' }} />
            {profileMsg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: profileMsg.includes('✅') ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', color: profileMsg.includes('✅') ? '#94f0c0' : '#ff9c91', fontSize: 13, fontWeight: 700 }}>{profileMsg}</div>}
            <button onClick={saveProfile} disabled={profileSaving} className="save-btn">{profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}</button>
          </div>
        </div>
      )}

      {/* ══ REFERRAL MODAL ══ */}
      {showReferral && (
        <div className="modal-overlay" onClick={() => setShowReferral(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>🎁 ادعُ أصدقاءك</h3>
              <button onClick={() => setShowReferral(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[{ label: 'أصدقاء انضموا', value: referralCount, color: 'var(--green)' }, { label: 'نقاط من الدعوات', value: referralCount * 5, color: 'var(--gold)' }].map(s => (
                <div key={s.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 13, lineHeight: 2 }}>
              <strong>⚡ كيف يعمل؟</strong><br />
              ١. شارك رابطك مع أصدقاءك<br />
              ٢. لما يسجلوا عن طريق رابطك → <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+5 نقاط لك</span><br />
              ٣. مفيش حد أقصى للدعوات 🚀
            </div>
            {referralCode ? (
              <>
                <div style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all', direction: 'ltr', textAlign: 'left' }}>
                  {typeof window !== 'undefined' ? getReferralLink() : '...'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: referralCopied ? '✅ تم النسخ' : '📋 نسخ', fn: copyReferralLink, bg: 'rgba(255,255,255,.04)' },
                    { label: '💬 واتساب', fn: shareOnWhatsApp, bg: 'rgba(37,211,102,.1)' },
                    { label: '📘 فيسبوك', fn: shareOnFacebook, bg: 'rgba(24,119,242,.1)' },
                    { label: '⚡ ماسنجر', fn: shareOnMessenger, bg: 'rgba(0,132,255,.1)' },
                  ].map(b => (
                    <button key={b.label} onClick={b.fn} style={{ padding: '11px', borderRadius: 14, border: '1px solid var(--line)', background: b.bg, color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>{b.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 16 }}>⏳ جاري تحميل رابط الدعوة... حاول مجدداً بعد لحظة</div>
            )}
          </div>
        </div>
      )}

      {/* ══ MAIN ══ */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'نقاطي', value: myPoints, color: 'var(--gold)', icon: '🏅' },
            { label: 'ترتيبي', value: myRank > 0 ? `#${myRank}` : '—', color: 'var(--text)', icon: '📊' },
            { label: 'توقعاتي', value: predictions.length, color: '#8ae0b3', icon: '⚽' },
            { label: 'المتسابقون', value: leaderboard.length, color: '#7db1ff', icon: '👥' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Join League */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>🏆 انضم لليج بكود سريع</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" value={leagueCode} onChange={e => setLeagueCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && quickJoinLeague()} placeholder="أدخل كود الليج..." className="quick-input" maxLength={8} />
            <button onClick={quickJoinLeague} disabled={leagueJoining} style={{ padding: '12px 18px', borderRadius: 14, background: 'linear-gradient(135deg,var(--gold),#a8761a)', border: 'none', color: '#211708', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Cairo,sans-serif' }}>
              {leagueJoining ? '⏳' : 'انضم'}
            </button>
            <Link href="/my-leagues" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>عرض ليجاتي</Link>
          </div>
          {leagueQuickMsg && <div style={{ marginTop: 8, fontSize: 13, color: leagueQuickMsg.includes('❌') ? '#ff9c91' : '#94f0c0', fontWeight: 700 }}>{leagueQuickMsg}</div>}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r] || r} ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
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
                  {/* Match header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{match.teams.home.name} × {match.teams.away.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={match.is_open ? 'pill-open' : 'pill-closed'}>{match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}</span>
                      {existing && <span className="pill-saved">✅ محفوظ</span>}
                    </div>
                  </div>

                  {/* Teams visual */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, background: 'var(--surface-2)', borderRadius: 18, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {match.teams.home.logo ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={32} height={32} style={{ borderRadius: 6 }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-3)', display: 'grid', placeItems: 'center' }}>⚽</div>}
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{match.teams.home.name}</span>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 16, color: hasResult ? 'var(--gold)' : 'var(--muted)' }}>
                      {hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{match.teams.away.name}</span>
                      {match.teams.away.logo ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={32} height={32} style={{ borderRadius: 6 }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-3)', display: 'grid', placeItems: 'center' }}>⚽</div>}
                    </div>
                  </div>

                  {/* Actual result */}
                  {hasResult && (
                    <div className="pred-box" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>النتيجة الفعلية</div>
                      {match.first_scorer && <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>⚽ أول هدف: {match.first_scorer}</div>}
                      {existing && (
                        <div style={{ fontSize: 14, fontWeight: 800, color: (existing.points || 0) >= 10 ? '#ffe3a6' : (existing.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          نقاطك: <strong>{existing.points || 0}</strong> نقطة
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ تعديل 5: Prediction form */}
                  {match.is_open && (
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 10 }}>توقّع النتيجة</div>

                      {/* Score inputs — الفريقان جنب بعض */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8, background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:18, padding:'12px 14px', marginBottom:10 }}>
                        {/* الفريق الأول */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:700, textAlign:'center' }}>{match.teams.home.name}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <button className="score-btn" onClick={() => setForm(match.fixture.id, { homeScore: Math.max(0,(form.homeScore||0)-1) })}>−</button>
                            <span className="score-val">{form.homeScore || 0}</span>
                            <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { homeScore:(form.homeScore||0)+1 })}>+</button>
                          </div>
                        </div>
                        {/* فاصل VS */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>VS</span>
                          <span style={{ fontSize:22, fontWeight:900, color:'var(--gold)' }}>—</span>
                        </div>
                        {/* الفريق الثاني */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:700, textAlign:'center' }}>{match.teams.away.name}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <button className="score-btn" onClick={() => setForm(match.fixture.id, { awayScore: Math.max(0,(form.awayScore||0)-1) })}>−</button>
                            <span className="score-val">{form.awayScore || 0}</span>
                            <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { awayScore:(form.awayScore||0)+1 })}>+</button>
                          </div>
                        </div>
                      </div>

                      {/* ✅ أول هداف — PlayerSelect dropdown */}
                      <div className="field-row">
                        <span className="field-label">⚽ أول هدف</span>
                        <span className="points-tag" style={{ background: 'rgba(217,178,95,.1)', color: 'var(--gold)' }}>+3</span>
                        <PlayerSelect
                          fixtureId={match.fixture.id}
                          value={form.firstScorer}
                          onChange={(val: string) => setForm(match.fixture.id, { firstScorer: val })}
                        />
                      </div>

                      {/* ✅ التوقعات الإضافية + وقت إضافي — 2×2 grid */}
                      <div style={{ background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:18, padding:'12px 14px', marginBottom:10 }}>
                        <div style={{ fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                          توقعات إضافية
                          <span className="points-tag" style={{ background:'rgba(217,178,95,.1)', color:'var(--gold)' }}>+2 نقطة لكل إجابة صح</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          {[
                            { key:'extraTime',           label:'⏱️ وقت إضافي؟' },
                            { key:'predicted_red_card',  label:'🟥 بطاقة حمراء؟' },
                            { key:'predicted_penalty',   label:'⚽ ركلة جزاء؟' },
                            { key:'predicted_both_teams',label:'🎯 الفريقان يسجّلان؟' },
                          ].map(({ key, label }) => (
                            <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:'var(--surface-3)', border:'1px solid var(--line)', borderRadius:12, padding:'9px 12px' }}>
                              <input
                                type="checkbox"
                                checked={form[key] ?? false}
                                onChange={e => setForm(match.fixture.id, { [key]: e.target.checked })}
                                style={{ width:17, height:17, accentColor:'var(--gold)', flexShrink:0 }}
                              />
                              <span style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {msg && <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: msg.includes('✅') ? '#94f0c0' : '#ff9c91', textAlign: 'center' }}>{msg}</div>}
                      <button onClick={() => submitPrediction(match)} disabled={submitting === match.fixture.id} className="save-btn">
                        {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}

                  {/* Closed + saved */}
                  {!match.is_open && !hasResult && existing && (
                    <div className="pred-box">
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>توقعك المسجّل</div>
                      <div style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{existing.predicted_home_score} — {existing.predicted_away_score}</div>
                      {existing.predicted_first_scorer && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>⚽ {existing.predicted_first_scorer}</div>}
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
            <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: 'var(--gold)' }}>توقعاتي</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 18, padding: '14px 18px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--gold)' }}>🏅 {myPoints} نقطة</div>
            </div>
            {pointsBreakdown.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>🔝 أفضل توقعاتك بالنقاط</div>
                {pointsBreakdown.map((p: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 13 }}>{p.home_team} × {p.away_team}</span>
                    <span style={{ fontWeight: 800, color: (p.points || 0) >= 10 ? 'var(--gold)' : '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>+{p.points} نقطة</span>
                  </div>
                ))}
              </div>
            )}
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>لم تقدم أي توقعات بعد</div>
              </div>
            ) : predictions.map((p, i) => {
              const hasResult = p.actual_home_score !== null;
              return (
                <div key={i} className="rank-item" style={hasResult && (p.points || 0) >= 10 ? { borderColor: 'rgba(217,178,95,.28)', background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))' } : {}}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{p.home_team} × {p.away_team}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>توقعك: <strong>{p.predicted_home_score} — {p.predicted_away_score}</strong> {p.predicted_first_scorer && <span> ⚽ {p.predicted_first_scorer}</span>}</div>
                    {hasResult && <div style={{ fontSize: 13, color: 'var(--muted)' }}>الفعلية: <strong>{p.actual_home_score} — {p.actual_away_score}</strong></div>}
                  </div>
                  <div style={{ padding: '8px 14px', borderRadius: 14, background: !hasResult ? 'var(--surface-3)' : (p.points || 0) >= 10 ? 'rgba(217,178,95,.12)' : (p.points || 0) >= 5 ? 'rgba(39,176,110,.12)' : 'var(--surface-3)', border: '1px solid var(--line)', color: !hasResult ? 'var(--muted)' : (p.points || 0) >= 10 ? '#ffe3a6' : (p.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)', textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{hasResult ? (p.points || 0) : '⏳'}</div>
                    {hasResult && <div style={{ fontSize: 10, fontWeight: 700 }}>نقطة</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ LEADERBOARD TAB ════ */}
        {activeTab === 'leaders' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>🏆 ترتيب المتسابقين</h2>
              <Link href="/leaderboard" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>عرض الكامل ←</Link>
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                <div>لا توجد نتائج بعد</div>
              </div>
            ) : leaderboard.map((player: any, i) => {
              const isMe = player.user_id === user?.id;
              const name = player.display_name || player.user_email?.split('@')[0];
              return (
                <div key={i} className={`rank-item${isMe ? ' me' : ''}`}>
                  <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name} {isMe && <span style={{ fontSize: 11, color: 'var(--gold)', marginRight: 6 }}>أنت</span>} {player.profile_completed && <span style={{ fontSize: 11, color: 'var(--green)' }}>✅</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{player.count} توقع</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.totalPoints}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>نقطة</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ HISTORY TAB ════ */}
        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 6, color: 'var(--gold)' }}>📈 السجل التاريخي للترتيب</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>لقطات أسبوعية للترتيب منذ بداية البطولة</p>
            {historyDates.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div>لا يوجد سجل تاريخي بعد</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {historyDates.map(date => (
                    <button key={date} onClick={() => setActiveHistoryDate(date)} className={`round-btn${activeHistoryDate === date ? ' active' : ''}`}>
                      {new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>
                {historyRankings.filter((r: any) => r.week_start === activeHistoryDate).map((player: any, i: number) => {
                  const isMe = player.user_id === user?.id;
                  return (
                    <div key={i} className={`rank-item${isMe ? ' me' : ''}`}>
                      <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{player.display_name || '—'} {isMe && <span style={{ fontSize: 11, color: 'var(--gold)', marginRight: 6 }}>أنت</span>}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(player.week_start).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.total_points}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>نقطة</div>
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
            <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 6, color: 'var(--gold)' }}>🌍 نشاط اللاعبين</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>آخر الأحداث في المنافسة</p>
            {socialFeed.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div>لا يوجد نشاط بعد — كن أول من يسجّل!</div>
              </div>
            ) : socialFeed.map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>
                  {item.type === 'invite_friend' ? '🎉' : item.type === 'completed_profile' ? '✅' : item.type === 'joined_league' ? '🏆' : item.type === 'share_league' ? '🔗' : '⚽'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.user_name || 'لاعب'} {item.user_id === user?.id && <span style={{ fontSize: 11, color: 'var(--gold)', marginRight: 4 }}>أنت</span>}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{feedEventLabel(item.type, item.data)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
