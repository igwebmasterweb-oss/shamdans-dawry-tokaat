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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!homeTeam || !awayTeam) {
      setLoaded(false);
      setPlayers([]);
      return;
    }

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
        onChange={e => onChange(e.target.value)}
        className="field-input"
        placeholder="..."
        style={{ flex: 1 }}
      />
    );
  }

  const filtered = players.filter(p =>
    p.player_name.toLowerCase().includes(search.toLowerCase())
  );

  const homePlayers = filtered.filter(p => p.team_name === homeTeam);
  const awayPlayers = filtered.filter(p => p.team_name === awayTeam);

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
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
        <span>{!loaded ? '...' : value || '...'}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && loaded && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            left: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,.5)',
            zIndex: 100,
            maxHeight: 280,
            overflowY: 'auto',
            direction: 'rtl',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--line)',
              position: 'sticky',
              top: 0,
              background: 'var(--surface-2)',
            }}
          >
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="..."
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

          {homePlayers.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
                {homeTeam}
              </div>
              {homePlayers.map(p => (
                <button
                  key={`${p.team_name}-${p.player_name}`}
                  type="button"
                  onClick={() => {
                    onChange(p.player_name);
                    setOpen(false);
                    setSearch('');
                  }}
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
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 22 }}>
                    {p.position?.[0] ?? ''}
                  </span>
                  {p.player_name}
                </button>
              ))}
            </>
          )}

          {awayPlayers.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: '#7db1ff', fontWeight: 700 }}>
                {awayTeam}
              </div>
              {awayPlayers.map(p => (
                <button
                  key={`${p.team_name}-${p.player_name}`}
                  type="button"
                  onClick={() => {
                    onChange(p.player_name);
                    setOpen(false);
                    setSearch('');
                  }}
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
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 22 }}>
                    {p.position?.[0] ?? ''}
                  </span>
                  {p.player_name}
                </button>
              ))}
            </>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              ...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ✨ useCountdown — عداد تنازلي للمباراة القادمة
function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetDate) { setTimeLeft(''); return; }
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('الآن!'); return; }
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

// ✨ useCountUp — animates number from old to new value
function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current;
    const end   = target;
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
  const extractScorersList = (raw: any, fallbackFirst?: string | null) => {
    const names: string[] = [];
    const addName = (value: any) => {
      if (!value || typeof value !== 'string') return;
      const cleaned = value.trim();
      if (cleaned && !names.includes(cleaned)) names.push(cleaned);
    };

    addName(fallbackFirst || '');

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (typeof item === 'string') {
            addName(item);
            return;
          }
          if (item && typeof item === 'object') {
            addName(item.player_name);
            addName(item.scorer_name);
            addName(item.name);
            addName(item.player?.name);
          }
        });

        return names;
      }

      if (parsed && typeof parsed === 'object') {
        const walk = (node: any) => {
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(walk);
            return;
          }
          if (typeof node === 'string') {
            addName(node);
            return;
          }
          if (typeof node !== 'object') return;

          addName(node.player_name);
          addName(node.scorer_name);
          addName(node.name);
          addName(node.player?.name);
          Object.values(node).forEach(walk);
        };

        walk(parsed);
      }
    } catch {
      if (typeof raw === 'string') addName(raw);
    }

    return names;
  };

  const [user, setUser]                     = useState<any>(null);
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [matches, setMatches]               = useState<any[]>([]);
  const [predictions, setPredictions]       = useState<any[]>([]);
  const [leaderboard, setLeaderboard]       = useState<any[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(false);
  const [activeTab, setActiveTab]           = useState<'predict' | 'my' | 'leaders' | 'roundleaders' | 'feed' | 'history'>('predict');
  const [activeRound, setActiveRound]       = useState('');
  const [roundLeaderboardRows, setRoundLeaderboardRows] = useState<any[]>([]);
  const [roundLeaderLoading, setRoundLeaderLoading] = useState(false);
  const [predForms, setPredForms]           = useState<Record<number, any>>({});
  const [submitting, setSubmitting]         = useState<number | null>(null);
  const [messages, setMessages]             = useState<Record<number, string>>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLeaderDetails, setShowLeaderDetails] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<any>(null);
  const [selectedLeaderSummary, setSelectedLeaderSummary] = useState<any>(null);
  const [selectedLeaderPredictions, setSelectedLeaderPredictions] = useState<any[]>([]);
  const [leaderDetailsLoading, setLeaderDetailsLoading] = useState(false);
  const [profileForm, setProfileForm]       = useState({ display_name: '', phone: '', facebook_url: '', email: '' });
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileMsg, setProfileMsg]         = useState('');
  const [referralCode, setReferralCode]     = useState('');
  const [referralCount, setReferralCount]   = useState(0);
  const [referralPoints, setReferralPoints]   = useState(0);
const [bonusPoints, setBonusPoints]         = useState(0);
const [profileCompleted, setProfileCompleted] = useState(false);
  const [myTotalPoints, setMyTotalPoints]   = useState(0);
  const [showReferral, setShowReferral]     = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [leagueJoinMsg, setLeagueJoinMsg]   = useState('');
  const [socialFeed, setSocialFeed]         = useState<any[]>([]);
  const [historyRankings, setHistoryRankings] = useState<any[]>([]);
  const [historyDates, setHistoryDates]     = useState<string[]>([]);
  const [activeHistoryDate, setActiveHistoryDate] = useState('');
  const [pointsBreakdown, setPointsBreakdown] = useState<any[]>([]);
  const [leagueCode, setLeagueCode]         = useState('');
  const [leagueJoining, setLeagueJoining]   = useState(false);
  const [leagueQuickMsg, setLeagueQuickMsg] = useState('');
  const [upcomingAlert, setUpcomingAlert]   = useState<any | null>(null);
  const [pushEnabled, setPushEnabled]       = useState(false);
  const [pushLoading, setPushLoading]       = useState(false);
  const [collapsedMatches, setCollapsedMatches] = useState<Record<number, boolean>>({});
  const addProfilePoints = (total = 0, completed = false) =>
  total + (completed ? 5 : 0);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setPushEnabled(true);
      });
    });
  }, []);

  const router = useRouter();
  const animatedPoints = useCountUp(myTotalPoints);
  const countdown = useCountdown(upcomingAlert?.fixture?.date ?? null);

  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
    'Round of 16':     'دور الـ 16',
    'Quarter-finals':  'ربع النهائي',
    'Semi-finals':     'نصف النهائي',
    '3rd Place Final': 'مباراة الثالث',
    'Final':           'النهائي',
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
  data: {
    referral_code: pendingRef,
    display_name:
      profile?.full_name?.trim() ||
      profileForm.display_name?.trim() ||
      user?.email?.split('@')[0] ||
      '',
    user_email: user?.email || null,
  },
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
  data: {
    league_name: lgData.name,
    league_id: lgData.id,
    display_name:
      profile?.full_name?.trim() ||
      profileForm.display_name?.trim() ||
      user?.email?.split('@')[0] ||
      '',
    user_email: user?.email || null,
  },
});
              if (typeof window !== 'undefined')
                window.sessionStorage.setItem('leagueJoinedMsg', `✅ انضممت لليج "${lgData.name}" بنجاح! 🏆`);
            }
          }
        } catch (e) { console.error('League auto-join error:', e); }
      }

      const [
        profileRes, profilesRes, sessionRes, fixturesApiRes, sbFixturesRes,
        userPredsRes, myPointsRowRes, feedDataRes, histDataRes, userPointsDataRes, participantsCountRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('profiles').select('id, full_name'),
        supabase.auth.getSession(),
        fetch('/api/fixtures').then(res => res.json()),
        supabase.from('fixtures').select(
          'api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,scorers_json,went_extra_time,red_card_in_match,penalty_in_match,both_teams_scored,home_team_name,away_team_name'
        ),
        supabase.from('predictions').select('*').eq('user_id', userId),
        supabase.from('user_points').select('referral_count,total_points,referral_points,bonus_points,profile_completed').eq('user_id', userId).maybeSingle(),
        supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('historical_rankings').select('*').order('week_start', { ascending: false }).order('total_points', { ascending: false }),
        supabase.from('user_points').select('*').order('total_points', { ascending: false }),
        supabase.from('user_points').select('*', { count: 'exact', head: true }),
      ]);

      const profileData    = profileRes.data;
      const profilesData   = profilesRes.data;
      const sessionData    = sessionRes.data;
      const apiMatches     = (fixturesApiRes as any)?.response || [];
      const sbFixtures     = sbFixturesRes.data;
      const userPreds      = userPredsRes.data;
      const myPointsRow    = myPointsRowRes.data;
      const finalReferralCode = profileData?.referral_code || '';
      const feedData       = feedDataRes.data;
      const histData       = histDataRes.data;
      const userPointsData    = userPointsDataRes.data;
      const participantsCount  = participantsCountRes.count ?? 0;
      setTotalParticipants(participantsCount);

const userNameMap: Record<string, string> = {};

(profilesData || []).forEach((row: any) => {
  if (!row?.id) return;

  const bestName =
    row.full_name?.trim() ||
    '';

  if (bestName) {
    userNameMap[row.id] = bestName;
  }
});

(userPointsData || []).forEach((row: any) => {
  if (!row?.user_id) return;

  const bestName =
    row.full_name?.trim() ||
    row.user_email?.split('@')[0] ||
    '';

  if (!userNameMap[row.user_id] && bestName) {
    userNameMap[row.user_id] = bestName;
  }
});

      if (profileData) {
        setProfile(profileData);
        const provider = sessionData?.session?.user?.app_metadata?.provider;
        const fbName   = sessionData?.session?.user?.user_metadata?.name || '';
        const fbMeta   = provider === 'facebook' && fbName ? `https://facebook.com/${fbName}` : null;
        setProfileForm({
          display_name: profileData.full_name || '',
          phone:        profileData.phone || '',
          facebook_url: profileData.facebook_url || fbMeta || '',
          email:        sessionData?.session?.user?.email || '',
        });
      }

      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb: any = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open:           sb?.is_open           ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer:      sb?.first_scorer      ?? '',
          scorers_json:      sb?.scorers_json      ?? null,
          went_extra_time:   sb?.went_extra_time   ?? false,
          red_card_in_match: sb?.red_card_in_match ?? false,
          penalty_in_match:  sb?.penalty_in_match  ?? false,
          both_teams_scored: sb?.both_teams_scored ?? false,
          db_home_team:      sb?.home_team_name    ?? m.teams.home.name,
          db_away_team:      sb?.away_team_name    ?? m.teams.away.name,
        };
      });
      setMatches(merged);

      const availableRounds = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (availableRounds.length > 0) {
        const openRound = availableRounds.find(round =>
          merged.some((m: any) => m.league?.round === round && m.is_open === true && m.actual_home_score === null)
        );
        setActiveRound(prev =>
          availableRounds.includes(prev) ? prev : (openRound ?? availableRounds[0])
        );
      }

      const fixtureNameMap = new Map<number, { home_team: string; away_team: string }>(merged.map((m: any) => [
        m.fixture.id,
        {
          home_team: m.db_home_team || m.teams?.home?.name || '',
          away_team: m.db_away_team || m.teams?.away?.name || '',
        }
      ]));

      const normalizedUserPreds = (userPreds || []).map((p: any) => {
        const matchNames = fixtureNameMap.get(p.fixture_id);
        return {
          ...p,
          home_team: p.home_team || matchNames?.home_team || '',
          away_team: p.away_team || matchNames?.away_team || '',
          predicted_red_card: p.predicted_red_card === true || p.predicted_red_card === 'true' || p.predicted_red_card === 1,
          predicted_penalty: p.predicted_penalty === true || p.predicted_penalty === 'true' || p.predicted_penalty === 1,
          predicted_both_teams: p.predicted_both_teams === true || p.predicted_both_teams === 'true' || p.predicted_both_teams === 1,
        };
      });

      const openUnpredicted = merged.find((m: any) => {
        const hasResult = m.actual_home_score !== null;
        const predicted = normalizedUserPreds.find((p: any) => p.fixture_id === m.fixture.id);
        return m.is_open && !hasResult && !predicted;
      });
      setUpcomingAlert(openUnpredicted || null);

      setPredictions(normalizedUserPreds);

     if (myPointsRow) {
  setReferralCode(finalReferralCode);
  setReferralCount(myPointsRow.referral_count || 0);
  setMyTotalPoints(myPointsRow.total_points || 0);
  setReferralPoints(myPointsRow.referral_points || 0);
  setBonusPoints(myPointsRow.bonus_points || 0);
  setProfileCompleted(myPointsRow.profile_completed || false);
} else {
  const myRow = (userPointsData || []).find((r: any) => r.user_id === userId);
  setReferralCode(finalReferralCode);
  setReferralCount(myRow?.referral_count || 0);
  setMyTotalPoints(myRow?.total_points || 0);
  setReferralPoints(myRow?.referral_points || 0);
  setBonusPoints(myRow?.bonus_points || 0);
  setProfileCompleted(myRow?.profile_completed || false);
      }

     setSocialFeed((feedData || []).map((item: any) => {
  const fallbackName =
    item?.data?.display_name?.trim() ||
    item?.data?.full_name?.trim() ||
    item?.data?.user_name?.trim() ||
    item?.data?.name?.trim() ||
    item?.data?.user_email?.split('@')[0] ||
    item?.user_email?.split('@')[0] ||
    '';

  return {
    ...item,
    user_name: userNameMap[item.user_id] || fallbackName || 'لاعب',
  };
}));
      if (histData && histData.length > 0) {
        const normalizedHist = histData
          .map((row: any) => ({
            ...row,
            week_start: row.week_start ? String(row.week_start).slice(0, 10) : '',
          }))
          .filter((row: any) => row.week_start)
          .sort((a: any, b: any) => {
            if (a.week_start === b.week_start) return (b.total_points || 0) - (a.total_points || 0);
            return String(b.week_start).localeCompare(String(a.week_start));
          });
        const dates = [...new Set(normalizedHist.map((r: any) => r.week_start))].sort((a: string, b: string) => b.localeCompare(a)) as string[];
        setHistoryDates(dates);
        setActiveHistoryDate(prev => {
          const normalizedPrev = prev ? String(prev).slice(0, 10) : '';
          return normalizedPrev && dates.includes(normalizedPrev) ? normalizedPrev : dates[0];
        });
        // dedupe: keep highest total_points per user_id per day, then top 25 per day
        const dedupeMap = new Map<string, any>();
        for (const row of normalizedHist) {
          const key = `${row.week_start}__${row.user_id}`;
          const existing = dedupeMap.get(key);
          if (!existing || (row.total_points || 0) > (existing.total_points || 0)) {
            dedupeMap.set(key, row);
          }
        }
        const deduped = Array.from(dedupeMap.values())
          .sort((a: any, b: any) => {
            if (a.week_start === b.week_start) return (b.total_points || 0) - (a.total_points || 0);
            return String(b.week_start).localeCompare(String(a.week_start));
          });
        // top 25 per day
        const top25PerDay: any[] = [];
        const dayCount = new Map<string, number>();
        for (const row of deduped) {
          const count = dayCount.get(row.week_start) || 0;
          if (count < 25) {
            top25PerDay.push(row);
            dayCount.set(row.week_start, count + 1);
          }
        }
        setHistoryRankings(top25PerDay.map((row: any) => ({
  ...row,
  display_name:
    userNameMap[row.user_id] ||
    row.display_name?.trim() ||
    row.full_name?.trim() ||
    row.user_email?.split('@')[0] ||
    'لاعب',
})));
      } else {
        setHistoryDates([]);
        setActiveHistoryDate('');
        setHistoryRankings([]);
      }

      setLeaderboard((userPointsData || []).map((row: any) => ({
        user_id:           row.user_id,
        user_email:        row.user_email,
        display_name:      row.full_name || null,
        profile_completed: row.profile_completed || false,
        totalPoints: addProfilePoints(row.total_points || 0, !!row.profile_completed),
        count:             row.predictions_count || 0,
      })));

      const breakdown = normalizedUserPreds
        .filter((p: any) => p.points !== null && p.points !== undefined && p.points >= 0)
        .sort((a: any, b: any) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
      setPointsBreakdown(breakdown);

    } catch (err) { console.error(err); setLoadError(true); }
    setLoading(false);
  };

useEffect(() => {
  if (!activeRound) {
    setRoundLeaderboardRows([]);
    return;
  }

  let cancelled = false;
  setRoundLeaderLoading(true);

  (async () => {
    try {
      const { data, error } = await supabase.rpc('get_round_leaderboard', { p_round: activeRound });

      if (cancelled) return;
      if (error) throw error;

      setRoundLeaderboardRows(data || []);
      setRoundLeaderLoading(false);
    } catch (error) {
      if (cancelled) return;
      console.error('round leaderboard load error', error);
      setRoundLeaderboardRows([]);
      setRoundLeaderLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [activeRound]);





const quickJoinLeague = async () => {
  if (!user || !leagueCode.trim()) return;
  setLeagueJoining(true);
  setLeagueQuickMsg('');

  try {
    const code = leagueCode.trim().toUpperCase();

    const { data: lgData, error: leagueErr } = await supabase
      .from('mini_leagues')
      .select('id, name')
      .eq('code', code)
      .maybeSingle();

    if (leagueErr) throw leagueErr;

    if (!lgData) {
      setLeagueQuickMsg('❌ كود غير صحيح');
      return;
    }

    const { data: already, error: alreadyErr } = await supabase
      .from('mini_league_members')
      .select('id')
      .eq('league_id', lgData.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (alreadyErr) throw alreadyErr;

    if (already) {
      setLeagueQuickMsg(`✅ أنت بالفعل عضو في "${lgData.name}"`);
      return;
    }

    const { error: joinErr } = await supabase
      .from('mini_league_members')
      .insert({
        league_id: lgData.id,
        user_id: user.id,
        role: 'member',
      });

    if (joinErr) throw joinErr;

    const { error: feedErr } = await supabase
      .from('social_feed')
      .insert({
        user_id: user.id,
        type: 'joined_league',
        data: {
          league_name: lgData.name,
          league_id: lgData.id,
          display_name:
            profile?.full_name?.trim() ||
            profileForm.display_name?.trim() ||
            user.email?.split('@')[0] ||
            '',
          user_email: user.email || null,
        },
      });

    if (feedErr) console.error('social_feed insert error:', feedErr);

    setLeagueQuickMsg(`🎉 انضممت لـ "${lgData.name}" بنجاح!`);
    setLeagueCode('');
    await loadData(user.id);
  } catch (err: any) {
    console.error('quickJoinLeague error:', err);
    setLeagueQuickMsg(`❌ ${err.message || 'حدث خطأ، حاول مجدداً'}`);
  } finally {
    setLeagueJoining(false);
  }
};
  
  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    if (!profileForm.display_name.trim() || !profileForm.phone.trim() || !profileForm.facebook_url.trim() || !profileForm.email.trim()) {
      setProfileMsg('❌ لازم تملى الاسم + التليفون + الإيميل + رابط فيسبوك');
      setProfileSaving(false);
      return;
    }
    const fbUrl   = profileForm.facebook_url.trim();
    const emailValue = profileForm.email.trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    const fbValid = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/.+/i.test(fbUrl);
    if (!emailValid) {
      setProfileMsg('❌ البريد الإلكتروني غير صحيح');
      setProfileSaving(false);
      return;
    }
    if (!fbValid) {
      setProfileMsg('❌ رابط فيسبوك غير صحيح، يجب أن يبدأ بـ https://facebook.com/');
      setProfileSaving(false);
      return;
    }
    try {
      const { data: currentProfile } = await supabase
        .from('profiles').select('referral_code, facebook_bonus_awarded, bonus_points_awarded, profile_completed')
        .eq('id', user.id).maybeSingle();
      const updates: any = {
        id:                   user.id,
        full_name:            profileForm.display_name.trim(),
        phone:                profileForm.phone.trim() || null,
        facebook_url:         fbUrl,
        profile_completed:    true,
        bonus_points_awarded: currentProfile?.bonus_points_awarded ?? false,
        updated_at:           new Date().toISOString(),
        referral_code:        currentProfile?.referral_code ?? null,
        facebook_bonus_awarded: currentProfile?.facebook_bonus_awarded ?? false,
      };
      const { error } = await supabase.from('profiles').upsert(updates);
if (error) throw error;

const { error: syncUserPointsError } = await supabase
  .from('user_points')
  .upsert(
    {
      user_id: user.id,
      full_name: profileForm.display_name.trim(),
      user_email: emailValue,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

if (syncUserPointsError) throw syncUserPointsError;

const { error: refreshPointsError } = await supabase.rpc('refreshuserpoints', {
  p_userid: user.id,
});

if (refreshPointsError) throw refreshPointsError;
      const alreadyHadProfileBonus = !!(profile?.bonus_points_awarded || currentProfile?.bonus_points_awarded || profileCompleted || currentProfile?.profile_completed);
      if (!alreadyHadProfileBonus) {
        await supabase.from('social_feed').insert({
  user_id: user.id,
  type: 'completed_profile',
  data: {
    display_name: profileForm.display_name.trim(),
    user_email: user.email || null,
  },
});
      }
      setProfileMsg(alreadyHadProfileBonus ? '✅ تم حفظ البيانات وتحديث الإيميل بنجاح' : '✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉');
      await loadData(user.id);
      setTimeout(() => { setShowProfileModal(false); setProfileMsg(''); }, 2500);
    } catch { setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً'); }
    setProfileSaving(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id === match.fixture.id);
    return {
      homeScore:            ex?.predicted_home_score  ?? 0,
      awayScore:            ex?.predicted_away_score  ?? 0,
      firstScorer:          ex?.predicted_first_scorer ?? '',
      extraTime:            ex?.predicted_extra_time  ?? false,
      predicted_red_card:   ex?.predicted_red_card    ?? false,
      predicted_penalty:    ex?.predicted_penalty     ?? false,
      predicted_both_teams: ex?.predicted_both_teams  ?? false,
    };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms(prev => ({ ...prev, [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch } }));

 // Updated file prepared with only submitPrediction hardening change.
// NOTE: This downloadable artifact contains the exact safe replacement function
// to paste into your live file, because the attached source is truncated in retrieval.

const submitPrediction = async (match: any) => {
  if (!user) return;

  if (!match?.is_open) {
    setMessages(m => ({ ...m, [match.fixture.id]: '🔒 تم إغلاق التوقعات لهذه المباراة' }));
    setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    return;
  }

  setSubmitting(match.fixture.id);
  const form = getForm(match);

  try {
    const ex = predictions.find((p: any) => p.fixture_id === match.fixture.id);

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
      const { error } = await supabase
        .from('predictions')
        .update(payload)
        .eq('id', ex.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('predictions')
        .insert(payload);

      if (error) throw error;

      const { error: feedError } = await supabase.from('social_feed').insert({
        user_id: user.id,
        type: 'share_predictions',
        data: {
          home: match.teams.home.name,
          away: match.teams.away.name,
          fixture_id: match.fixture.id,
          display_name:
            profile?.full_name?.trim() ||
            profileForm.display_name?.trim() ||
            user.email?.split('@')[0] ||
            '',
          user_email: user.email || null,
        },
      });

      if (feedError) console.error('social_feed insert error:', feedError);
    }

    const { data, error: reloadError } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id);

    if (reloadError) throw reloadError;

    setPredictions(data || []);
    setMessages(m => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
    setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
  } catch (err) {
    console.error('submitPrediction error:', err);
    setMessages(m => ({ ...m, [match.fixture.id]: '❌ تعذر حفظ التوقع' }));
    setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
  } finally {
    setSubmitting(null);
  }
};
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const handlePushSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('المتصفح ده مش بيدعم الإشعارات. استخدم Chrome أو Edge');
      return;
    }
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setPushEnabled(true); setPushLoading(false); return; }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushLoading(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
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
      case 'invite_friend':    return '🎉 دعا صديقاً جديداً وربح نقاط!';
      case 'joined_league':    return `🏆 انضم للبطولة ${data?.league_name || ''}`;
      case 'share_league':     return '🔗 شارك رابط البطولة';
      case 'completed_profile':return '✅ أكمل بياناته الشخصية وربح 5 نقاط!';
      case 'share_predictions':return `⚽ شارك توقعاته (${data?.home || ''} × ${data?.away || ''})`;
      default:                 return '🔔 نشاط جديد';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const getReferralLink   = () => {
    if (!referralCode) return '';
    if (typeof window === 'undefined') return `/login?ref=${referralCode}`;
    return `${window.location.origin}/login?ref=${referralCode}`;
  };
  const copyReferralLink  = () => {
    const link = getReferralLink();
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(() => { setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2500); });
  };
  const shareOnWhatsApp   = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    const txt = encodeURIComponent(`🏆 انضم لمنافسة الشمعدان × كأس العالم 2026!\nسجّل عن طريق رابطي واحصل على نقاط إضافية:\n${link}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };
  const shareOnFacebook   = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank', 'width=600,height=400');
  };
  const shareOnMessenger  = () => {
    const link = getReferralLink();
    if (!link || typeof window === 'undefined') return;
    const url = encodeURIComponent(link);
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=1302682795390354&redirect_uri=${url}`, '_blank');
  };

  const openLeaderDetails = async (player: any) => {
    try {
      setSelectedLeader(player);
      setShowLeaderDetails(true);
      setLeaderDetailsLoading(true);
      setSelectedLeaderSummary(null);
      setSelectedLeaderPredictions([]);

      const { data: summaryData } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', player.user_id)
        .maybeSingle();

      const { data: predsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', player.user_id)
        .order('submitted_at', { ascending: false });

      const fixtureNameMap = new Map<number, { home_team: string; away_team: string }>(matches.map((m: any) => [
        m.fixture.id,
        {
          home_team: m.db_home_team || m.teams?.home?.name || '',
          away_team: m.db_away_team || m.teams?.away?.name || '',
        }
      ]));

      const fixtureDetailsMap = new Map<number, any>(matches.map((m: any) => [m.fixture.id, m]));

    const normalizedPreds = (predsData || []).map((pred: any) => {
  const fixtureId = pred.fixture_id || pred.api_fixture_id;
  const matchNames = fixtureNameMap.get(fixtureId);
  const matchInfo = fixtureDetailsMap.get(fixtureId);

  return {
    ...pred,
    home_team: pred.home_team || matchNames?.home_team || '',
    away_team: pred.away_team || matchNames?.away_team || '',
    fixture_date: matchInfo?.fixture?.date || null,
    round: matchInfo?.round || matchInfo?.league?.round || null,
    actual_home_score: matchInfo?.actual_home_score ?? pred.actual_home_score ?? null,
    actual_away_score: matchInfo?.actual_away_score ?? pred.actual_away_score ?? null,
    first_scorer_actual: matchInfo?.first_scorer || null,
    red_card_in_match: matchInfo?.red_card_in_match ?? null,
    penalty_in_match: matchInfo?.penalty_in_match ?? null,
    both_teams_scored: matchInfo?.both_teams_scored ?? null,
    went_extra_time: matchInfo?.went_extra_time ?? null,
  };
})
.filter((pred: any) => pred.home_team || pred.away_team)
.sort((a: any, b: any) => {
  const dateA = a.fixture_date ? new Date(a.fixture_date).getTime() : 0;
  const dateB = b.fixture_date ? new Date(b.fixture_date).getTime() : 0;
  return dateA - dateB;
});

setSelectedLeaderSummary(summaryData || null);
setSelectedLeaderPredictions(normalizedPreds);
    } catch (err) {
      console.error('openLeaderDetails error:', err);
      setSelectedLeaderSummary(null);
      setSelectedLeaderPredictions([]);
    } finally {
      setLeaderDetailsLoading(false);
    }
  };

  if (loadError) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', gap: 16, padding: 24,
        fontFamily: 'Cairo, sans-serif', direction: 'rtl',
      }}>
        <div style={{ fontSize: 56 }}>⚠️</div>
        <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
          حدث خطأ أثناء تحميل البيانات
        </p>
        <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
          تحقق من اتصالك بالإنترنت وحاول مجدداً
        </p>
        <button
          onClick={() => { if (user) { setLoading(true); loadData(user.id); } }}
          style={{
            padding: '12px 32px', borderRadius: 14, border: 'none',
            background: 'var(--gold)', color: '#1a1200',
            fontFamily: 'Cairo, sans-serif', fontSize: 16, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🔄 إعادة المحاولة
        </button>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Cairo, sans-serif', background: '#070809', color: '#d9b25f' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>جاري التحميل...</div>
      </div>
    </div>
  );

 const myPoints = addProfilePoints(myTotalPoints, profileCompleted);
  const myRank      = leaderboard.findIndex(p => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const predictionOnlyPoints = predictions
    .reduce((sum: number, pr: any) => sum + (Number(pr?.points) || 0), 0);
  const myRoundPts = predictions
    .filter((pr: any) => filteredMatches.some((m: any) => m.fixture.id === pr.fixture_id))
    .reduce((sum: number, pr: any) => sum + (Number(pr?.points) || 0), 0);

  const getMatchCollapsed = (fixtureId: number) =>
    collapsedMatches[fixtureId] ?? true;

  const toggleMatchCollapsed = (fixtureId: number) => {
    setCollapsedMatches((prev) => ({
      ...prev,
      [fixtureId]: !(prev[fixtureId] ?? true),
    }));
  };

  const expandAllMatches = () => {
    setCollapsedMatches(
      Object.fromEntries(filteredMatches.map((m: any) => [m.fixture.id, false]))
    );
  };

  const collapseAllMatches = () => {
    setCollapsedMatches(
      Object.fromEntries(filteredMatches.map((m: any) => [m.fixture.id, true]))
    );
  };

  const resolvedPreds  = predictions.filter((p: any) => p.actual_home_score !== null);
  const correctPreds   = resolvedPreds.filter((p: any) => p.points && p.points > 0);
  const accuracyPct    = resolvedPreds.length > 0
  ? Math.round((correctPreds.length / resolvedPreds.length) * 100) : 0;
const maxPossible    = resolvedPreds.length * 19;
const efficiencyPct  = maxPossible > 0
  ? Math.round((predictionOnlyPoints / maxPossible) * 100) : 0;

  const roundsWithPred = new Set(
    predictions.map((p: any) => {
      const m = matches.find((m: any) => m.fixture.id === p.fixture_id);
      return m?.league?.round;
    }).filter(Boolean)
  );
  const streakCount = roundsWithPred.size;

  const roundTotal   = filteredMatches.length;
  const roundDone    = filteredMatches.filter(m =>
    predictions.find((p: any) => p.fixture_id === m.fixture.id)
  ).length;
  const roundPct     = roundTotal > 0 ? Math.round((roundDone / roundTotal) * 100) : 0;

  const openUnpredictedCount = matches.filter((m: any) =>
    m.is_open && m.actual_home_score === null &&
    !predictions.find((p: any) => p.fixture_id === m.fixture.id)
  ).length;
  const medals      = ['🥇', '🥈', '🥉'];
  const displayName = profile?.full_name || user?.email?.split('@')[0];
  const profileIncomplete = !profile?.profile_completed;
const myPredictionsSorted = [...predictions].sort((a: any, b: any) => {
  const aFinished = a.actual_home_score !== null && a.actual_home_score !== undefined;
  const bFinished = b.actual_home_score !== null && b.actual_home_score !== undefined;

  if (aFinished !== bFinished) return aFinished ? -1 : 1;

  const matchA = matches.find((m: any) => m.fixture.id === a.fixture_id);
  const matchB = matches.find((m: any) => m.fixture.id === b.fixture_id);

  const dateA = matchA?.fixture?.date ? new Date(matchA.fixture.date).getTime() : 0;
  const dateB = matchB?.fixture?.date ? new Date(matchB.fixture.date).getTime() : 0;

  if (aFinished && bFinished) return dateA - dateB;
  return dateA - dateB;
});
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
                      radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%),#070809;
          color: var(--text); direction: rtl; min-height: 100vh;
        }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        .tab-btn { padding:10px 22px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; transition:all .2s; }
        .tab-btn.active { background:linear-gradient(90deg,rgba(217,178,95,.18),rgba(217,178,95,.06)); border-color:rgba(217,178,95,.3); color:#fff1ce; }
        .round-btn { padding:8px 16px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:all .2s; }
        .round-btn.active { color:#fff1ce; border-color:rgba(217,178,95,.3); background:rgba(217,178,95,.12); }
        .match-card { background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015)); border:1px solid var(--line); border-radius:24px; padding:20px; margin-bottom:14px; box-shadow:var(--shadow); }
        .pill-open   { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid rgba(39,176,110,.25); background:rgba(39,176,110,.12); color:#94f0c0; }
        .pill-closed { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid var(--line); background:var(--surface-3); color:var(--muted); }
        .pill-saved  { font-size:12px; padding:6px 12px; border-radius:999px; font-weight:700; border:1px solid rgba(217,178,95,.25); background:rgba(217,178,95,.1); color:#ffe3a6; }
        .score-row  { display:flex; align-items:center; gap:12px; background:var(--surface-2); border:1px solid var(--line); border-radius:18px; padding:12px 16px; margin-bottom:10px; }
        .score-btn  { width:38px; height:38px; border-radius:12px; border:1px solid var(--line); background:var(--surface-3); color:var(--text); font-size:20px; font-weight:800; display:grid; place-items:center; cursor:pointer; transition:all .2s; font-family:'Cairo',sans-serif; }
        .score-btn.plus { background:linear-gradient(135deg,#e0bc73,#b9892d); border:none; color:#231a0c; }
        .score-val  { font-size:22px; font-weight:800; min-width:32px; text-align:center; font-variant-numeric:tabular-nums; }
        .field-row  { display:flex; align-items:center; gap:10px; background:var(--surface-2); border:1px solid var(--line); border-radius:18px; padding:12px 16px; margin-bottom:10px; }
        .field-input { flex:1; background:transparent; border:none; outline:none; color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; font-weight:600; text-align:right; }
        .field-input::placeholder { color:var(--muted); }
        .field-label { font-size:13px; color:var(--muted); font-weight:700; white-space:nowrap; }
        .points-tag { font-size:11px; padding:4px 10px; border-radius:999px; font-weight:700; white-space:nowrap; }
        .save-btn { width:100%; padding:14px; border-radius:18px; background:linear-gradient(135deg,#e0bc73,#b9892d); border:none; color:#211708; font-weight:800; font-size:15px; font-family:'Cairo',sans-serif; cursor:pointer; box-shadow:0 8px 24px rgba(217,178,95,.2); transition:opacity .2s; }
        .save-btn:hover { opacity:.88; } .save-btn:disabled { opacity:.5; cursor:not-allowed; }
        .pred-box { background:rgba(217,178,95,.08); border:1px solid rgba(217,178,95,.18); border-radius:18px; padding:12px 16px; }
        .stat-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:12px 10px; }
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

      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))', borderBottom: '1px solid var(--line)', padding: '12px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo-FF.png" alt="شامدان دوري" width={36} height={36} style={{ objectFit: 'contain', display: 'block' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)', lineHeight: 1.2 }}>الشمعدان × كأس العالم</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>أهلاً {displayName}! 👋</div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(201,58,47,.3)', background: 'rgba(201,58,47,.08)', color: '#ff9e9e', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', flexShrink: 0 }}>
              خروج
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowProfileModal(true)} style={{ padding: '8px 14px', borderRadius: 12, cursor: 'pointer', border: profileIncomplete ? '1px solid rgba(217,178,95,.35)' : '1px solid var(--line)', background: profileIncomplete ? 'rgba(217,178,95,.08)' : 'var(--surface-2)', color: profileIncomplete ? '#f2d79e' : 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {profileIncomplete ? '🎁 أكمل ملفك +5 نقاط' : `✏️ ${displayName}`}
            </button>
            <Link href="/my-leagues" style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#93c5fd', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🏆 ليجاتي
            </Link>
            <button onClick={() => setShowReferral(true)} style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)', background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🎁 ادعُ صديق
              {referralCount > 0 && <span style={{ background: 'rgba(39,176,110,.2)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{referralCount}</span>}
            </button>
            <button
              onClick={handlePushSubscribe}
              disabled={pushEnabled || pushLoading}
              style={{ padding: '8px 14px', borderRadius: 12, border: pushEnabled ? '1px solid rgba(39,176,110,.3)' : '1px solid rgba(255,255,255,.12)', background: pushEnabled ? 'rgba(39,176,110,.08)' : 'var(--surface-2)', color: pushEnabled ? '#5effa8' : 'var(--muted)', cursor: pushEnabled ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pushLoading ? 0.6 : 1, transition: 'all .2s' }}
            >
              {pushEnabled ? '🔔 مفعّل' : pushLoading ? '...' : '🔔 إشعارات'}
            </button>
            <button
  onClick={() => setShowTerms(true)}
  style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}
>
  📜 الشروط والأحكام
</button>
          </div>
        </div>
      </div>

      {leagueJoinMsg && (
        <div style={{ background: 'rgba(39,176,110,.1)', borderBottom: '1px solid rgba(39,176,110,.2)', padding: '10px 20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#5effa8' }}>
          {leagueJoinMsg} <Link href="/my-leagues" style={{ color: '#5effa8', marginRight: 8 }}>اضغط هنا لرؤية الليج ←</Link>
        </div>
      )}

      {profileIncomplete ? (
        <div onClick={() => setShowProfileModal(true)} style={{ background: 'linear-gradient(90deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', borderBottom: '1px solid rgba(217,178,95,.18)', padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#f2d79e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً! <strong>اضغط هنا</strong>
        </div>
      ) : upcomingAlert ? (
        <div className="alert-banner pulse" style={{ background: 'rgba(59,130,246,.08)', borderBottom: '1px solid rgba(59,130,246,.2)', padding: '10px 20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span>⚡</span>
          <span>
            ⚡ <strong>{upcomingAlert.teams.home.name} × {upcomingAlert.teams.away.name}</strong>
            {countdown && <span style={{ marginRight: 8, background: 'rgba(59,130,246,.2)', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>⏱ {countdown}</span>}
          </span>
          <button onClick={() => { setActiveTab('predict'); setActiveRound(upcomingAlert.league.round); setUpcomingAlert(null); }} style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,.2)', border: '1px solid rgba(59,130,246,.3)', color: '#93c5fd', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>توقع الآن</button>
        </div>
      ) : !pushEnabled ? (
        <div
          className="alert-banner"
          onClick={handlePushSubscribe}
          style={{ background: 'rgba(59,130,246,.07)', borderBottom: '1px solid rgba(59,130,246,.18)', padding: '10px 20px', color: '#93c5fd', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {pushLoading ? '⏳ جاري تفعيل الإشعارات...' : '🔔 فعّل الإشعارات — احصل على تنبيه قبل كل مباراة بـ 5 ساعات'}
        </div>
      ) : null}

      {showLeaderDetails && (
        <div className="modal-overlay" onClick={() => setShowLeaderDetails(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 18 }}>
                  👤 {selectedLeader?.display_name || selectedLeader?.user_email?.split('@')[0] || 'المتسابق'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>تفاصيل الأداء وآخر التوقعات</div>
              </div>
              <button onClick={() => setShowLeaderDetails(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center', flexShrink: 0 }}>✕</button>
            </div>

            {leaderDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '42px 16px', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>جاري تحميل التفاصيل...</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>إجمالي النقاط</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
      {addProfilePoints(
  selectedLeaderSummary?.total_points ?? selectedLeader?.totalPoints ?? 0,
  selectedLeaderSummary?.profile_completed ?? selectedLeader?.profile_completed ?? false
)}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط التوقعات</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#ffe3a6', fontVariantNumeric: 'tabular-nums' }}>
      {selectedLeaderPredictions.reduce((sum: number, pred: any) => sum + (pred.points || 0), 0)}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط الدعوات</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>
      {selectedLeaderSummary?.referral_points ?? 0}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط إكمال البروفايل</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#7db1ff', fontVariantNumeric: 'tabular-nums' }}>
      {selectedLeaderSummary?.profile_completed ? 5 : 0}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط بونص مسابقة حلمك فيها</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#5effa8', fontVariantNumeric: 'tabular-nums' }}>
      {selectedLeaderSummary?.bonus_points ?? 0}
    </div>
    <a
      href="https://forms.gle/1pftaR7rV9SAJ2VL6"
      target="_blank"
      rel="noopener noreferrer"
      style={{ marginTop: 8, display: 'inline-block', fontSize: 12, color: '#7db1ff', textDecoration: 'underline' }}
    >
      شارك في مسابقة حلمك فيها
    </a>
  </div>
</div>

                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>📋 توقعات العضو</div>

                {(() => {
                  const now = new Date();
                  const currentMatch = [...matches]
                    .filter((m: any) => {
                      const matchDate = m?.fixture?.date ? new Date(m.fixture.date) : null;
                      const started = !!matchDate && matchDate <= now;
                      const hasFinalResult = m?.actual_home_score !== null && m?.actual_home_score !== undefined;
                      return started && !hasFinalResult;
                    })
                    .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())[0];

                  const currentFixtureId = Number(currentMatch?.fixture?.id);
                  const currentPrediction = currentMatch
                    ? selectedLeaderPredictions.find((pred: any) => Number(pred.fixture_id) === currentFixtureId || Number(pred.api_fixture_id) === currentFixtureId)
                    : null;
                  const currentMatchPredictionCount = currentMatch
                    ? selectedLeaderPredictions.filter((pred: any) => Number(pred.fixture_id) === currentFixtureId || Number(pred.api_fixture_id) === currentFixtureId).length
                    : 0;

                  const currentMatchDate = currentMatch?.fixture?.date
                    ? new Date(currentMatch.fixture.date).toLocaleDateString('ar-EG', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return currentMatch ? (
                    <div className="rank-item" style={{ marginBottom: 14, borderColor: 'rgba(59,130,246,.24)', background: 'linear-gradient(90deg,rgba(59,130,246,.10),rgba(255,255,255,.02))', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', whiteSpace: 'nowrap' }}>🔵 التوقع الحالي للماتش الجاري</div>
                        <div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,.10)', border: '1px solid rgba(59,130,246,.22)', color: '#93c5fd', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>بدأت المباراة</div>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', marginBottom: 6, whiteSpace: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
                        {currentMatch?.teams?.home?.logo && <img src={currentMatch.teams.home.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', borderRadius: 3, flex: '0 0 auto' }} />}
                        <span>{currentMatch?.teams?.home?.name || currentMatch?.home_team_name || 'صاحب الأرض'} × {currentMatch?.teams?.away?.name || currentMatch?.away_team_name || 'الضيف'}</span>
                        {currentMatch?.teams?.away?.logo && <img src={currentMatch.teams.away.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', borderRadius: 3, flex: '0 0 auto' }} />}
                      </div>

                      {currentMatchDate && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, whiteSpace: 'nowrap', overflowX: 'auto' }}>{currentMatchDate}</div>}

                      {currentPrediction ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                              <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>توقعه الآن</div>
                              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {currentPrediction.predicted_home_score} — {currentPrediction.predicted_away_score}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflowX: 'auto' }}>
                                ⚽ الهداف الأول: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{currentPrediction.predicted_first_scorer || 'لم يحدد'}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                  🟥 كارت أحمر: <span style={{ color: currentPrediction.predicted_red_card ? '#fca5a5' : 'var(--muted)', fontWeight: 700 }}>{currentPrediction.predicted_red_card ? 'نعم' : 'لا'}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                  ⚠️ ضربة جزاء: <span style={{ color: currentPrediction.predicted_penalty ? '#fde68a' : 'var(--muted)', fontWeight: 700 }}>{currentPrediction.predicted_penalty ? 'نعم' : 'لا'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ padding: '9px 12px', borderRadius: 12, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>حالة المباراة</div>
                            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>المباراة بدأت ولم تُحسم بعد</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.20)', color: '#ffb4b4', fontSize: 13, fontWeight: 700 }}>
                          لا يوجد توقع لهذا العضو على الماتش الجاري.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rank-item" style={{ marginBottom: 14, borderStyle: 'dashed', opacity: 0.9 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>🟡 التوقع الحالي للماتش الجاري</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
                        لا يوجد الآن ماتش جارٍ لعرض التوقع الحالي. سيظهر هنا تلقائيًا عند بدء أي مباراة وقبل تسجيل النتيجة النهائية.
                      </div>
                    </div>
                  );
                })()}

                {selectedLeaderPredictions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }} className="stat-card">
                    لا توجد توقعات متاحة لهذا المتسابق
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {selectedLeaderPredictions
                      .filter((pred: any) => {
                        const matchInfo = matches.find((m: any) => Number(m.fixture.id) === Number(pred.fixture_id || pred.api_fixture_id));
                        const started = matchInfo?.fixture?.date ? new Date(matchInfo.fixture.date) <= new Date() : false;
                        const hasResult = pred.actual_home_score !== null && pred.actual_home_score !== undefined;
                        return hasResult || !started;
                      })
                      .map((pred: any, idx: number) => {
                      const hasResult = pred.actual_home_score !== null && pred.actual_home_score !== undefined;
                      const matchDate = pred.fixture_date
                        ? new Date(pred.fixture_date).toLocaleDateString('ar-EG', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : null;
                      const predictedResult =
                        pred.predicted_home_score === pred.predicted_away_score
                          ? 'تعادل'
                          : pred.predicted_home_score > pred.predicted_away_score
                          ? 'فوز ' + (pred.home_team || 'صاحب الأرض')
                          : 'فوز ' + (pred.away_team || 'الضيف');
                      const actualResult = hasResult
                        ? pred.actual_home_score === pred.actual_away_score
                          ? 'تعادل'
                          : pred.actual_home_score > pred.actual_away_score
                          ? 'فوز ' + (pred.home_team || 'صاحب الأرض')
                          : 'فوز ' + (pred.away_team || 'الضيف')
                        : null;
                      const scoreExact = hasResult && pred.predicted_home_score === pred.actual_home_score && pred.predicted_away_score === pred.actual_away_score;
                      const directionCorrect = hasResult && predictedResult === actualResult;
                      const firstScorerExact = hasResult && pred.predicted_first_scorer && pred.first_scorer_actual && pred.predicted_first_scorer === pred.first_scorer_actual;
                      const firstScorerPicked = !!pred.predicted_first_scorer;
                      const extraChecks = [
                        pred.predicted_extra_time ? { label: '⏱ وقت إضافي', predicted: !!pred.predicted_extra_time, actual: !!pred.went_extra_time } : null,
                        pred.predicted_red_card ? { label: '🟥 كرت أحمر', predicted: !!pred.predicted_red_card, actual: !!pred.red_card_in_match } : null,
                        pred.predicted_penalty ? { label: '⚽ ضربة جزاء', predicted: !!pred.predicted_penalty, actual: !!pred.penalty_in_match } : null,
                        pred.predicted_both_teams ? { label: '🥅 الفريقان يسجلان', predicted: !!pred.predicted_both_teams, actual: !!pred.both_teams_scored } : null,
                      ].filter(Boolean) as any[];

                      return (
                        <div
                          key={pred.id || idx}
                          className="rank-item"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 14,
                            alignItems: 'stretch',
                            ...(hasResult && (pred.points || 0) >= 10
                              ? {
                                  borderColor: 'rgba(217,178,95,.28)',
                                  background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))',
                                }
                              : {}),
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {matches.find((m: any) => m.fixture.id === (pred.fixture_id || pred.api_fixture_id))?.teams?.home?.logo && <img src={matches.find((m: any) => m.fixture.id === (pred.fixture_id || pred.api_fixture_id))?.teams?.home?.logo} alt="" width={18} height={18} style={{ objectFit: 'contain', borderRadius: 3 }} />}
                                {pred.home_team && pred.away_team ? `${pred.home_team} × ${pred.away_team}` : `مباراة #${pred.fixture_id || pred.api_fixture_id || '—'}`}
                                {matches.find((m: any) => m.fixture.id === (pred.fixture_id || pred.api_fixture_id))?.teams?.away?.logo && <img src={matches.find((m: any) => m.fixture.id === (pred.fixture_id || pred.api_fixture_id))?.teams?.away?.logo} alt="" width={18} height={18} style={{ objectFit: 'contain', borderRadius: 3 }} />}
                              </div>

                              <div
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: hasResult ? 'rgba(39,176,110,.10)' : 'rgba(255,255,255,.04)',
                                  border: '1px solid var(--line)',
                                  color: hasResult ? '#94f0c0' : 'var(--muted)',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {hasResult ? 'تم الحسم' : 'بانتظار النتيجة'}
                              </div>
                            </div>

                            {matchDate && (
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                                {matchDate}
                              </div>
                            )}

                            {/* N5: 50/50 grid - توقعه | الفعلي */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                              {/* Left: توقعه */}
                              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
                                <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>توقعه</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                  {pred.predicted_home_score} — {pred.predicted_away_score}
                                </div>
                                {pred.predicted_first_scorer && (
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>⚽ {pred.predicted_first_scorer}</div>
                                )}
                              </div>
                              {/* Right: الفعلي */}
                              <div style={{ padding: '10px 12px', borderRadius: 12, background: hasResult ? 'rgba(39,176,110,.07)' : 'var(--surface-3)', border: hasResult ? '1px solid rgba(39,176,110,.2)' : '1px solid var(--line)' }}>
                                <div style={{ color: hasResult ? '#94f0c0' : 'var(--muted)', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>الفعلي</div>
                                {hasResult ? (
                                  <>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>
                                      {pred.actual_home_score} — {pred.actual_away_score}
                                    </div>
                                    {(() => {
                                      const matchInfo = matches.find((m: any) => m.fixture.id === (pred.fixture_id || pred.api_fixture_id));
                                      const scorers = extractScorersList(matchInfo?.scorers_json, pred.first_scorer_actual);
                                      return scorers.length > 0 ? (
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}><div style={{ color: 'var(--muted)', opacity: 0.8, marginBottom: 2 }}>الهدافون ({scorers.length})</div>
                                          {scorers.map((s, si) => <div key={si} style={{ display: 'block' }}>⚽ {s}</div>)}
                                        </div>
                                      ) : null;
                                    })()}
                                  </>
                                ) : (
                                  <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>لم تُحسم بعد</div>
                                )}
                              </div>
                            </div>

                            {hasResult && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    border: scoreExact ? '1px solid rgba(217,178,95,.24)' : '1px solid rgba(201,58,47,.24)',
                                    background: scoreExact ? 'rgba(217,178,95,.12)' : 'rgba(201,58,47,.12)',
                                    color: scoreExact ? '#ffe3a6' : '#ffb4b4',
                                  }}
                                >
                                  🎯 النتيجة الكاملة {scoreExact ? '✓' : '✕'}
                                </span>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    border: directionCorrect ? '1px solid rgba(39,176,110,.24)' : '1px solid rgba(201,58,47,.24)',
                                    background: directionCorrect ? 'rgba(39,176,110,.12)' : 'rgba(201,58,47,.12)',
                                    color: directionCorrect ? '#94f0c0' : '#ffb4b4',
                                  }}
                                >
                                  ✅ الاتجاه {directionCorrect ? '✓' : '✕'}
                                </span>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    border: !firstScorerPicked
                                      ? '1px dashed var(--line)'
                                      : firstScorerExact
                                      ? '1px solid rgba(39,176,110,.24)'
                                      : '1px solid rgba(201,58,47,.24)',
                                    background: !firstScorerPicked
                                      ? 'rgba(255,255,255,.03)'
                                      : firstScorerExact
                                      ? 'rgba(39,176,110,.12)'
                                      : 'rgba(201,58,47,.12)',
                                    color: !firstScorerPicked
                                      ? 'var(--muted)'
                                      : firstScorerExact
                                      ? '#94f0c0'
                                      : '#ffb4b4',
                                  }}
                                >
                                  ⚽ الهداف {firstScorerPicked ? (firstScorerExact ? '✓' : '✕') : '—'}
                                </span>

                                {extraChecks.length > 0 ? (
                                  extraChecks.map((item: any, extraIdx: number) => {
                                    const isCorrect = item.predicted === item.actual;
                                    return (
                                      <span
                                        key={extraIdx}
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: '6px 10px',
                                          borderRadius: 999,
                                          border: isCorrect
                                            ? '1px solid rgba(39,176,110,.24)'
                                            : '1px solid rgba(201,58,47,.24)',
                                          background: isCorrect
                                            ? 'rgba(39,176,110,.12)'
                                            : 'rgba(201,58,47,.12)',
                                          color: isCorrect ? '#94f0c0' : '#ffb4b4',
                                        }}
                                      >
                                        {item.label} {isCorrect ? '✓' : '✕'}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '6px 10px',
                                      borderRadius: 999,
                                      background: 'rgba(255,255,255,.03)',
                                      border: '1px dashed var(--line)',
                                      color: 'var(--muted)',
                                    }}
                                  >
                                    لا توجد اختيارات إضافية
                                  </span>
                                )}
                              </div>
                            )}

                            <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                              وقت إرسال التوقع: {pred.submitted_at ? new Date(pred.submitted_at).toLocaleString('ar-EG') : 'بدون تاريخ'}
                            </div>
                          </div>

                          {/* N8: negative/zero/positive points in modal */}
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 14,
                              background: !hasResult
                                ? 'var(--surface-3)'
                                : (pred.points || 0) < 0
                                ? 'rgba(201,58,47,.13)'
                                : (pred.points || 0) === 0
                                ? 'var(--surface-3)'
                                : (pred.points || 0) >= 10
                                ? 'rgba(217,178,95,.12)'
                                : 'rgba(39,176,110,.12)',
                              border: !hasResult
                                ? '1px solid var(--line)'
                                : (pred.points || 0) < 0
                                ? '1px solid rgba(201,58,47,.3)'
                                : '1px solid var(--line)',
                              color: !hasResult
                                ? 'var(--muted)'
                                : (pred.points || 0) < 0
                                ? '#ffb4b4'
                                : (pred.points || 0) === 0
                                ? 'var(--muted)'
                                : (pred.points || 0) >= 10
                                ? '#ffe3a6'
                                : '#94f0c0',
                              textAlign: 'center',
                              minWidth: 88,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                              {hasResult
                                ? (pred.points || 0) < 0
                                  ? <>⚠ {pred.points}</>
                                  : (pred.points || 0)
                                : '⏳'}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 4, color: hasResult ? 'inherit' : 'var(--muted)' }}>
                              {hasResult ? 'نقطة' : 'بانتظار'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18 }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f2d79e' }}>
                🎁 أكمل <strong>الاسم + التليفون + فيسبوك</strong> واحصل على 5 نقاط!
                <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 12 }}>
                  <span>{profileForm.display_name.trim() ? '✅' : '○'} الاسم</span>
                  <span>{profileForm.phone.trim() ? '✅' : '○'} التليفون</span>
                  <span>{profileForm.facebook_url.trim() ? '✅' : '○'} فيسبوك</span>
                </div>
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>الاسم الكامل <span style={{ color: 'var(--red)' }}>*</span></div>
            <input type="text" value={profileForm.display_name} onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))} placeholder="اسمك كما تريد أن يظهر في الصدارة" className="modal-input" style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>رقم التليفون <span style={{ color: '#7db1ff', fontSize: 11 }}>(مطلوب للنقاط)</span></div>
            <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" className="modal-input" style={{ marginBottom: 14, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 12 }}>
              أدخل رقم الهاتف بشكل صحيح لأنه مطلوب لاستكمال الملف.
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>البريد الإلكتروني <span style={{ color: 'var(--red)' }}>*</span></div>
            <input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" className="modal-input" style={{ marginBottom: 14, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 12 }}>
              سيتم تعبئة الإيميل الحالي تلقائياً إن كان موجوداً، ويمكنك تعديله قبل الحفظ.
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              رابط فيسبوك
              {profile?.facebook_bonus_awarded
                ? <span style={{ background: 'rgba(39,176,110,.1)', color: '#5effa8', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>✅ مضاف</span>
                : <span style={{ background: 'rgba(217,178,95,.1)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>+5 نقاط عند إكمال الثلاثة</span>}
            </div>
            <input type="url" value={profileForm.facebook_url} onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/username" className="modal-input" style={{ marginBottom: 20, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -14, marginBottom: 14 }}>
              أضف رابط حسابك على فيسبوك للحصول على نقاط البونص عند الاستكمال.
            </div>
            {profileMsg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: profileMsg.startsWith('✅') ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', color: profileMsg.startsWith('✅') ? '#5effa8' : '#ff9e9e', fontSize: 13, fontWeight: 700 }}>{profileMsg}</div>}
            <button onClick={saveProfile} disabled={profileSaving} className="save-btn">{profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات وتحديث الإيميل'}</button>
          </div>
        </div>
      )}

      {showReferral && (
        <div className="modal-overlay" onClick={() => setShowReferral(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18 }}>🎁 ادعُ أصدقاءك</h3>
              <button onClick={() => setShowReferral(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'أصدقاء انضموا', value: referralCount, color: 'var(--green)' },
                { label: 'نقاط من الدعوات', value: Math.min(referralCount * 5, 50), color: 'var(--gold)' }
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface-3)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface-3)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, fontSize: 13, lineHeight: 2 }}>
              <strong>⚡ كيف يعمل؟</strong><br />
              ١. شارك رابطك مع أصدقاءك<br />
              ٢. لما يسجلوا عن طريق رابطك → <span style={{ color: 'var(--gold)' }}>5 نقاط</span> لكل دعوة ناجحة بحد أقصى 50 نقطة.<br />
              ٣. شارك رابطك وزوّد فرصك 🚀
            </div>
            {referralCode ? (
              <>
                <div style={{ background: 'var(--surface-3)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 12, color: 'var(--muted)', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? getReferralLink() : '...'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: referralCopied ? '✅ تم النسخ' : '📋 نسخ', fn: copyReferralLink, bg: 'rgba(255,255,255,.04)' },
                    { label: '💬 واتساب',  fn: shareOnWhatsApp,  bg: 'rgba(37,211,102,.1)' },
                    { label: '📘 فيسبوك',  fn: shareOnFacebook,  bg: 'rgba(24,119,242,.1)' },
                    { label: '⚡ ماسنجر',  fn: shareOnMessenger, bg: 'rgba(0,132,255,.1)' },
                  ].map(b => (
                    <button key={b.label} onClick={b.fn} style={{ padding: '12px', borderRadius: 14, border: '1px solid var(--line)', background: b.bg, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700 }}>{b.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>⏳ جاري تحميل رابط الدعوة... حاول مجدداً بعد لحظة</div>
            )}
          </div>
        </div>
      )}{showTerms && (
  <div className="modal-overlay" onClick={() => setShowTerms(false)}>
    <div
      className="modal-box"
      onClick={e => e.stopPropagation()}
      style={{ maxWidth: 720, maxHeight: '88vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)', marginBottom: 4 }}>📜 الشروط والأحكام</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>دوري توقعات الشمعدان — كأس العالم 2026</div>
        </div>
        <button
          onClick={() => setShowTerms(false)}
          style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >✕</button>
      </div>

      {/* Intro */}
      <div style={{ background: 'linear-gradient(180deg,rgba(217,178,95,.08),rgba(217,178,95,.03))', border: '1px solid rgba(217,178,95,.2)', borderRadius: 18, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>أهلاً بيك في دوري توقعات الشمعدان لكأس العالم 2026! 🏆</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>
          عشان تكون في الصدارة وتكسب الجوائز الكبرى وسبائك الذهب، عملنالك نظام نقاط ممتع وسهل. هتقدر تجمع النقاط مش بس من توقعك لنتائج الماتشات، ده كمان من تفاعلك ودعوة أصحابك!
        </div>
      </div>

      {/* Section 1 */}
      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>١. إزاي بنحسب نقاطك في كل ماتش؟ ⚽</div>
        {[
          { pts: '+5', text: 'التوقع المظبوط للنتيجة بالكامل (مثلاً تتوقع 2-1 والماتش يخلص 2-1)', color: '#8ae0b3' },
          { pts: '+5',  text: 'توقع الفائز أو التعادل صح (من غير النتيجة الرقمية بالظبط)', color: '#8ae0b3' },
          { pts: '+3',  text: 'توقع اسم أول هدّاف في الماتش', color: '#7db1ff' },
          { pts: '+1',  text: 'لو توقعك لأول هدّاف غلط بس اللاعب سجل عموماً في الماتش', color: '#7db1ff' },
          { pts: '+3',  text: 'توقع إن الماتش يروح لوقت إضافي (بداية من دور الـ 32)', color: '#c084fc' },
          { pts: '+3',  text: 'توقعك الصح إن هيكون فيه كارت أحمر في الماتش (أيوة)', color: '#f97316' },
          { pts: '+3',  text: 'توقعك الصح إن هيكون فيه ضربة جزاء في الماتش (أيوة)', color: '#f97316' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: item.color, minWidth: 32, flexShrink: 0 }}>{item.pts}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{item.text}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, background: 'rgba(255,80,80,.06)', border: '1px solid rgba(255,80,80,.15)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#ff9e9e', lineHeight: 1.8 }}>
          ⚠️ لو توقعت غلط في حوار الكارت الأحمر أو ضربة الجزاء أو الوقت الإضافي، هتتخصم منك نقطة (-1). فركّز كويس في توقعاتك!
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          📌 تقدر تعدّل توقعاتك براحتك طول ما الماتش لسه مبدأش، بس أول ما صفارة البداية تضرب، باب التوقعات هيتقفل ومش هتقدر تعدل توقعك تاني.
        </div>
      </div>

      {/* Section 2 */}
      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>٢. كبّر رصيدك بنقاط المكافآت 🎁</div>
        {[
          { icon: '👤', text: 'كمّل بيانات ملفك الشخصي (اسمك، رقم تليفونك، واربط حساب الفيسبوك) وهتاخد', pts: '+5 نقاط', note: 'تأكد إن البيانات صحيحة عشان نتواصل معاك لو كنت من الفايزين.' },
          { icon: '👥', text: 'اعزم أصحابك — شارك رابط الدعوة بتاعك وعلى كل صاحب يسجل من خلالك هتاخد', pts: '+5 نقاط', note: 'الحد الأقصى لدعوات الأصحاب هو 50 نقطة.' },
         {
  icon: '🏆',
  text: 'أبطال "حلمك فيها" — لو شاركت قبل كده بأكتر من 10 أكواد، ليك نقاط هدية! لازم تكون مسجل بنفس بيانات مسابقة "حلمك فيها". ولو شاركت بأكتر من 100 كود في مسابقة "حلمك فيها" هتكسب 50 نقطة.',
  pts: '',
  note: '⚠️ ملاحظة مهمة: أي محاولة كسب نقاط بطرق غير شرعية ستتسبب في عقوبة خصم نقاط من المشارك وقد تصل لإنهاء حسابه تمامًا في دوري التوقعات.'
},
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
            <div>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{item.text} </span>
              {item.pts && <span style={{ fontWeight: 800, color: '#8ae0b3', fontSize: 13 }}>{item.pts}</span>}
              {item.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, opacity: 0.7 }}>{item.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Section 3 */}
      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 8 }}>٣. نافس أصحابك في "الميني ليج" 👥</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>
          التحدي مش بس على الترتيب العام — تقدر تعمل دوري خاص بيك (ميني ليج) وتبعت كود الدعوة (6 حروف) لأصحابك عشان تتنافسوا براحتكم وتشوفوا مين أحسن محلل في الشلة!
        </div>
      </div>

      {/* Section 4 */}
      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>٤. الجوائز ومواعيدها 🥇</div>

        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff1ce', marginBottom: 8 }}>🏆 جوائز المراحل — 5,000 جنيه لكل بطل مرحلة</div>
        {[
          'نهاية الجولة الأولى (المجموعات): 17 يونيو 2026',
          'نهاية الجولة الثانية (المجموعات): 23 يونيو 2026',
          'نهاية دور المجموعات: 27 يونيو 2026',
          'نهاية دور الـ 32: 3 يوليو 2026',
        ].map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--muted)', padding: '5px 0', borderBottom: '1px solid var(--line)', lineHeight: 1.7 }}>🗓️ {item}</div>
        ))}

        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff1ce', marginTop: 14, marginBottom: 8 }}>🌟 الجوائز الكبرى التراكمية — سبائك الذهب!</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.8 }}>
          بعد الماتش النهائي يوم 19 يوليو 2026، أصحاب أعلى نقاط من بداية البطولة (نقاط التوقعات + نقاط المكافآت) هيكسبوا:
        </div>
        {[
          { rank: '🥇 المركز الأول', reward: '3 سبائك ذهب' },
          { rank: '🥈 المركز الثاني', reward: '2 سبيكة ذهب' },
          { rank: '🥉 المركز الثالث', reward: '1 سبيكة ذهب' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(217,178,95,.06)', border: '1px solid rgba(217,178,95,.15)', borderRadius: 12, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>{item.rank}</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#fff1ce' }}>{item.reward}</span>
          </div>
        ))}

        <div style={{ marginTop: 12, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#93c5fd', lineHeight: 1.8 }}>
          🔵 في حالة التعادل: يُقدَّم من لديه نقاط مكافآت وبونص أكثر، ثم من لديه نقاط بونص من حملة "حلمك فيها" أكثر.
        </div>
      </div>

      {/* Section 5 */}
      <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>٥. مين يقدر يشارك؟</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.8 }}>أي حد يقدر يشارك بدون أي شروط معقدة. بس عشان تستلم الجايزة لو كسبت، لازم:</div>
        {[
          'تكون موجود جوه جمهورية مصر العربية.',
          'ماتكونش من فريق عمل شركة الشمعدان أو شركائها، ولا قريب ليهم من الدرجة الأولى.',
          'ماتكونش من فريق عمل شركة KOR Platforms أو شركائها ولا قريب ليهم من الدرجة الأولى.',
          'تكون حققت شروط الفوز سواء في مراحل البطولة أو في نهايتها.',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.9 }}>
        بنتمنى لكم وقت ممتع مع مسابقات الشمعدان وبطولة كأس العالم 2026 🇪🇬<br />
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>فريق الشمعدان و KOR Platforms</span> — 11 يونيو 2026
      </div>
    </div>
  </div>
)}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'توقعاتي',    value: predictions.length,                                        color: '#8ae0b3', icon: '⚽' },
            { label: 'المتسابقون', value: totalParticipants, color: '#7db1ff', icon: '👥' },
           { label: 'دقة التوقع', value: maxPossible > 0 ? `${efficiencyPct}%` : '—', color: '#c084fc', icon: '🎯', sub: maxPossible > 0 ? `${predictionOnlyPoints} من ${maxPossible} نقطة` : '' },
            { label: 'الجولات',    value: streakCount > 0 ? `${streakCount} 🔥` : '—',               color: '#f97316', icon: '📅' },
          ].map((s: any) => (
           
<div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
  <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
  <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
  
{s.sub && (
  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
    {s.sub}
  </div>
)}
</div>
          ))}
        </div>

        {myRank > 0 && (
          <div style={{ background: 'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', border: '1px solid rgba(217,178,95,.25)', borderRadius: 20, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>📊 ترتيبك</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px', textAlign: 'center', border: '1px solid rgba(217,178,95,.2)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>الترتيب الإجمالي</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>#{myRank}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>من {totalParticipants || leaderboard.length} متسابق</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff1ce', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{animatedPoints} نقطة</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 8 }}>
  {(() => {
    const predPoints = predictionOnlyPoints;
            const chips = [
      { label: '⚽ توقعات', value: predPoints, color: 'rgba(138,224,179,.15)', border: 'rgba(138,224,179,.25)', text: '#8ae0b3' },
      ...(referralPoints > 0 ? [{ label: '👥 دعوات', value: referralPoints, color: 'rgba(125,177,255,.15)', border: 'rgba(125,177,255,.25)', text: '#7db1ff' }] : []),
      ...(bonusPoints > 0 ? [{ label: '🎁 بونص', value: bonusPoints, color: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.25)', text: '#c084fc' }] : []),
      ...(profileCompleted ? [{ label: '👤 بروفايل', value: 5, color: 'rgba(249,115,22,.15)', border: 'rgba(249,115,22,.25)', text: '#fb923c' }] : []),
    ];
    return chips.map((chip, i) => (
      <div key={i} style={{
        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
        background: chip.color, border: `1px solid ${chip.border}`, color: chip.text,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>
        {chip.label}: {chip.value}
      </div>
    ));
  })()}
</div>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px', textAlign: 'center', border: '1px solid rgba(59,130,246,.2)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
                  {roundLabels[activeRound] || activeRound || 'الجولة الحالية'}
                </div>
                {(() => {
                  const roundFixtureIds = matches
                    .filter((m: any) => m.league.round === activeRound)
                    .map((m: any) => m.fixture.id);
                  const roundPoints = predictions
                    .filter((pr: any) => roundFixtureIds.includes(pr.fixture_id))
                    .reduce((sum: number, pr: any) => sum + (pr.points || 0), 0);
                  return roundFixtureIds.length > 0 ? (
                    <>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>{roundPoints}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>نقطة في هذه الجولة</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>من {roundFixtureIds.length} مباراة</div>
                 {(() => {
  if (!user?.id) return null;

  if (roundLeaderLoading) {
    return (
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
        ⏳ جاري حساب ترتيب الجولة
      </div>
    );
  }

  const myRoundEntry = roundLeaderboardRows.find((p: any) => String(p.user_id) === String(user.id));
  const myRoundRank = myRoundEntry?.rank ? Number(myRoundEntry.rank) : null;

  return myRoundRank ? (
    <div
      style={{
        marginTop: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        background: 'rgba(147,197,253,.1)',
        border: '1px solid rgba(147,197,253,.2)',
        fontSize: 10,
        fontWeight: 800,
        color: '#93c5fd',
        whiteSpace: 'nowrap',
      }}
    >
      🏅 ترتيبك في الجولة #{myRoundRank}
    </div>
  ) : null;
})()}
                    </>
                  ) : (
                    <div style={{ fontSize: 24, color: 'var(--muted)', marginTop: 16 }}>—</div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>🏆 انضم لليج بكود سريع</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input type="text" value={leagueCode} onChange={e => setLeagueCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && quickJoinLeague()} placeholder="أدخل كود الليج..." className="quick-input" maxLength={8} style={{ minWidth: 0, flex: '1 1 120px' }} />
            <button onClick={quickJoinLeague} disabled={leagueJoining} style={{ padding: '12px 20px', borderRadius: 14, background: 'linear-gradient(135deg,#e0bc73,#b9892d)', border: 'none', color: '#211708', fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif', cursor: 'pointer', flexShrink: 0 }}>
              {leagueJoining ? '⏳' : 'انضم'}
            </button>
            <Link href="/my-leagues" style={{ padding: '12px 20px', borderRadius: 14, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#93c5fd', fontWeight: 700, fontSize: 14, fontFamily: 'Cairo, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}>
              عرض ليجاتي
            </Link>
          </div>
          {leagueQuickMsg && <div style={{ marginTop: 10, fontSize: 13, color: leagueQuickMsg.startsWith('❌') ? '#ff9e9e' : '#5effa8' }}>{leagueQuickMsg}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {([
            { id: 'predict', label: openUnpredictedCount > 0 ? `⚽ التوقعات (${openUnpredictedCount})` : '⚽ التوقعات' },
            { id: 'my',      label: '📋 توقعاتي' },
            { id: 'leaders', label: '🏆 الصدارة' },
            { id: 'history', label: '📈 السجل التاريخي' },
            { id: 'feed',    label: '🌍 نشاط اللاعبين' },
          ] as const).map(({ id, label }) => (
            <button key={id} className={`tab-btn${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</button>
          ))}
        </div>

        {activeTab === 'predict' && (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r] || r} ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
            </div>

            {roundTotal > 0 && (
              <div style={{ marginBottom: 16, background: 'var(--surface)', borderRadius: 14, padding: '12px 16px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  <span>تقدمك في الجولة الحالية</span>
                  <span style={{ color: roundDone === roundTotal ? '#5effa8' : 'var(--gold)', fontWeight: 700 }}>
                    {roundDone} / {roundTotal} مباراة
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${roundPct}%`,
                    background: roundDone === roundTotal
                      ? 'linear-gradient(90deg,#5effa8,#27b06e)'
                      : 'linear-gradient(90deg,var(--gold),#f59e0b)',
                    borderRadius: 99,
                    transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
                {roundDone === roundTotal && roundTotal > 0 && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#5effa8', marginTop: 6, fontWeight: 700 }}>
                    ✅ أكملت كل توقعات الجولة!
                  </div>
                )}
              </div>
            )}

            {filteredMatches.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button
                  onClick={expandAllMatches}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Cairo, sans-serif',
                  }}
                >
                  عرض كل التفاصيل
                </button>

                <button
                  onClick={collapseAllMatches}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Cairo, sans-serif',
                  }}
                >
                  تصغير كل المباريات
                </button>
              </div>
            )}

            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>
                  {filteredMatches.some((m: any) => !m.is_open) && filteredMatches.every((m: any) => !m.is_open) ? '🔒' : '📅'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {filteredMatches.some((m: any) => !m.is_open) && filteredMatches.every((m: any) => !m.is_open)
                    ? 'كل مباريات الجولة مغلقة — انتظر الجولة القادمة 🕐'
                    : 'لا توجد ماتشات في هذه الجولة'}
                </div>
              </div>
            ) : filteredMatches.map(match => {
              const existing  = predictions.find(p => p.fixture_id === match.fixture.id);
              const form      = getForm(match);
              const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const msg       = messages[match.fixture.id];
              const isCollapsed = getMatchCollapsed(match.fixture.id);
              return (
                <div key={match.fixture.id} className="match-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{match.teams.home.name} × {match.teams.away.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={match.is_open ? 'pill-open' : 'pill-closed'}>{match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}</span>
                      {existing && <span className="pill-saved">✅ محفوظ</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '14px', background: 'var(--surface-3)', borderRadius: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      {match.teams.home.logo
                        ? <img src={match.teams.home.logo} alt={match.teams.home.name} width={40} height={40} style={{ borderRadius: 8, objectFit: 'contain' }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 20 }}>⚽</div>}
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{match.teams.home.name}</span>
                    </div>
                    <div style={{ padding: '0 16px', textAlign: 'center', minWidth: 80 }}>
                      {hasResult && (
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', opacity: 0.7, letterSpacing: '0.05em', marginBottom: 2, textTransform: 'uppercase' }}>النتيجة الفعلية</div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>
                        {hasResult ? `${match.actual_home_score} — ${match.actual_away_score}` : 'VS'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{match.teams.away.name}</span>
                      {match.teams.away.logo
                        ? <img src={match.teams.away.logo} alt={match.teams.away.name} width={40} height={40} style={{ borderRadius: 8, objectFit: 'contain' }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 20 }}>⚽</div>}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleMatchCollapsed(match.fixture.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-3)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'Cairo, sans-serif',
                      marginBottom: 12,
                    }}
                  >
                    {isCollapsed ? 'عرض التفاصيل' : 'إخفاء التفاصيل'}
                  </button>

                  {!isCollapsed && (
                    <>
                      {/* N7: 50/50 grid replacing gold box */}
                      {existing && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          {/* توقعي */}
                          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
                            <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>توقعي</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                              {existing.predicted_home_score} — {existing.predicted_away_score}
                            </div>
                            {existing.predicted_first_scorer && (
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>⚽ {existing.predicted_first_scorer}</div>
                            )}
                          </div>
                          {/* الفعلي */}
                          <div style={{ padding: '10px 12px', borderRadius: 12, background: hasResult ? 'rgba(39,176,110,.07)' : 'var(--surface-3)', border: hasResult ? '1px solid rgba(39,176,110,.2)' : '1px solid var(--line)' }}>
                            <div style={{ color: hasResult ? '#94f0c0' : 'var(--muted)', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>الفعلي</div>
                            {hasResult ? (
                              <>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>
                                  {match.actual_home_score} — {match.actual_away_score}
                                </div>
                                {(() => {
                                  const scorers = extractScorersList(match.scorers_json, match.first_scorer);
                                  return scorers.length > 0 ? (
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}><div style={{ color: 'var(--muted)', opacity: 0.8, marginBottom: 2 }}>الهدافون ({scorers.length})</div>
                                      {scorers.map((s, si) => <div key={si} style={{ display: 'block' }}>⚽ {s}</div>)}
                                    </div>
                                  ) : null;
                                })()}
                              </>
                            ) : (
                              <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>لم تُحسم بعد</div>
                            )}
                          </div>
                        </div>
                      )}
                      {existing && hasResult && (
                        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10,
                          background: (existing.points || 0) < 0 ? 'rgba(201,58,47,.1)' : (existing.points || 0) >= 10 ? 'rgba(217,178,95,.08)' : 'rgba(39,176,110,.08)',
                          border: (existing.points || 0) < 0 ? '1px solid rgba(201,58,47,.2)' : '1px solid var(--line)',
                          fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                          color: (existing.points || 0) < 0 ? '#ffb4b4' : (existing.points || 0) >= 10 ? '#ffe3a6' : '#94f0c0'
                        }}>
                          {(existing.points || 0) < 0 ? <>⚠ نقاطك: {existing.points} نقطة</> : <>نقاطك: <strong>{existing.points || 0}</strong> نقطة</>}
                        </div>
                      )}

                      {match.is_open && (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 12 }}>توقّع النتيجة</div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{match.teams.home.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <button className="score-btn" onClick={() => setForm(match.fixture.id, { homeScore: Math.max(0, (form.homeScore || 0) - 1) })}>−</button>
                                <span className="score-val">{form.homeScore || 0}</span>
                                <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { homeScore: (form.homeScore || 0) + 1 })}>+</button>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 800, fontSize: 16 }}>VS<br /><span style={{ fontSize: 10 }}>—</span></div>
                            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{match.teams.away.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <button className="score-btn" onClick={() => setForm(match.fixture.id, { awayScore: Math.max(0, (form.awayScore || 0) - 1) })}>−</button>
                                <span className="score-val">{form.awayScore || 0}</span>
                                <button className="score-btn plus" onClick={() => setForm(match.fixture.id, { awayScore: (form.awayScore || 0) + 1 })}>+</button>
                              </div>
                            </div>
                          </div>

                          <div className="field-row">
                            <span className="field-label">⚽ أول هدف</span>
                            <span className="points-tag" style={{ background: 'rgba(217,178,95,.1)', color: '#ffe3a6', border: '1px solid rgba(217,178,95,.2)' }}>+3</span>
                            <PlayerSelect
                              fixtureId={match.fixture.id}
                              homeTeam={match.db_home_team}
                              awayTeam={match.db_away_team}
                              value={form.firstScorer}
                              onChange={val => setForm(match.fixture.id, { firstScorer: val })}
                            />
                          </div>

                          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              توقعات إضافية
                              <span className="points-tag" style={{ background: 'rgba(217,178,95,.1)', color: '#ffe3a6', border: '1px solid rgba(217,178,95,.2)' }}>
اكسب 3 نقاط اضافية لكل توقع صحيح هنا 👇</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#fdba74', background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                              ⚠️ خد بالك، لو توقعت كارت أحمر أو ضربة جزاء بشكل غلط هتتخصم منك نقطة (-1) 😉
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              {[
                                                                { key: 'predicted_red_card', label: '🟥 بطاقة حمراء؟' },
                                { key: 'predicted_penalty',  label: '⚽ ركلة جزاء؟' },
                              ].map(({ key, label }) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 12, background: form[key] ? 'rgba(217,178,95,.08)' : 'var(--surface-3)', border: `1px solid ${form[key] ? 'rgba(217,178,95,.25)' : 'var(--line)'}`, transition: 'all .2s' }}>
                                  <input
                                    type="checkbox"
                                    checked={form[key] ?? false}
                                    onChange={e => setForm(match.fixture.id, { [key]: e.target.checked })}
                                    style={{ width: 17, height: 17, accentColor: 'var(--gold)', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: form[key] ? '#ffe3a6' : 'var(--muted)' }}>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {msg && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 12, background: msg.startsWith('✅') ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', color: msg.startsWith('✅') ? '#5effa8' : '#ff9e9e', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{msg}</div>}
                          <button onClick={() => submitPrediction(match)} disabled={submitting === match.fixture.id} className="save-btn">
                            {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                          </button>
                        </div>
                      )}

                      {!match.is_open && !hasResult && existing && (
                        <div className="pred-box">
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>توقعك المسجّل</div>
                          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)', textAlign: 'center' }}>
                            {existing.predicted_home_score} — {existing.predicted_away_score}
                          </div>
                          {existing.predicted_first_scorer && <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>⚽ {existing.predicted_first_scorer}</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'my' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>توقعاتي</h2>
              <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 12, padding: '8px 16px', fontWeight: 800, color: 'var(--gold)' }}>🏅 {myPoints} نقطة</div>
            </div>
            {(() => {
              const topPredictionsWithZero = [...pointsBreakdown]
                .sort((a: any, b: any) => Number(b.points ?? 0) - Number(a.points ?? 0));

              return topPredictionsWithZero.length > 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>🔝 أفضل توقعاتك بالنقاط</div>
                {topPredictionsWithZero.map((p: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < pointsBreakdown.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{p.home_team} × {p.away_team}</span>
                    <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                      color: (p.points || 0) < 0 ? '#ffb4b4' : (p.points || 0) === 0 ? 'var(--muted)' : (p.points || 0) >= 10 ? 'var(--gold)' : '#94f0c0'
                    }}>{(p.points || 0) < 0 ? <>⚠ {p.points} نقطة</> : <>+{p.points} نقطة</>}</span>
                  </div>
                ))}
              </div>
            ) : null;
            })()}
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>لم تقدم أي توقعات بعد</div>
              </div>
            ) : myPredictionsSorted.map((p, i) => {
              const hasResult = p.actual_home_score !== null;
            const matchInfo = matches.find((m: any) => m.fixture.id === p.fixture_id);
const matchDate = matchInfo?.fixture?.date
  ? new Date(matchInfo.fixture.date).toLocaleDateString('ar-EG', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  : '';
const extraPredictions = [
  ...(p.predicted_extra_time
    ? [{
        label: '🕒 وقت إضافي',
        predicted: !!p.predicted_extra_time,
        actual: !!matchInfo?.went_extra_time,
      }]
    : []),
  ...(p.predicted_red_card
    ? [{
        label: '🟥 كارت أحمر',
        predicted: !!p.predicted_red_card,
        actual: !!matchInfo?.red_card_in_match,
      }]
    : []),
  ...(p.predicted_penalty
    ? [{
        label: '⚽ ضربة جزاء',
        predicted: !!p.predicted_penalty,
        actual: !!matchInfo?.penalty_in_match,
      }]
    : []),
  ...(p.predicted_both_teams
    ? [{
        label: '🥅 الفريقان يسجلان',
        predicted: !!p.predicted_both_teams,
        actual: !!matchInfo?.both_teams_scored,
      }]
    : []),
];
            // ✅ ترتيب توقعاتي من الأقدم إلى الأحدث حسب تاريخ المباراة
const myPredictionsSorted = [...predictions].sort((a: any, b: any) => {
  const aFinished = a.actual_home_score !== null && a.actual_home_score !== undefined;
  const bFinished = b.actual_home_score !== null && b.actual_home_score !== undefined;

  if (aFinished !== bFinished) return aFinished ? -1 : 1;

  const matchA = matches.find((m: any) => m.fixture.id === a.fixture_id);
  const matchB = matches.find((m: any) => m.fixture.id === b.fixture_id);

  const dateA = matchA?.fixture?.date ? new Date(matchA.fixture.date).getTime() : 0;
  const dateB = matchB?.fixture?.date ? new Date(matchB.fixture.date).getTime() : 0;

  if (aFinished && bFinished) return dateA - dateB;
  return dateA - dateB;
});
         return (
  <div
    key={i}
    className="rank-item"
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 14,
      alignItems: 'stretch',
      ...(p.points || 0) >= 10
        ? {
            borderColor: 'rgba(217,178,95,.28)',
            background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))',
          }
        : {},
    }}
  >
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {matchInfo?.teams?.home?.logo && <img src={matchInfo.teams.home.logo} alt="" width={18} height={18} style={{ objectFit: 'contain', borderRadius: 3 }} />}
          {p.home_team}
          <span style={{ color: 'var(--muted)', fontWeight: 400, margin: '0 2px' }}>×</span>
          {p.away_team}
          {matchInfo?.teams?.away?.logo && <img src={matchInfo.teams.away.logo} alt="" width={18} height={18} style={{ objectFit: 'contain', borderRadius: 3 }} />}
        </div>

        <div
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: hasResult ? 'rgba(39,176,110,.10)' : 'rgba(255,255,255,.04)',
            border: '1px solid var(--line)',
            color: hasResult ? '#94f0c0' : 'var(--muted)',
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {hasResult ? 'تم الحسم' : 'بانتظار النتيجة'}
        </div>
      </div>

      {matchDate && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          {matchDate}
        </div>
      )}

      {/* N4: 50/50 grid - توقعي | الفعلي */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {/* Left: توقعي */}
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
          <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>توقعي</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {p.predicted_home_score} — {p.predicted_away_score}
          </div>
          {p.predicted_first_scorer && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>⚽ {p.predicted_first_scorer}</div>
          )}
        </div>

        {/* Right: الفعلي */}
        <div style={{ padding: '10px 12px', borderRadius: 12, background: hasResult ? 'rgba(39,176,110,.07)' : 'var(--surface-3)', border: hasResult ? '1px solid rgba(39,176,110,.2)' : '1px solid var(--line)' }}>
          <div style={{ color: hasResult ? '#94f0c0' : 'var(--muted)', fontSize: 10, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>الفعلي</div>
          {hasResult ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>
                {p.actual_home_score} — {p.actual_away_score}
              </div>
              {(() => {
                const scorers = extractScorersList(matchInfo?.scorers_json, matchInfo?.first_scorer || p.first_scorer_actual);
                return scorers.length > 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}><div style={{ color: 'var(--muted)', opacity: 0.8, marginBottom: 2 }}>الهدافون ({scorers.length})</div>
                    {scorers.map((s, si) => <div key={si} style={{ display: 'block' }}>⚽ {s}</div>)}
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>لم تُحسم بعد</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
       {extraPredictions.length > 0 ? (
  extraPredictions.map((item, idx) => {
            const isCorrect = hasResult && item.predicted === item.actual;

            return (
              <span
                key={idx}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: hasResult
                    ? isCorrect
                      ? '1px solid rgba(39,176,110,.24)'
                      : '1px solid rgba(201,58,47,.24)'
                    : '1px solid var(--line)',
                  background: hasResult
                    ? isCorrect
                      ? 'rgba(39,176,110,.12)'
                      : 'rgba(201,58,47,.12)'
                    : 'rgba(255,255,255,.04)',
                  color: hasResult
                    ? isCorrect
                      ? '#94f0c0'
                      : '#ffb4b4'
                    : 'var(--text)',
                }}
              >
                {item.label} {hasResult ? (isCorrect ? '✓' : '✕') : ''}
              </span>
            );
          })
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,.03)',
              border: '1px dashed var(--line)',
              color: 'var(--muted)',
            }}
          >
            لا توجد اختيارات إضافية
          </span>
        )}
      </div>
    </div>

    {/* N8: Points box with negative/zero/positive visual treatment */}
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 14,
        background: !hasResult
          ? 'var(--surface-3)'
          : (p.points || 0) < 0
          ? 'rgba(201,58,47,.13)'
          : (p.points || 0) === 0
          ? 'var(--surface-3)'
          : (p.points || 0) >= 10
          ? 'rgba(217,178,95,.12)'
          : 'rgba(39,176,110,.12)',
        border: !hasResult
          ? '1px solid var(--line)'
          : (p.points || 0) < 0
          ? '1px solid rgba(201,58,47,.3)'
          : '1px solid var(--line)',
        color: !hasResult
          ? 'var(--muted)'
          : (p.points || 0) < 0
          ? '#ffb4b4'
          : (p.points || 0) === 0
          ? 'var(--muted)'
          : (p.points || 0) >= 10
          ? '#ffe3a6'
          : '#94f0c0',
        textAlign: 'center',
        minWidth: 74,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {hasResult
          ? (p.points || 0) < 0
            ? <>⚠ {p.points}</>
            : (p.points || 0)
          : '⏳'}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: hasResult ? 'inherit' : 'var(--muted)' }}>
        {hasResult ? 'نقطة' : 'بانتظار'}
      </div>
    </div>
  </div>
);
            })}
          </div>
        )}


        {(activeTab === 'leaders' || activeTab === 'roundleaders') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className={`round-btn ${activeTab === 'leaders' ? 'active' : ''}`} onClick={() => setActiveTab('leaders')}>الصدارة العامة</button>
                <button className={`round-btn ${activeTab === 'roundleaders' ? 'active' : ''}`} onClick={() => setActiveTab('roundleaders')}>صدارة الجولة</button>
              </div>
              {activeTab === 'leaders'
                ? <Link href="/leaderboard" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>عرض الكامل ←</Link>
                : <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>نقاط التوقعات فقط</span>}
            </div>


            {activeTab === 'roundleaders' && roundLeaderLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>جاري تحميل صدارة الجولة</div>
              </div>
            ) : (() => {
              const rankingData = activeTab === 'roundleaders' ? roundLeaderboardRows : leaderboard;
              if (rankingData.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>لا توجد نتائج بعد</div>
                  </div>
                );
              }

              return rankingData.slice(0, 20).map((player: any, i) => {
                const isMe = player.user_id === user?.id;
                const name = player.display_name || player.user_email?.split('@')[0];
                const playerPredictionsCount = activeTab === 'roundleaders' ? (player.predictions_count || 0) : (player.count || 0);
                return (
                  <div
                    key={`${activeTab}-${player.user_id}`}
                    className={`rank-item${isMe ? ' me' : ''}`}
                    onClick={() => openLeaderDetails(player)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLeaderDetails(player);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                        {name}
                        {isMe && <span style={{ marginRight: 8, fontSize: 11, color: 'var(--gold)' }}>(أنت)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {activeTab === 'roundleaders'
                          ? `مجموع نقاط التوقعات في ${roundLabels[activeRound] || activeRound || 'الجولة الحالية'}`
                          : `${playerPredictionsCount || 0} توقع`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {activeTab === 'roundleaders' ? (player.total_points || 0) : (player.totalPoints || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>📈 السجل التاريخي للترتيب</h2>
             <p style={{ fontSize: 13, color: 'var(--muted)' }}>لقطات يومية لأفضل 25 لاعب منذ بداية البطولة</p>
            </div>
            {historyDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>لا يوجد سجل تاريخي بعد</div>
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
                    <div key={i} className={`rank-item${isMe ? ' me' : ''}`}>
                      <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {player.display_name || '—'}
                          {isMe && <span style={{ fontSize: 11, background: 'rgba(217,178,95,.15)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px' }}>أنت</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {new Date(player.week_start).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{player.total_points}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'feed' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>🌍 نشاط اللاعبين</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>آخر الأحداث في المنافسة</p>
            </div>
            {socialFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>لا يوجد نشاط بعد — كن أول من يسجّل!</div>
              </div>
            ) : socialFeed.map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: i < socialFeed.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>
                  {item.type === 'invite_friend' ? '🎉' : item.type === 'completed_profile' ? '✅' : item.type === 'joined_league' ? '🏆' : item.type === 'share_league' ? '🔗' : '⚽'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.user_name || 'لاعب'}
                    {item.user_id === user?.id && <span style={{ fontSize: 11, background: 'rgba(217,178,95,.15)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px' }}>أنت</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{feedEventLabel(item.type, item.data)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{timeAgo(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
