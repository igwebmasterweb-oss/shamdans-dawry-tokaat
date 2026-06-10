'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';
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
  referral_code?: string | null;
}

// ✅ PlayerSelect v2 — team_players أولاً → fixture_players → input نص
function PlayerSelect({
  fixtureId,
  homeTeam,
  awayTeam,
  value,
  onChange,
}: {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [players, setPlayers] = useState<{ player_name: string; team_name: string; position: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!homeTeam || !awayTeam) return;
    setLoaded(false);
    setPlayers([]);

    async function load() {
      const { data: squadData } = await supabase
        .from('team_players')
        .select('player_name, team_name, position')
        .in('team_name', [homeTeam, awayTeam])
        .order('team_name')
        .order('player_name');

      if (squadData && squadData.length > 0) {
        setPlayers(squadData);
        setLoaded(true);
        return;
      }

      const { data: lineupData } = await supabase
        .from('fixture_players')
        .select('player_name, team_name, position')
        .eq('api_fixture_id', fixtureId)
        .order('team_name')
        .order('player_name');

      setPlayers(lineupData || []);
      setLoaded(true);
    }

    load();
  }, [fixtureId, homeTeam, awayTeam]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loaded && players.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
        placeholder="اكتب اسم الهداف..."
        style={{ flex: 1 }}
      />
    );
  }

  const filtered = players.filter((p) => p.player_name.toLowerCase().includes(search.toLowerCase()));
  const homePlayers = filtered.filter((p) => p.team_name === homeTeam);
  const awayPlayers = filtered.filter((p) => p.team_name === awayTeam);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--surface-3)',
          color: value ? 'var(--text)' : 'var(--muted)',
          fontFamily: 'Cairo, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'right',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          direction: 'rtl',
        }}
      >
        <span>{!loaded ? '⏳ جاري التحميل...' : (value || 'اختر الهداف...')}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && loaded && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            left: 0,
            zIndex: 20,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            boxShadow: '0 14px 34px rgba(0,0,0,.24)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن لاعب..."
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--surface-3)',
                color: 'var(--text)',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 13,
                outline: 'none',
                direction: 'rtl',
              }}
            />
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {homePlayers.length > 0 && (
              <>
                <div style={{ padding: '10px 14px 6px', fontSize: 12, fontWeight: 800, color: '#9bc4ff' }}>🏠 {homeTeam}</div>
                {homePlayers.map((p) => (
                  <button
                    key={`${p.team_name}-${p.player_name}`}
                    type="button"
                    onClick={() => { onChange(p.player_name); setOpen(false); setSearch(''); }}
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      background: value === p.player_name ? 'rgba(217,178,95,.12)' : 'transparent',
                      border: 'none',
                      color: value === p.player_name ? '#ffe3a6' : 'var(--text)',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      direction: 'rtl',
                    }}
                  >
                    <span>{p.position?.[0] ?? '—'}</span>
                    <span>{p.player_name}</span>
                  </button>
                ))}
              </>
            )}

            {awayPlayers.length > 0 && (
              <>
                <div style={{ padding: '10px 14px 6px', fontSize: 12, fontWeight: 800, color: '#9bc4ff' }}>✈️ {awayTeam}</div>
                {awayPlayers.map((p) => (
                  <button
                    key={`${p.team_name}-${p.player_name}`}
                    type="button"
                    onClick={() => { onChange(p.player_name); setOpen(false); setSearch(''); }}
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      background: value === p.player_name ? 'rgba(217,178,95,.12)' : 'transparent',
                      border: 'none',
                      color: value === p.player_name ? '#ffe3a6' : 'var(--text)',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      direction: 'rtl',
                    }}
                  >
                    <span>{p.position?.[0] ?? '—'}</span>
                    <span>{p.player_name}</span>
                  </button>
                ))}
              </>
            )}

            {filtered.length === 0 && (
              <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                لا توجد نتائج
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('');
      return;
    }

    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('الآن!');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}س ${m}د ${s}ث` : `${m}د ${s}ث`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const end = target;
    if (start === end) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return display;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<'predict' | 'my' | 'leaders' | 'feed' | 'history'>('predict');
  const [activeRound, setActiveRound] = useState('');
  const [predForms, setPredForms] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [collapsedMatches, setCollapsedMatches] = useState<Record<number, boolean>>({});
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
  const [upcomingAlert, setUpcomingAlert] = useState<any | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const router = useRouter();
  const animatedPoints = useCountUp(myTotalPoints);
  const countdown = useCountdown(upcomingAlert?.fixture?.date ?? null);

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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setPushEnabled(true);
      });
    });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
        return;
      }
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
    setLoadError(false);
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
              await supabase.from('mini_league_members').insert({ league_id: lgData.id, user_id: userId, role: 'member' });
              await supabase.from('social_feed').insert({
                user_id: userId,
                type: 'joined_league',
                data: { league_name: lgData.name, league_id: lgData.id },
              });
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('leagueJoinedMsg', `✅ انضممت لليج "${lgData.name}" بنجاح! 🏆`);
              }
            }
          }
        } catch (e) {
          console.error('League auto-join error:', e);
        }
      }

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
        fetch('/api/fixtures').then((res) => res.json()),
        supabase.from('fixtures').select(
          'api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,red_card_in_match,penalty_in_match,both_teams_scored,home_team_name,away_team_name'
        ),
        supabase.from('predictions').select('*').eq('user_id', userId),
        supabase.from('user_points').select('referral_count,total_points,referral_points').eq('user_id', userId).maybeSingle(),
        supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('historical_rankings').select('*').order('week_start', { ascending: false }).order('total_points', { ascending: false }),
        supabase.from('user_points').select('*').order('total_points', { ascending: false }),
      ]);

      const profileData = profileRes.data as Profile | null;
      const sessionData = sessionRes.data;
      const apiMatches = (fixturesApiRes as any)?.response || [];
      const sbFixtures = sbFixturesRes.data || [];
      const userPreds = userPredsRes.data || [];
      const myPointsRow: any = myPointsRowRes.data;
      const finalReferralCode = profileData?.referral_code || '';
      const feedData = feedDataRes.data || [];
      const histData = histDataRes.data || [];
      const userPointsData = userPointsDataRes.data || [];

      const userNameMap: Record<string, string> = {};
      userPointsData.forEach((row: any) => {
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

      const sbMap = new Map(sbFixtures.map((f: any) => [f.api_fixture_id, f]));
      const merged = apiMatches.map((m: any) => {
        const sb: any = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open: sb?.is_open ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer: sb?.first_scorer ?? '',
          went_extra_time: sb?.went_extra_time ?? false,
          red_card_in_match: sb?.red_card_in_match ?? false,
          penalty_in_match: sb?.penalty_in_match ?? false,
          both_teams_scored: sb?.both_teams_scored ?? false,
          db_home_team: sb?.home_team_name ?? m.teams.home.name,
          db_away_team: sb?.away_team_name ?? m.teams.away.name,
        };
      });

      setMatches(merged);

      const availableRounds = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (availableRounds.length > 0) {
        const openRound = availableRounds.find((round) =>
          merged.some((m: any) => m.league?.round === round && m.is_open === true && m.actual_home_score === null)
        );
        setActiveRound((prev) => (availableRounds.includes(prev) ? prev : (openRound ?? availableRounds[0])));
      }

      const openUnpredicted = merged.find((m: any) => {
        const hasResult = m.actual_home_score !== null;
        const predicted = userPreds.find((p: any) => p.fixture_id === m.fixture.id);
        return m.is_open && !hasResult && !predicted;
      });
      setUpcomingAlert(openUnpredicted || null);
      setPredictions(userPreds);

      if (myPointsRow) {
        setReferralCode(finalReferralCode);
        setReferralCount(myPointsRow.referral_count || 0);
        setMyTotalPoints(myPointsRow.total_points || 0);
      } else {
        const myRow = userPointsData.find((r: any) => r.user_id === userId);
        setReferralCode(finalReferralCode);
        setReferralCount(myRow?.referral_count || 0);
        setMyTotalPoints(myRow?.total_points || 0);
      }

      setSocialFeed(feedData.map((item: any) => ({ ...item, user_name: userNameMap[item.user_id] || 'لاعب' })));

      if (histData.length > 0) {
        const dates = [...new Set(histData.map((r: any) => r.week_start))] as string[];
        setHistoryDates(dates);
        setActiveHistoryDate((prev) => prev || dates[0]);
        setHistoryRankings(histData.map((row: any) => ({ ...row, display_name: userNameMap[row.user_id] || 'لاعب' })));
      } else {
        setHistoryDates([]);
        setActiveHistoryDate('');
        setHistoryRankings([]);
      }

      setLeaderboard(
        userPointsData.map((row: any) => ({
          user_id: row.user_id,
          user_email: row.user_email,
          display_name: row.full_name || null,
          profile_completed: row.profile_completed || false,
          totalPoints: row.total_points || 0,
          count: row.predictions_count || 0,
          referral_count: row.referral_count || 0,
          referral_points: row.referral_points ?? Math.min((row.referral_count || 0) * 5, 50),
        }))
      );

      const predictionsWithResults = userPreds.map((p: any) => {
        const match = merged.find((m: any) => m.fixture.id === p.fixture_id);
        return {
          ...p,
          actual_home_score: match?.actual_home_score ?? null,
          actual_away_score: match?.actual_away_score ?? null,
          home_team: p.home_team || match?.teams?.home?.name,
          away_team: p.away_team || match?.teams?.away?.name,
        };
      });
      setPredictions(predictionsWithResults);

      const breakdown = predictionsWithResults
        .filter((p: any) => p.points !== null && p.points > 0)
        .sort((a: any, b: any) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
      setPointsBreakdown(breakdown);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    }
    setLoading(false);
  };

  const quickJoinLeague = async () => {
    if (!user || !leagueCode.trim()) return;
    setLeagueJoining(true);
    setLeagueQuickMsg('');
    try {
      const { data: lgData } = await supabase
        .from('mini_leagues')
        .select('id, name')
        .eq('code', leagueCode.trim().toUpperCase())
        .maybeSingle();
      if (!lgData) {
        setLeagueQuickMsg('❌ كود غير صحيح');
        setLeagueJoining(false);
        return;
      }

      const { data: already } = await supabase
        .from('mini_league_members')
        .select('id')
        .eq('league_id', lgData.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (already) {
        setLeagueQuickMsg(`✅ أنت بالفعل عضو في "${lgData.name}"`);
        setLeagueJoining(false);
        return;
      }

      await supabase.from('mini_league_members').insert({ league_id: lgData.id, user_id: user.id, role: 'member' });
      await supabase.from('social_feed').insert({
        user_id: user.id,
        type: 'joined_league',
        data: { league_name: lgData.name, league_id: lgData.id },
      });
      setLeagueQuickMsg(`🎉 انضممت لـ "${lgData.name}" بنجاح!`);
      setLeagueCode('');
      await loadData(user.id);
    } catch {
      setLeagueQuickMsg('❌ حدث خطأ، حاول مجدداً');
    }
    setLeagueJoining(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);

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
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('referral_code, facebook_bonus_awarded')
        .eq('id', user.id)
        .maybeSingle();

      const updates: any = {
        id: user.id,
        full_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        facebook_url: fbUrl,
        profile_completed: true,
        bonus_points_awarded: true,
        bonus_points: 5,
        updated_at: new Date().toISOString(),
        referral_code: currentProfile?.referral_code ?? null,
        facebook_bonus_awarded: currentProfile?.facebook_bonus_awarded ?? false,
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      if (!profile?.bonus_points_awarded) {
        await supabase.from('social_feed').insert({
          user_id: user.id,
          type: 'completed_profile',
          data: { display_name: profileForm.display_name.trim() },
        });
      }

      setProfileMsg('✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉');
      await loadData(user.id);
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileMsg('');
      }, 2500);
    } catch {
      setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً');
    }

    setProfileSaving(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find((p) => p.fixture_id === match.fixture.id);
    return {
      homeScore: ex?.predicted_home_score ?? 0,
      awayScore: ex?.predicted_away_score ?? 0,
      firstScorer: ex?.predicted_first_scorer ?? '',
      extraTime: ex?.predicted_extra_time ?? false,
      predicted_red_card: ex?.predicted_red_card ?? false,
      predicted_penalty: ex?.predicted_penalty ?? false,
      predicted_both_teams: ex?.predicted_both_teams ?? false,
    };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms((prev) => ({ ...prev, [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch } }));

  const isMatchCollapsed = (fixtureId: number) => collapsedMatches[fixtureId] !== false;
  const toggleMatchCollapse = (fixtureId: number) =>
    setCollapsedMatches((prev) => ({ ...prev, [fixtureId]: !isMatchCollapsed(fixtureId) }));
  const collapseAllMatches = (matchList: any[]) =>
    setCollapsedMatches(Object.fromEntries(matchList.map((m: any) => [m.fixture.id, true])));
  const expandAllMatches = (matchList: any[]) =>
    setCollapsedMatches(Object.fromEntries(matchList.map((m: any) => [m.fixture.id, false])));

  const submitPrediction = async (match: any) => {
    if (!user) return;
    setCollapsedMatches((prev) => ({ ...prev, [match.fixture.id]: false }));
    setSubmitting(match.fixture.id);
    const form = getForm(match);

    try {
      const ex = predictions.find((p) => p.fixture_id === match.fixture.id);
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
        predicted_red_card: form.predicted_red_card ?? false,
        predicted_penalty: form.predicted_penalty ?? false,
        predicted_both_teams: form.predicted_both_teams ?? false,
        submitted_at: new Date().toISOString(),
      };

      if (ex) {
        await supabase.from('predictions').update(payload).eq('id', ex.id);
      } else {
        await supabase.from('predictions').insert(payload);
        await supabase.from('social_feed').insert({
          user_id: user.id,
          type: 'share_predictions',
          data: { home: match.teams.home.name, away: match.teams.away.name, fixture_id: match.fixture.id },
        });
      }

      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      const refreshed = (data || []).map((p: any) => {
        const m = matches.find((mx: any) => mx.fixture.id === p.fixture_id);
        return {
          ...p,
          actual_home_score: m?.actual_home_score ?? null,
          actual_away_score: m?.actual_away_score ?? null,
        };
      });
      setPredictions(refreshed);
      setMessages((m) => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages((m) => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch {
      setMessages((m) => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' }));
    }

    setSubmitting(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handlePushSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('المتصفح ده مش بيدعم الإشعارات. استخدم Chrome أو Edge');
      return;
    }

    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setPushEnabled(true);
        setPushLoading(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushLoading(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as any,
      });

      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, subscription: sub }),
      });
      setPushEnabled(true);
    } catch (err) {
      console.error('Push error:', err);
    }
    setPushLoading(false);
  };

  const feedEventLabel = (type: string, data: any) => {
    switch (type) {
      case 'invite_friend': return '🎉 دعا صديقاً جديداً وربح نقاط!';
      case 'joined_league': return `🏆 انضم للبطولة ${data?.league_name || ''}`;
      case 'share_league': return '🔗 شارك رابط البطولة';
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

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 54, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>حدث خطأ أثناء تحميل البيانات</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>تحقق من اتصالك بالإنترنت وحاول مجدداً</div>
          <button
            onClick={() => { if (user) { setLoading(true); loadData(user.id); } }}
            style={{
              padding: '12px 32px',
              borderRadius: 14,
              border: 'none',
              background: 'var(--gold)',
              color: '#1a1200',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text)' }}>جاري التحميل...</div>;
  }

  const myPoints = myTotalPoints;
  const myRank = leaderboard.findIndex((p) => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter((m: any) => m.league?.round === activeRound);

  const resolvedPreds = predictions.filter((p: any) => p.actual_home_score !== null);
  const correctPreds = resolvedPreds.filter((p: any) => p.points && p.points > 0);
  const accuracyPct = resolvedPreds.length > 0 ? Math.round((correctPreds.length / resolvedPreds.length) * 100) : 0;

  const roundsWithPred = new Set(
    predictions
      .map((p: any) => {
        const m = matches.find((mx: any) => mx.fixture.id === p.fixture_id);
        return m?.league?.round;
      })
      .filter(Boolean)
  );
  const streakCount = roundsWithPred.size;

  const roundTotal = filteredMatches.length;
  const roundDone = filteredMatches.filter((m: any) => predictions.find((p: any) => p.fixture_id === m.fixture.id)).length;
  const roundPct = roundTotal > 0 ? Math.round((roundDone / roundTotal) * 100) : 0;

  const openUnpredictedCount = matches.filter((m: any) =>
    m.is_open && m.actual_home_score === null && !predictions.find((p: any) => p.fixture_id === m.fixture.id)
  ).length;

  const medals = ['🥇', '🥈', '🥉'];
  const displayName = profile?.full_name || user?.email?.split('@')[0];
  const profileIncomplete = !profile?.profile_completed;

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #0b0f16;
          --surface: #131a24;
          --surface-2: #18212d;
          --surface-3: #1f2b3a;
          --line: rgba(255,255,255,.08);
          --text: #eef4ff;
          --muted: #9fb0c8;
          --gold: #d9b25f;
          --green: #27b06e;
          --red: #c93a2f;
          --blue: #4da3ff;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Cairo, sans-serif; background: var(--bg); color: var(--text); }
        .page { min-height: 100vh; background: radial-gradient(circle at top, rgba(77,163,255,.08), transparent 32%), var(--bg); }
        .container { width: min(1120px, calc(100% - 24px)); margin: 0 auto; }
        .header-card, .card, .match-card, .tab-panel, .modal-box { background: var(--surface); border: 1px solid var(--line); }
        .header-card { border-radius: 22px; padding: 16px; margin-top: 18px; }
        .main-grid { display: grid; gap: 14px; padding: 16px 0 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .card { border-radius: 20px; padding: 16px; }
        .tab-wrap { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .tab-btn, .round-btn, .save-btn, .quick-btn { border: 1px solid var(--line); background: var(--surface-2); color: var(--text); border-radius: 14px; cursor: pointer; font-family: Cairo, sans-serif; }
        .tab-btn { padding: 10px 14px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .tab-btn.active, .round-btn.active { background: rgba(217,178,95,.14); border-color: rgba(217,178,95,.3); color: #ffe3a6; }
        .tab-panel { border-radius: 22px; padding: 16px; }
        .round-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
        .round-btn { padding: 9px 13px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .save-btn { width: 100%; padding: 12px 16px; font-size: 14px; font-weight: 800; background: linear-gradient(180deg, rgba(217,178,95,.22), rgba(217,178,95,.14)); border-color: rgba(217,178,95,.32); }
        .save-btn:disabled { opacity: .65; cursor: default; }
        .quick-btn { padding: 11px 14px; font-size: 13px; font-weight: 800; }
        .match-card { border-radius: 22px; padding: 16px; margin-bottom: 12px; }
        .pill-open, .pill-closed, .pill-saved { border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
        .pill-open { background: rgba(39,176,110,.12); color: #8ef0b8; border: 1px solid rgba(39,176,110,.22); }
        .pill-closed { background: rgba(201,58,47,.12); color: #ffb3ad; border: 1px solid rgba(201,58,47,.24); }
        .pill-saved { background: rgba(77,163,255,.12); color: #9dc8ff; border: 1px solid rgba(77,163,255,.24); }
        .pred-box { background: var(--surface-2); border: 1px solid var(--line); border-radius: 18px; padding: 14px; }
        .score-input, .field-input, .quick-input, .modal-input { width: 100%; border-radius: 14px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); padding: 12px 14px; font-family: Cairo, sans-serif; font-size: 14px; outline: none; }
        .score-input { text-align: center; font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .check-row { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; font-size: 13px; cursor: pointer; }
        .check-row input { width: 17px; height: 17px; accent-color: var(--gold); }
        .msg { margin-top: 10px; padding: 10px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; }
        .msg.ok { background: rgba(39,176,110,.12); color: #8ef0b8; }
        .msg.err { background: rgba(201,58,47,.12); color: #ffb3ad; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.58); backdrop-filter: blur(6px); display: grid; place-items: center; z-index: 60; padding: 18px; }
        .modal-box { width: min(560px, 100%); border-radius: 22px; padding: 18px; background: #111824; }
        .feed-item, .history-item, .leader-item, .my-pred-item { background: var(--surface-2); border: 1px solid var(--line); border-radius: 18px; padding: 14px; margin-bottom: 10px; }
        @media (max-width: 860px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) {
          .container { width: min(100%, calc(100% - 14px)); }
          .header-card, .tab-panel, .match-card, .card { border-radius: 18px; }
          .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        }
      `}</style>

      <div className="page">
        <div className="container">
          <div className="header-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>الشمعدان × كأس العالم</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>أهلاً {displayName}! 👋</div>
              </div>
              <button onClick={handleLogout} className="quick-btn">خروج</button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button
                onClick={() => setShowProfileModal(true)}
                style={{
                  padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                  border: profileIncomplete ? '1px solid rgba(217,178,95,.35)' : '1px solid var(--line)',
                  background: profileIncomplete ? 'rgba(217,178,95,.08)' : 'var(--surface-2)',
                  color: profileIncomplete ? '#f2d79e' : 'var(--text)',
                  fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {profileIncomplete ? '🎁 أكمل ملفك +5 نقاط' : `✏️ ${displayName}`}
              </button>

              <Link href="/my-leagues" style={{ textDecoration: 'none' }}>
                <button className="quick-btn">🏆 ليجاتي</button>
              </Link>

              <button
                onClick={() => setShowReferral(true)}
                style={{
                  padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)',
                  background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                🎁 ادعُ صديق {referralCount > 0 && <span style={{ fontWeight: 900 }}>({referralCount})</span>}
              </button>

              <button onClick={handlePushSubscribe} className="quick-btn">
                {pushEnabled ? '🔔 مفعّل' : pushLoading ? '...' : '🔔 إشعارات'}
              </button>
            </div>

            {leagueJoinMsg && (
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(39,176,110,.1)', border: '1px solid rgba(39,176,110,.22)', borderRadius: 14, color: '#95efbe', fontSize: 13, fontWeight: 700 }}>
                {leagueJoinMsg} <Link href="/my-leagues" style={{ color: '#c6ffdd' }}>اضغط هنا لرؤية الليج ←</Link>
              </div>
            )}
          </div>

          {profileIncomplete ? (
            <div onClick={() => setShowProfileModal(true)} style={{ marginTop: 12, background: 'linear-gradient(90deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', border: '1px solid rgba(217,178,95,.18)', borderRadius: 16, padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontSize: 13, color: '#f2d79e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً! اضغط هنا
            </div>
          ) : upcomingAlert ? (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 16, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13 }}>
                ⚡ {upcomingAlert.teams.home.name} × {upcomingAlert.teams.away.name} {countdown && <span style={{ color: '#93c5fd', fontWeight: 800 }}>⏱ {countdown}</span>}
              </div>
              <button onClick={() => { setActiveTab('predict'); setActiveRound(upcomingAlert.league.round); setUpcomingAlert(null); }} style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,.2)', border: '1px solid rgba(59,130,246,.3)', color: '#93c5fd', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>توقع الآن</button>
            </div>
          ) : !pushEnabled ? (
            <div onClick={handlePushSubscribe} style={{ marginTop: 12, padding: '12px 16px', borderRadius: 16, background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.18)', textAlign: 'center', cursor: 'pointer', fontSize: 13, color: '#f2d79e' }}>
              {pushLoading ? '⏳ جاري تفعيل الإشعارات...' : '🔔 فعّل الإشعارات — احصل على تنبيه قبل كل مباراة بـ 5 ساعات'}
            </div>
          ) : null}

          <div className="main-grid">
            <div className="stats-grid">
              {[
                { label: 'توقعاتي', value: predictions.length, color: '#8ae0b3', icon: '⚽' },
                { label: 'المتسابقون', value: leaderboard.length, color: '#7db1ff', icon: '👥' },
                { label: 'دقة التوقع', value: resolvedPreds.length > 0 ? `${accuracyPct}%` : '—', color: '#c084fc', icon: '🎯' },
                { label: 'الجولات', value: streakCount > 0 ? `${streakCount} 🔥` : '—', color: '#f97316', icon: '📅' },
              ].map((s: any) => (
                <div key={s.label} className="card">
                  <div style={{ fontSize: 18 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color, marginTop: 8 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {myRank > 0 && (
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>📊 ترتيبك</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="pred-box">
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>الترتيب الإجمالي</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--gold)', marginTop: 6 }}>#{myRank}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>من {leaderboard.length} متسابق</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 10 }}>{animatedPoints} نقطة</div>
                  </div>
                  <div className="pred-box">
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{roundLabels[activeRound] || activeRound || 'الجولة الحالية'}</div>
                    {(() => {
                      const roundFixtureIds = matches.filter((m: any) => m.league?.round === activeRound).map((m: any) => m.fixture.id);
                      const myRoundPts = predictions
                        .filter((pr: any) => roundFixtureIds.includes(pr.fixture_id))
                        .reduce((sum: number, pr: any) => sum + (pr.points || 0), 0);
                      return roundFixtureIds.length > 0 ? (
                        <>
                          <div style={{ fontSize: 30, fontWeight: 900, color: '#8ef0b8', marginTop: 6 }}>{myRoundPts}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>نقطة في هذه الجولة</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>من {roundFixtureIds.length} مباراة</div>
                        </>
                      ) : <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>لا توجد مباريات</div>;
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>🏆 انضم لليج بكود سريع</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={leagueCode} onChange={(e) => setLeagueCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && quickJoinLeague()} placeholder="أدخل كود الليج..." className="quick-input" maxLength={8} style={{ minWidth: 0, flex: '1 1 120px' }} />
                <button onClick={quickJoinLeague} className="quick-btn">{leagueJoining ? '⏳' : 'انضم'}</button>
                <Link href="/my-leagues" style={{ textDecoration: 'none' }}><button className="quick-btn">عرض ليجاتي</button></Link>
              </div>
              {leagueQuickMsg && <div style={{ marginTop: 10, fontSize: 13, color: leagueQuickMsg.startsWith('❌') ? '#ffb3ad' : '#8ef0b8' }}>{leagueQuickMsg}</div>}
            </div>

            <div className="tab-wrap">
              {([
                { id: 'predict', label: openUnpredictedCount > 0 ? `⚽ التوقعات (${openUnpredictedCount})` : '⚽ التوقعات' },
                { id: 'my', label: '📋 توقعاتي' },
                { id: 'leaders', label: '🏆 الصدارة' },
                { id: 'history', label: '📈 السجل التاريخي' },
                { id: 'feed', label: '🌍 نشاط اللاعبين' },
              ] as const).map(({ id, label }) => (
                <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
              ))}
            </div>

            {activeTab === 'predict' && (
              <div className="tab-panel">
                <div className="round-strip">
                  {rounds.map((r) => (
                    <button key={r} className={`round-btn ${activeRound === r ? 'active' : ''}`} onClick={() => setActiveRound(r)}>
                      {roundLabels[r] || r} ({matches.filter((m: any) => m.league?.round === r).length})
                    </button>
                  ))}
                </div>

                {roundTotal > 0 && (
                  <div className="card" style={{ background: 'var(--surface-2)', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: 'var(--muted)' }}>
                      <span>تقدمك في الجولة الحالية</span>
                      <span>{roundDone} / {roundTotal} مباراة</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,.05)', borderRadius: 999 }}>
                      <div style={{ width: `${roundPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold),#f5d79b)', borderRadius: 999, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                    {roundDone === roundTotal && roundTotal > 0 && <div style={{ textAlign: 'center', fontSize: 12, color: '#5effa8', marginTop: 6, fontWeight: 700 }}>✅ أكملت كل توقعات الجولة!</div>}
                  </div>
                )}

                {filteredMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>لا توجد ماتشات في هذه الجولة</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        يتم عرض المباريات في وضع مختصر افتراضياً لتسهيل استعراض عدد أكبر من المباريات.
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="round-btn" onClick={() => expandAllMatches(filteredMatches)}>📂 توسيع الكل</button>
                        <button type="button" className="round-btn" onClick={() => collapseAllMatches(filteredMatches)}>📥 تصغير الكل</button>
                      </div>
                    </div>

                    {filteredMatches.map((match: any) => {
                      const existing = predictions.find((p) => p.fixture_id === match.fixture.id);
                      const form = getForm(match);
                      const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
                      const msg = messages[match.fixture.id];
                      const collapsed = isMatchCollapsed(match.fixture.id);
                      const summaryText = hasResult
                        ? `النتيجة: ${match.actual_home_score} — ${match.actual_away_score}${existing ? ` · نقاطك: ${existing.points || 0}` : ''}`
                        : existing
                          ? `توقعك: ${existing.predicted_home_score} — ${existing.predicted_away_score}${existing.predicted_first_scorer ? ` · ⚽ ${existing.predicted_first_scorer}` : ''}`
                          : (match.is_open ? 'لم يتم حفظ توقعك بعد' : 'المباراة مغلقة ولم يتم حفظ توقع');

                      return (
                        <div key={match.fixture.id} className="match-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: collapsed ? 0 : 16, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 220 }}>
                              <div style={{ fontWeight: 800, fontSize: 16 }}>{match.teams.home.name} × {match.teams.away.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className={match.is_open ? 'pill-open' : 'pill-closed'}>{match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}</span>
                              {existing && <span className="pill-saved">✅ محفوظ</span>}
                              <button
                                type="button"
                                onClick={() => toggleMatchCollapse(match.fixture.id)}
                                style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}
                              >
                                {collapsed ? '📂 عرض التفاصيل' : '📥 إخفاء التفاصيل'}
                              </button>
                            </div>
                          </div>

                          {collapsed ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'var(--surface-3)', borderRadius: 18, marginTop: 12, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                {match.teams.home.logo
                                  ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={32} height={32} style={{ borderRadius: 8, objectFit: 'contain' }} />
                                  : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 16 }}>⚽</div>}
                                <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.teams.home.name}</div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)', textAlign: 'center', minWidth: 72 }}>
                                {hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.teams.away.name}</div>
                                {match.teams.away.logo
                                  ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={32} height={32} style={{ borderRadius: 8, objectFit: 'contain' }} />
                                  : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 16 }}>⚽</div>}
                              </div>
                              <div style={{ width: '100%', fontSize: 12, color: existing ? 'var(--text)' : 'var(--muted)', marginTop: 2 }}>{summaryText}</div>
                              {msg && <div className={`msg ${msg.startsWith('✅') ? 'ok' : 'err'}`} style={{ width: '100%', marginTop: 6 }}>{msg}</div>}
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '14px', background: 'var(--surface-3)', borderRadius: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                  {match.teams.home.logo
                                    ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={40} height={40} style={{ borderRadius: 8, objectFit: 'contain' }} />
                                    : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 20 }}>⚽</div>}
                                  <span style={{ fontWeight: 800, fontSize: 15 }}>{match.teams.home.name}</span>
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)', padding: '0 16px', textAlign: 'center', minWidth: 80 }}>
                                  {hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                                  <span style={{ fontWeight: 800, fontSize: 15 }}>{match.teams.away.name}</span>
                                  {match.teams.away.logo
                                    ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={40} height={40} style={{ borderRadius: 8, objectFit: 'contain' }} />
                                    : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 20 }}>⚽</div>}
                                </div>
                              </div>

                              {hasResult && (
                                <div className="pred-box" style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>النتيجة الفعلية</div>
                                  {match.first_scorer && <div style={{ fontSize: 13, color: 'var(--muted)' }}>⚽ أول هدف: {match.first_scorer}</div>}
                                  {existing && (
                                    <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: (existing.points || 0) >= 10 ? '#ffe3a6' : (existing.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                                      نقاطك: <strong>{existing.points || 0}</strong> نقطة
                                    </div>
                                  )}
                                </div>
                              )}

                              {match.is_open && (
                                <div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                    <input type="number" min={0} value={form.homeScore} onChange={(e) => setForm(match.fixture.id, { homeScore: Number(e.target.value || 0) })} className="score-input" />
                                    <span style={{ color: 'var(--muted)' }}>-</span>
                                    <input type="number" min={0} value={form.awayScore} onChange={(e) => setForm(match.fixture.id, { awayScore: Number(e.target.value || 0) })} className="score-input" />
                                  </div>

                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>من سيسجل أولاً؟</div>
                                    <PlayerSelect
                                      fixtureId={match.fixture.id}
                                      homeTeam={match.teams.home.name}
                                      awayTeam={match.teams.away.name}
                                      value={form.firstScorer}
                                      onChange={(val) => setForm(match.fixture.id, { firstScorer: val })}
                                    />
                                  </div>

                                  {!String(match.league?.round || '').startsWith('Group Stage') && (
                                    <label className="check-row">
                                      <input type="checkbox" checked={form.extraTime} onChange={(e) => setForm(match.fixture.id, { extraTime: e.target.checked })} />
                                      <span>⏱ هل ستذهب المباراة لوقت إضافي؟</span>
                                    </label>
                                  )}

                                  <label className="check-row">
                                    <input type="checkbox" checked={form.predicted_red_card} onChange={(e) => setForm(match.fixture.id, { predicted_red_card: e.target.checked })} />
                                    <span>🟥 هل سيحدث طرد في المباراة؟</span>
                                  </label>

                                  <label className="check-row">
                                    <input type="checkbox" checked={form.predicted_penalty} onChange={(e) => setForm(match.fixture.id, { predicted_penalty: e.target.checked })} />
                                    <span>⚽ هل ستشهد المباراة ضربة جزاء؟</span>
                                  </label>

                                  <button onClick={() => submitPrediction(match)} disabled={submitting === match.fixture.id} className="save-btn">
                                    {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '💾 حفظ التوقع'}
                                  </button>
                                </div>
                              )}

                              {!match.is_open && !hasResult && existing && (
                                <div className="pred-box">
                                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>توقعك المحفوظ</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{existing.predicted_home_score} — {existing.predicted_away_score}</div>
                                  {existing.predicted_first_scorer && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>⚽ {existing.predicted_first_scorer}</div>}
                                </div>
                              )}

                              {msg && <div className={`msg ${msg.startsWith('✅') ? 'ok' : 'err'}`}>{msg}</div>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {activeTab === 'my' && (
              <div className="tab-panel">
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>توقعاتي</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>🏅 {myPoints} نقطة</div>

                {pointsBreakdown.length > 0 && (
                  <div className="card" style={{ marginBottom: 14, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>🔝 أفضل توقعاتك بالنقاط</div>
                    {pointsBreakdown.map((p: any, i: number) => (
                      <div key={`${p.fixture_id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i === pointsBreakdown.length - 1 ? 'none' : '1px solid var(--line)' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{p.home_team} × {p.away_team}</div>
                        </div>
                        <div style={{ fontWeight: 900, color: (p.points || 0) >= 10 ? 'var(--gold)' : '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>+{p.points} نقطة</div>
                      </div>
                    ))}
                  </div>
                )}

                {predictions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>لم تقدم أي توقعات بعد</div>
                ) : predictions.map((p: any, i: number) => {
                  const hasResult = p.actual_home_score !== null;
                  return (
                    <div key={`${p.fixture_id}-${i}`} className="my-pred-item" style={(p.points || 0) >= 10 ? { borderColor: 'rgba(217,178,95,.28)', background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))' } : {}}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{p.home_team} × {p.away_team}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>توقعك: {p.predicted_home_score} — {p.predicted_away_score}</div>
                          {p.predicted_first_scorer && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>⚽ {p.predicted_first_scorer}</div>}
                          {hasResult && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>الفعلية: {p.actual_home_score} — {p.actual_away_score}</div>}
                        </div>
                        <div style={{ borderRadius: 14, padding: '10px 14px', background: (p.points || 0) >= 10 ? 'rgba(217,178,95,.12)' : (p.points || 0) >= 5 ? 'rgba(39,176,110,.12)' : 'var(--surface-3)', border: '1px solid var(--line)', color: !hasResult ? 'var(--muted)' : (p.points || 0) >= 10 ? '#ffe3a6' : (p.points || 0) >= 5 ? '#94f0c0' : 'var(--muted)', textAlign: 'center', minWidth: 60 }}>
                          <div style={{ fontWeight: 900 }}>{hasResult ? (p.points || 0) : '⏳'}</div>
                          {hasResult && <div style={{ fontSize: 12 }}>نقطة</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'leaders' && (
              <div className="tab-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>🏆 ترتيب المتسابقين</div>
                  <Link href="/leaderboard" style={{ color: '#9dc8ff', textDecoration: 'none' }}>عرض الكامل ←</Link>
                </div>

                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>لا توجد نتائج بعد</div>
                ) : leaderboard.slice(0, 20).map((player: any, i: number) => {
                  const isMe = player.user_id === user?.id;
                  const name = player.display_name || player.user_email?.split('@')[0];
                  return (
                    <div key={player.user_id} className="leader-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ fontSize: 22, minWidth: 34 }}>{i < 3 ? medals[i] : `#${i + 1}`}</div>
                          <div>
                            <div style={{ fontWeight: 900 }}>{name} {isMe && <span style={{ color: '#9dc8ff', fontSize: 12 }}>أنت</span>} {player.profile_completed && <span style={{ fontSize: 12 }}>✅</span>}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{player.count} توقع</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, color: 'var(--gold)' }}>{player.totalPoints} نقطة</div>
                      </div>
                    </div>
                  );
                })}

                {leaderboard.length > 20 && (
                  <div style={{ marginTop: 10 }}>
                    <Link href="/leaderboard" style={{ color: '#9dc8ff', textDecoration: 'none' }}>عرض الكل ({leaderboard.length}) ←</Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="tab-panel">
                <div style={{ fontSize: 18, fontWeight: 900 }}>📈 السجل التاريخي للترتيب</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, marginBottom: 12 }}>لقطات أسبوعية للترتيب منذ بداية البطولة</div>

                {historyDates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>لا يوجد سجل تاريخي بعد</div>
                ) : (
                  <>
                    <div className="round-strip">
                      {historyDates.map((date) => (
                        <button key={date} onClick={() => setActiveHistoryDate(date)} className={`round-btn ${activeHistoryDate === date ? 'active' : ''}`}>
                          {new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                        </button>
                      ))}
                    </div>

                    {historyRankings.filter((r: any) => r.week_start === activeHistoryDate).map((player: any, i: number) => {
                      const isMe = player.user_id === user?.id;
                      return (
                        <div key={`${player.user_id}-${player.week_start}`} className="history-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 900 }}>{i < 3 ? medals[i] : `#${i + 1}`} {player.display_name || '—'} {isMe && <span style={{ color: '#9dc8ff', fontSize: 12 }}>أنت</span>}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{new Date(player.week_start).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            </div>
                            <div style={{ fontWeight: 900, color: 'var(--gold)' }}>{player.total_points} نقطة</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {activeTab === 'feed' && (
              <div className="tab-panel">
                <div style={{ fontSize: 18, fontWeight: 900 }}>🌍 نشاط اللاعبين</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, marginBottom: 12 }}>آخر الأحداث في المنافسة</div>

                {socialFeed.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>لا يوجد نشاط بعد — كن أول من يسجّل!</div>
                ) : socialFeed.map((item: any, i: number) => (
                  <div key={`${item.id || i}`} className="feed-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {item.type === 'invite_friend' ? '🎉' : item.type === 'completed_profile' ? '✅' : item.type === 'joined_league' ? '🏆' : item.type === 'share_league' ? '🔗' : '⚽'}{' '}
                          {item.user_name || 'لاعب'} {item.user_id === user?.id && <span style={{ color: '#9dc8ff', fontSize: 12 }}>أنت</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{feedEventLabel(item.type, item.data)}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{timeAgo(item.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>

            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f2d79e' }}>
                🎁 أكمل <strong>الاسم + التليفون + فيسبوك</strong> واحصل على 5 نقاط!
                <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
                  <span>{profileForm.display_name.trim() ? '✅' : '○'} الاسم</span>
                  <span>{profileForm.phone.trim() ? '✅' : '○'} التليفون</span>
                  <span>{profileForm.facebook_url.trim() ? '✅' : '○'} فيسبوك</span>
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>الاسم الكامل <span style={{ color: 'var(--red)' }}>*</span></div>
            <input type="text" value={profileForm.display_name} onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="اسمك كما تريد أن يظهر في الصدارة" className="modal-input" style={{ marginBottom: 14 }} />

            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>رقم التليفون <span style={{ color: '#7db1ff', fontSize: 11 }}>(مطلوب للنقاط)</span></div>
            <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01012345678" className="modal-input" style={{ marginBottom: 8, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: '#ffcf8b', background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.16)', borderRadius: 10, padding: '8px 10px' }}>
              ⚠️ تأكد أن رقم التليفون صحيح ويمكن الوصول إليك عليه، لأن إدخال بيانات غير صحيحة قد يسبب عدم استحقاقك لأي جائزة عند الفوز.
            </div>

            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              رابط فيسبوك
              {profile?.facebook_bonus_awarded
                ? <span style={{ background: 'rgba(39,176,110,.1)', color: '#5effa8', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>✅ مضاف</span>
                : <span style={{ background: 'rgba(217,178,95,.1)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>+5 نقاط عند إكمال الثلاثة</span>}
            </div>
            <input type="url" value={profileForm.facebook_url} onChange={(e) => setProfileForm((f) => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/username" className="modal-input" style={{ marginBottom: 8, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ marginBottom: 20, fontSize: 12, lineHeight: 1.7, color: '#ffcf8b', background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.16)', borderRadius: 10, padding: '8px 10px' }}>
              ⚠️ تأكد أن رابط حساب فيسبوك يخصك فعلاً وبشكل صحيح، لأن البيانات غير الصحيحة قد تسبب عدم فوزك أو عدم استحقاقك للجائزة حتى لو حققت مركزاً فائزاً.
            </div>

            {profileMsg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: profileMsg.startsWith('✅') ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', color: profileMsg.startsWith('✅') ? '#5effa8' : '#ff9e9e', fontSize: 13, fontWeight: 700 }}>{profileMsg}</div>}
            <button onClick={saveProfile} disabled={profileSaving} className="save-btn">{profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}</button>
          </div>
        </div>
      )}

      {showReferral && (
        <div className="modal-overlay" onClick={() => setShowReferral(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>🎁 ادعُ أصدقاءك</h3>
              <button onClick={() => setShowReferral(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'أصدقاء انضموا', value: referralCount, color: 'var(--green)' },
                { label: 'نقاط من الدعوات', value: Math.min(referralCount * 5, 50), color: 'var(--gold)' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--surface-3)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(77,163,255,.08)', border: '1px solid rgba(77,163,255,.18)', borderRadius: 14, padding: '12px 14px', marginBottom: 18, fontSize: 13, lineHeight: 1.9, color: '#cbe1ff' }}>
              <strong>⚡ كيف يعمل؟</strong><br />
              ١. شارك رابطك مع أصدقاءك<br />
              ٢. لما يسجلوا عن طريق رابطك → +5 نقاط لك<br />
              ٣. الحد الأقصى لنقاط الدعوات 50 نقطة
            </div>

            {referralCode ? (
              <>
                <div style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', marginBottom: 14, wordBreak: 'break-all', fontSize: 13, color: 'var(--muted)', direction: 'ltr', textAlign: 'left' }}>
                  {typeof window !== 'undefined' ? getReferralLink() : '...'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  {[
                    { label: referralCopied ? '✅ تم النسخ' : '📋 نسخ', fn: copyReferralLink, bg: 'rgba(255,255,255,.04)' },
                    { label: '💬 واتساب', fn: shareOnWhatsApp, bg: 'rgba(37,211,102,.1)' },
                    { label: '📘 فيسبوك', fn: shareOnFacebook, bg: 'rgba(24,119,242,.1)' },
                    { label: '⚡ ماسنجر', fn: shareOnMessenger, bg: 'rgba(0,132,255,.1)' },
                  ].map((b) => (
                    <button key={b.label} onClick={b.fn} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--line)', background: b.bg, color: 'var(--text)', fontFamily: 'Cairo, sans-serif', fontWeight: 800, cursor: 'pointer' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>⏳ جاري تحميل رابط الدعوة... حاول مجدداً بعد لحظة</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
