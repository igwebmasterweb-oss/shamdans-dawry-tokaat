'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Player {
  user_id: string;
  user_email: string;
  display_name: string | null;
  total_points: number;
  predictions_count: number;
  profile_completed: boolean;
  referral_points?: number;
  bonus_points?: number;
  penalty_points?: number;
  raw_total_points?: number;
}

interface MemberPrediction {
  id?: string | number;
  fixture_id?: number | null;
  
  home_team?: string | null;
  away_team?: string | null;
  predicted_home_score?: number | null;
  predicted_away_score?: number | null;
  predicted_first_scorer?: string | null;
  predicted_red_card?: boolean | string | number | null;
  predicted_penalty?: boolean | string | number | null;
  predicted_extra_time?: boolean | string | number | null;
  points?: number | null;
}

interface FinishedFixture {
  api_fixture_id: number;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_logo?: string | null;
  away_team_logo?: string | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  first_scorer?: string | null;
  red_card_in_match?: boolean | null;
  penalty_in_match?: boolean | null;
  went_extra_time?: boolean | null;
  match_date?: string | null;
  round?: string | null;
}

interface PrizePhase {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  prize_label: string | null;
  prize_label_2: string | null;
  prize_label_3: string | null;
  winner_count: number;
  is_cumulative: boolean;
  status: string;
}

interface PrizeWinner {
  phase_id: number;
  user_id: string;
  rank: number;
  points: number;
  profiles?: { full_name: string | null };
}

const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [myRank, setMyRank] = useState(0);
  const [myPoints, setMyPoints] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [prizePhases, setPrizePhases] = useState<PrizePhase[]>([]);
  const [prizeWinners, setPrizeWinners] = useState<PrizeWinner[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPredictions, setSelectedPredictions] = useState<(MemberPrediction & { fixture?: FinishedFixture | null })[]>([]);
  const [memberModalLoading, setMemberModalLoading] = useState(false);
  const [memberModalError, setMemberModalError] = useState('');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [penaltyMap, setPenaltyMap] = useState<Record<string, number>>({});
  const [rounds, setRounds] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [roundPlayers, setRoundPlayers] = useState<Player[]>([]);
  const maxPoints = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isSearching = searchQuery.trim().length > 0;
  const isRoundMode = selectedRound.trim().length > 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    initializeData();
  }, []);

  useEffect(() => {
    if (isRoundMode) return;
    if (isSearching) loadAllForSearch();
    else loadPage(currentPage);
  }, [isSearching]);

  const initializeData = async () => {
    await Promise.all([
      loadPenaltyMap(),
      loadRounds(),
      loadPrizes(),
    ]);
  };

  const loadPenaltyMap = async () => {
    try {
      const { data: penaltyRows } = await supabase
        .from('user_penalty_notices')
        .select('user_id, penalty_points')
        .eq('is_active', true);

      const nextPenaltyMap: Record<string, number> = {};
      (penaltyRows || []).forEach((row: any) => {
        if (row?.user_id) {
          nextPenaltyMap[row.user_id] = Number(row.penalty_points || 0);
        }
      });

      setPenaltyMap(nextPenaltyMap);
      await Promise.all([
        loadMyRank(nextPenaltyMap),
        loadPage(1, nextPenaltyMap),
      ]);
    } catch (err) {
      console.error('loadPenaltyMap:', err);
      setPenaltyMap({});
      await Promise.all([
        loadMyRank({}),
        loadPage(1, {}),
      ]);
    }
  };

  const loadRounds = async () => {
    try {
      const { data } = await supabase
        .from('fixtures')
        .select('round, match_date')
        .not('round', 'is', null)
        .order('match_date', { ascending: true });

      const uniqueRounds = Array.from(new Set((data || []).map((row: any) => row?.round).filter(Boolean))) as string[];
      setRounds(uniqueRounds);
    } catch (err) {
      console.error('loadRounds:', err);
    }
  };

  const loadPrizes = async () => {
    setPrizesLoading(true);
    try {
      const [{ data: phases }, { data: winners }] = await Promise.all([
        supabase.from('prize_phases').select('*').order('id'),
        supabase.from('prize_winners').select('*, profiles(full_name)').order('phase_id').order('rank'),
      ]);
      setPrizePhases(phases || []);
      setPrizeWinners(winners || []);
    } catch (err) {
      console.error('loadPrizes:', err);
    }
    setPrizesLoading(false);
  };

  const loadMyRank = async (nextPenaltyMap: Record<string, number> = penaltyMap) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const { data: allData } = await supabase.from('user_points').select('*');
    if (!allData) return;

    const adjustedAll = allData
      .map((row: any) => ({
        user_id: row.user_id,
        total_points: Number(row.total_points || 0) - Number(nextPenaltyMap[row.user_id] || 0),
      }))
      .sort((a: any, b: any) => b.total_points - a.total_points);

    const me = adjustedAll.find((row: any) => row.user_id === authData.user.id);
    if (!me) return;

    setMyPoints(me.total_points || 0);
    setMyRank(adjustedAll.findIndex((row: any) => row.user_id === authData.user.id) + 1);
  };

  const loadPage = async (page: number, nextPenaltyMap: Record<string, number> = penaltyMap) => {
    if (page !== 1) setPageLoading(true);

    const { data } = await supabase
      .from('user_points')
      .select('*');

    if (data) {
      const adjustedRows: Player[] = data
        .map((row: any) => ({
          user_id: row.user_id,
          user_email: row.user_email,
          display_name: row.full_name || null,
          raw_total_points: Number(row.total_points || 0),
          penalty_points: Number(nextPenaltyMap[row.user_id] || 0),
          total_points: Number(row.total_points || 0) - Number(nextPenaltyMap[row.user_id] || 0),
          predictions_count: row.predictions_count || 0,
          profile_completed: row.profile_completed || false,
          referral_points: row.referral_points || 0,
          bonus_points: row.bonus_points || 0,
        }))
        .sort((a, b) => b.total_points - a.total_points);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const pageRows = adjustedRows.slice(from, to);

      if (page === 1 && pageRows.length > 0) maxPoints.current = pageRows[0].total_points || 1;
      setPlayers(pageRows);
      setTotalCount(adjustedRows.length);
      setCurrentPage(page);
    }

    setLoading(false);
    setPageLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
  };

  const loadAllForSearch = async () => {
    const { data } = await supabase
      .from('user_points')
      .select('*');

    if (data) {
      const adjustedRows: Player[] = data
        .map((row: any) => ({
          user_id: row.user_id,
          user_email: row.user_email,
          display_name: row.full_name || null,
          raw_total_points: Number(row.total_points || 0),
          penalty_points: Number(penaltyMap[row.user_id] || 0),
          total_points: Number(row.total_points || 0) - Number(penaltyMap[row.user_id] || 0),
          predictions_count: row.predictions_count || 0,
          profile_completed: row.profile_completed || false,
          referral_points: row.referral_points || 0,
          bonus_points: row.bonus_points || 0,
        }))
        .sort((a, b) => b.total_points - a.total_points);

      setAllPlayers(adjustedRows);
    }
  };

  const loadRoundPlayers = async (round: string) => {
    if (!round) return;
    setPageLoading(true);
    setSearchQuery('');

    try {
      const [{ data: fixtures }, { data: predictions }, { data: users }, { data: profiles }] = await Promise.all([
        supabase.from('fixtures').select('api_fixture_id').eq('round', round),
        supabase.from('predictions').select('user_id, fixture_id, points'),
        supabase.from('user_points').select('user_id, user_email, full_name, profile_completed, referral_points, bonus_points'),
        supabase.from('profiles').select('id, full_name'),
      ]);

      const fixtureIds = new Set((fixtures || []).map((f: any) => Number(f.api_fixture_id)));
      const userMap = new Map((users || []).map((u: any) => [String(u.user_id), u]));
      const profileById = new Map((profiles || []).map((p: any) => [String(p.id), p]));
      const grouped = new Map<string, { total_points: number; predictions_count: number }>();

      (predictions || []).forEach((row: any) => {
        const fixtureId = Number(row.fixture_id || 0);
        if (!fixtureIds.has(fixtureId)) return;
        const userId = row.user_id;
        if (!userId) return;

        const prev = grouped.get(userId) || { total_points: 0, predictions_count: 0 };
        grouped.set(userId, {
          total_points: prev.total_points + Number(row.points || 0),
          predictions_count: prev.predictions_count + 1,
        });
      });

      const rows: Player[] = Array.from(grouped.entries())
        .map(([userId, agg]) => {
          const userKey = String(userId);
          const user = userMap.get(userKey) || null;
          const profile = profileById.get(userKey) || null;
          const resolvedName = (user?.full_name && String(user.full_name).trim()) || (profile?.full_name && String(profile.full_name).trim()) || null;
          const resolvedEmail = (user?.user_email && String(user.user_email).trim()) || '';
          return {
            user_id: userKey,
            user_email: resolvedEmail,
            display_name: resolvedName,
            total_points: agg.total_points,
            raw_total_points: agg.total_points,
            penalty_points: 0,
            predictions_count: agg.predictions_count,
            profile_completed: Boolean(user?.profile_completed),
            referral_points: Number(user?.referral_points || 0),
            bonus_points: Number(user?.bonus_points || 0),
          };
        })
        .sort((a, b) => b.total_points - a.total_points);

      setRoundPlayers(rows);
      maxPoints.current = rows[0]?.total_points || 1;
    } catch (err) {
      console.error('loadRoundPlayers:', err);
      setRoundPlayers([]);
    }

    setLoading(false);
    setPageLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadPage(page);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getName = (p: Player) => p.display_name || p.user_email?.split('@')[0] || 'مجهول';
  const getInitials = (p: Player) => getName(p).slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  const toBool = (v: any) => v === true || v === 'true' || v === 1;

  const formatMatchDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const loadMemberDetails = async (player: Player) => {
    setSelectedPlayer(player);
    setSelectedPredictions([]);
    setMemberModalError('');
    setMemberModalLoading(true);

    try {
      const [{ data: predictionsData, error: predictionsError }, { data: fixturesData, error: fixturesError }] = await Promise.all([
        supabase
          .from('predictions')
         .select('id, fixture_id, home_team, away_team, predicted_home_score, predicted_away_score, predicted_first_scorer, predicted_red_card, predicted_penalty, predicted_extra_time, points')
          .eq('user_id', player.user_id),
        supabase
          .from('fixtures')
          .select('api_fixture_id, home_team_name, away_team_name, home_team_logo, away_team_logo, actual_home_score, actual_away_score, first_scorer, red_card_in_match, penalty_in_match, went_extra_time, match_date, round')
          .not('actual_home_score', 'is', null)
          .not('actual_away_score', 'is', null)
      ]);

      if (predictionsError) throw predictionsError;
      if (fixturesError) throw fixturesError;

      const fixturesMap = new Map<number, FinishedFixture>((fixturesData || []).map((f: any) => [Number(f.api_fixture_id), f]));

      const merged = (predictionsData || [])
        .map((pred: any) => {
         const fixtureKey = Number(pred.fixture_id);
          const fixture = fixturesMap.get(fixtureKey);
          return {
            ...pred,
            fixture: fixture || null,
          };
        })
        .filter((item: any) => item.fixture)
        .sort((a: any, b: any) => {
          const ad = new Date(a.fixture?.match_date || 0).getTime();
          const bd = new Date(b.fixture?.match_date || 0).getTime();
          return bd - ad;
        });

      setSelectedPredictions(merged);
    } catch (err: any) {
      setMemberModalError(err?.message || 'تعذّر تحميل تفاصيل العضو');
    }

    setMemberModalLoading(false);
  };

  const closeMemberModal = () => {
    setSelectedPlayer(null);
    setSelectedPredictions([]);
    setMemberModalError('');
    setMemberModalLoading(false);
  };

  const sourceList = isRoundMode ? roundPlayers : (isSearching ? allPlayers : players);
  const filteredPlayers = isSearching
    ? sourceList.filter(p =>
        getName(p).toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()))
    : sourceList;

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const top3 = (isRoundMode ? roundPlayers : players).slice(0, 3);

  const today = new Date().toISOString().split('T')[0];

  const getPhaseStatus = (phase: PrizePhase) => {
    const winners = prizeWinners.filter(w => w.phase_id === phase.id);
    if (winners.length > 0) return 'completed';
    if (phase.end_date < today) return 'past';
    if (phase.start_date <= today && phase.end_date >= today) return 'active';
    return 'upcoming';
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; bd: string }> = {
    completed: { label: '✅ مكتملة', color: '#5effa8', bg: 'rgba(39,176,110,.12)', bd: 'rgba(39,176,110,.25)' },
    active:    { label: '🔴 نشطة',  color: '#d9b25f', bg: 'rgba(217,178,95,.12)', bd: 'rgba(217,178,95,.28)' },
    past:      { label: '⏳ انتهت', color: '#ff9c91', bg: 'rgba(201,58,47,.08)',  bd: 'rgba(201,58,47,.2)'  },
    upcoming:  { label: '⏰ قادمة', color: '#a8a39a', bg: 'rgba(255,255,255,.04)', bd: 'rgba(255,255,255,.08)' },
  };

  const grandPhase = prizePhases.find(p => p.is_cumulative && p.winner_count >= 1);
  const nonGrandPhases = prizePhases.filter(p => !(p.is_cumulative && p.winner_count >= 1) || p !== grandPhase);
  const displayedMyRank = isRoundMode ? roundPlayers.findIndex(p => p.user_id === currentUser?.id) + 1 : myRank;
  const displayedMyPoints = isRoundMode ? (roundPlayers.find(p => p.user_id === currentUser?.id)?.total_points || 0) : myPoints;
  const displayedTotalCount = isRoundMode ? roundPlayers.length : totalCount;
  const displayedPageCount = isRoundMode ? 1 : totalPages;
  const displayedPage = isRoundMode ? 1 : currentPage;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        :root {
          --bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;
          --line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;
          --gold:#d9b25f;--red:#c93a2f;--green:#27b06e;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{
          font-family:'Cairo',sans-serif;
          background:radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%),
                      radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%),#070809;
          color:var(--text);direction:rtl;min-height:100vh;
          -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
        }
        a{text-decoration:none;color:inherit}
        @keyframes barGrow{from{width:0% !important}}
        @keyframes rowIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
        @keyframes rotateBorder{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 20px rgba(217,178,95,.2)}50%{box-shadow:0 0 40px rgba(217,178,95,.45)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .player-row{opacity:0;animation:rowIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards}
        .bar-fill{animation:barGrow 0.9s cubic-bezier(0.16,1,0.3,1) forwards}
        .top-float{animation:float 3.5s ease-in-out infinite}
        .skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;border-radius:16px}
        .nav-pill{padding:9px 20px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);font-weight:700;text-decoration:none;font-size:13px;font-family:'Cairo',sans-serif;transition:all .2s;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .nav-pill:hover{border-color:rgba(217,178,95,.25);color:#f2d79e}
        .nav-pill.primary{background:linear-gradient(135deg,#e0bc73,#b9892d);color:#211708;border:none;box-shadow:0 4px 14px rgba(217,178,95,.25)}
        .nav-pill.primary:hover{opacity:.88}
        .search-box{width:100%;padding:13px 18px;border-radius:16px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-family:'Cairo',sans-serif;font-size:14px;font-weight:600;outline:none;transition:border-color .2s;direction:rtl}
        .search-box:focus{border-color:rgba(217,178,95,.4)}
        .search-box::placeholder{color:var(--muted)}
        .pg-btn{min-width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);font-family:'Cairo',sans-serif;font-weight:800;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .18s;}
        .pg-btn:hover:not(:disabled){border-color:rgba(217,178,95,.3);color:var(--gold);background:rgba(217,178,95,.06)}
        .pg-btn.active{background:linear-gradient(135deg,#d9b25f,#a8761a);color:#211708;border-color:transparent}
        .pg-btn:disabled{opacity:.3;cursor:not-allowed}
        .logo-wrap{position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .logo-wrap::before{content:'';position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(rgba(217,178,95,.5),rgba(217,178,95,.08),rgba(217,178,95,.5));animation:rotateBorder 4s linear infinite}
        .logo-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--surface)}
        .logo-wrap img{position:relative;z-index:2;object-fit:contain;padding:6px;width:60px;height:60px}
        .logo-hero-wrap{position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center;animation:logoFloat 4s ease-in-out infinite}
        .logo-hero-wrap::before{content:'';position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(rgba(217,178,95,.6),rgba(217,178,95,.1),rgba(217,178,95,.6));animation:rotateBorder 4s linear infinite;z-index:0}
        .logo-hero-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--bg);z-index:1}
        .logo-hero-wrap img{position:relative;z-index:2;object-fit:contain;padding:10px;width:90px;height:90px;border-radius:50%}
        .prize-phase-card{background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border-radius:16px;padding:16px;transition:border-color .2s,transform .2s;}
        .prize-phase-card:hover{transform:translateY(-2px)}
        .grand-card{border-radius:20px;padding:24px 16px;text-align:center;transition:transform .2s;background:linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.01));}
        .grand-card:hover{transform:translateY(-4px)}
        .grand-card.gold-pulse{animation:goldPulse 3s ease-in-out infinite}
        .divider-line{height:1px;flex:1;background:var(--line)}
        .divider-label{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:2px;white-space:nowrap;padding:0 12px}
        .winner-row{display:flex;align-items:center;gap:10;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-top:8px}
        .prize-skel{background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;border-radius:16px}
      `}</style>

      <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(7,8,9,.92)',backdropFilter:'blur(14px)',borderBottom:'1px solid var(--line)',padding:'12px 20px',display:'flex',alignItems:'center',gap:14}}>
        <div className="logo-wrap">
          <img src="/logo-FF.png" alt="الشمعدان" width={60} height={60} loading="eager" />
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:15,color:'var(--gold)'}}>الشمعدان × كأس العالم 2026</div>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>
            {loading ? 'جاري التحميل...' : `${displayedTotalCount} متسابق · صفحة ${displayedPage} من ${displayedPageCount}`}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {currentUser
            ? <Link href="/dashboard" className="nav-pill primary">⚽ توقعاتي</Link>
            : <Link href="/login" className="nav-pill primary">🔑 انضم الآن</Link>}
          <Link href="/" className="nav-pill">🏠 الرئيسية</Link>
        </div>
      </header>

      <div style={{textAlign:'center',padding:'52px 20px 36px',background:'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(217,178,95,.07),transparent)'}}>
        <div className="logo-hero-wrap" style={{margin:'0 auto 20px'}}>
          <img src="/logo-FF.png" alt="شعار الشمعدان" width={90} height={90} loading="eager" />
        </div>
        <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,letterSpacing:4,marginBottom:10}}>WORLD CUP 2026</div>
        <h1 style={{fontSize:'clamp(22px,5vw,36px)',fontWeight:900,marginBottom:8}}>🏆 صدارة المتسابقين</h1>
        <p style={{color:'var(--muted)',fontSize:13,fontWeight:700}}>
          {loading ? '⏳ جاري التحميل...' : `${displayedTotalCount} متسابق`}
        </p>
      </div>

      {!loading && displayedPage === 1 && !isSearching && top3.length >= 3 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:12,padding:'0 20px 40px',maxWidth:500,margin:'0 auto'}}>
          {[1,0,2].map((rank) => {
            const p = top3[rank];
            const isFirst = rank === 0;
            const podiumH = [190,150,120][rank];
            const cols = [
              {bg:'rgba(217,178,95,.9)',glow:'rgba(217,178,95,.4)',text:'#211708'},
              {bg:'rgba(180,180,190,.7)',glow:'rgba(200,200,210,.25)',text:'#111'},
              {bg:'rgba(180,120,60,.7)',glow:'rgba(180,120,60,.25)',text:'#f4f1e8'},
            ];
            const c = cols[rank];
            return (
              <div key={rank} className="top-float" style={{animationDelay:`${rank*0.3}s`,display:'flex',flexDirection:'column',alignItems:'center',flex:isFirst?1.15:1}}>
                {isFirst && <div style={{fontSize:22,marginBottom:4}}>👑</div>}
                <div style={{width:isFirst?62:50,height:isFirst?62:50,borderRadius:'50%',background:`linear-gradient(135deg,${c.bg},rgba(0,0,0,.3))`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:isFirst?20:16,color:c.text,marginBottom:8,boxShadow:`0 0 20px ${c.glow}`}}>
                  {getInitials(p)}
                </div>
                <div style={{fontWeight:800,fontSize:isFirst?13:11,textAlign:'center',maxWidth:80,lineHeight:1.3,marginBottom:4}}>{getName(p)}</div>
                <div style={{fontSize:isFirst?12:10,color:'var(--gold)',fontWeight:900,marginBottom:6}}>{p.total_points} <span style={{opacity:.7}}>نقطة</span></div>
                <div style={{width:'100%',height:podiumH,background:`linear-gradient(180deg,${c.bg},rgba(0,0,0,.2))`,borderRadius:'12px 12px 0 0',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:10,fontSize:22,boxShadow:`0 -4px 20px ${c.glow}`}}>
                  {medals[rank]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section style={{maxWidth:700,margin:'0 auto',padding:'0 16px 48px',animation:'fadeUp .6s cubic-bezier(0.16,1,0.3,1) forwards'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,letterSpacing:3,marginBottom:6}}>🏆 جوائز دوري التوقعات</div>
          <h2 style={{fontSize:'clamp(18px,4vw,24px)',fontWeight:900,marginBottom:6}}>العب وافوز بجوائز حقيقية</h2>
          <p style={{color:'var(--muted)',fontSize:13,lineHeight:1.8}}>جوائز مرحلية وجوائز كبرى للفائزين الكليين</p>
        </div>

        {prizesLoading ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:10,marginBottom:32}}>
            {[1,2,3,4].map(i => <div key={i} className="prize-skel" style={{height:88}} />)}
          </div>
        ) : prizePhases.length === 0 ? null : (
          <>
            {nonGrandPhases.length > 0 && (
              <>
                <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:16}}>
                  <div className="divider-line" />
                  <span className="divider-label">جوائز المراحل</span>
                  <div className="divider-line" />
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:10,marginBottom:32}}>
                  {nonGrandPhases.map((phase) => {
                    const status = getPhaseStatus(phase);
                    const cfg = statusConfig[status];
                    const phaseWinners = prizeWinners.filter(w => w.phase_id === phase.id);
                    const prizes = [phase.prize_label, phase.prize_label_2, phase.prize_label_3].filter(Boolean);
                    const mainPrize = prizes[0] || '—';
                    return (
                      <div key={phase.id} className="prize-phase-card" style={{border:`1px solid ${cfg.bd}`,background:`linear-gradient(135deg,${cfg.bg},rgba(255,255,255,.01))`}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,gap:8,flexWrap:'wrap'}}>
                          <span style={{fontWeight:900,fontSize:13}}>{phase.name}</span>
                          <span style={{fontSize:10,color:cfg.color,fontWeight:700,background:`${cfg.bg}`,border:`1px solid ${cfg.bd}`,padding:'2px 8px',borderRadius:999,whiteSpace:'nowrap'}}>{cfg.label}</span>
                        </div>
                        <div style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>
                          📅 {new Date(phase.start_date+'T12:00:00').toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}
                          {' — '}
                          {new Date(phase.end_date+'T12:00:00').toLocaleDateString('ar-EG',{month:'short',day:'numeric',year:'numeric'})}
                        </div>
                        <div style={{fontWeight:900,fontSize:17,color:'var(--gold)',marginBottom: phaseWinners.length > 0 ? 10 : 0}}>{mainPrize}</div>
                        {phaseWinners.length > 0 && (
                          <div style={{borderTop:'1px solid rgba(255,255,255,.06)',paddingTop:8}}>
                            {phaseWinners.map((w) => (
                              <div key={w.rank} style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                                <span style={{fontSize:13}}>{medals[w.rank-1] || `#${w.rank}`}</span>
                                <span style={{flex:1,fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {(w as any).profiles?.full_name || '—'}
                                </span>
                                <span style={{fontSize:11,color:'var(--gold)',fontWeight:700,flexShrink:0}}>{w.points} نقطة</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {grandPhase && (() => {
              const status = getPhaseStatus(grandPhase);
              const cfg = statusConfig[status];
              const grandWinners = prizeWinners.filter(w => w.phase_id === grandPhase.id);
              const prizes = [grandPhase.prize_label, grandPhase.prize_label_2, grandPhase.prize_label_3].filter(Boolean);
              const grandColors = [
                { color: '#d9b25f', glow: 'rgba(217,178,95,.4)', border: 'rgba(217,178,95,.35)' },
                { color: '#b0b8c1', glow: 'rgba(176,184,193,.2)', border: 'rgba(176,184,193,.25)' },
                { color: '#cd7f32', glow: 'rgba(205,127,50,.2)',  border: 'rgba(205,127,50,.25)' },
              ];
              return (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:16}}>
                    <div className="divider-line" />
                    <span className="divider-label">
                      الجائزة الكبرى — {new Date(grandPhase.end_date+'T12:00:00').toLocaleDateString('ar-EG',{month:'long',day:'numeric',year:'numeric'})}
                    </span>
                    <div className="divider-line" />
                  </div>
                  <div style={{textAlign:'center',marginBottom:14}}>
                    <span style={{fontSize:11,color:cfg.color,fontWeight:700,background:cfg.bg,border:`1px solid ${cfg.bd}`,padding:'4px 14px',borderRadius:999}}>{cfg.label}</span>
                  </div>

                  {prizes.length > 0 && (
                    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(prizes.length,3)},1fr)`,gap:10,marginBottom:8}}>
                      {prizes.slice(0, 3).map((prize, i) => {
                        const gc = grandColors[i];
                        const winner = grandWinners.find(w => w.rank === i + 1);
                        return (
                          <div
                            key={i}
                            className={`grand-card${i===0?' gold-pulse':''}`}
                            style={{border:`1px solid ${gc.border}`,boxShadow:i===0?`0 0 30px ${gc.glow}`:'none'}}
                          >
                            <div style={{fontSize:i===0?38:30,marginBottom:8}}>{medals[i]}</div>
                            <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:8}}>المركز {['الأول','الثاني','الثالث'][i]}</div>
                            <div style={{fontSize:i===0?16:13,fontWeight:900,color:gc.color,lineHeight:1.4,marginBottom:4}}>{prize}</div>
                            {winner ? (
                              <div style={{marginTop:10,borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:8}}>
                                <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:2}}>الفائز</div>
                                <div style={{fontSize:12,fontWeight:800,color:gc.color}}>{(winner as any).profiles?.full_name || '—'}</div>
                                <div style={{fontSize:10,color:'var(--muted)'}}>{winner.points} نقطة</div>
                              </div>
                            ) : (
                              <div style={{fontSize:10,color:'var(--muted)',marginTop:8}}>لم يُعلن بعد</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{textAlign:'center',marginBottom:4}}>
                    <span style={{fontSize:11,color:'rgba(217,178,95,.45)',fontWeight:700}}>
                      * الجائزة الكبرى تراكمية — مجموع النقاط من بداية البطولة حتى نهايتها
                    </span>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </section>

      <div ref={listRef} style={{maxWidth:700,margin:'0 auto',padding:'0 16px 80px',scrollMarginTop:80}}>
        {!loading && currentUser && displayedMyRank > 0 && (
          <div style={{animation:'slideDown 0.5s cubic-bezier(0.16,1,0.3,1) forwards',background:'linear-gradient(135deg,rgba(217,178,95,.12),rgba(217,178,95,.04))',border:'1px solid rgba(217,178,95,.25)',borderRadius:18,padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:16}}>
            <div style={{fontSize:28,flexShrink:0}}>{displayedMyRank<=3?medals[displayedMyRank-1]:`#${displayedMyRank}`}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>{isRoundMode ? `ترتيبك في ${selectedRound}` : 'ترتيبك الحالي'}</div>
              <div style={{fontWeight:900,fontSize:15}}>المركز #{displayedMyRank}</div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {!isSearching && !isRoundMode && displayedMyRank > PAGE_SIZE && (
                <button className="nav-pill" onClick={() => goToPage(Math.ceil(displayedMyRank / PAGE_SIZE))} style={{padding:'6px 14px',fontSize:12}}>
                  اعرض ترتيبي
                </button>
              )}
              <div style={{textAlign:'center'}}>
                <div style={{fontWeight:900,fontSize:22,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{displayedMyPoints}</div>
                <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>نقطة</div>
              </div>
            </div>
          </div>
        )}

        {!loading && rounds.length > 0 && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,justifyContent:'center'}}>
            <button
              className="nav-pill"
              onClick={async () => {
                setSelectedRound('');
                setRoundPlayers([]);
                setSearchQuery('');
                await loadMyRank();
                await loadPage(1);
              }}
              style={!isRoundMode ? {background:'rgba(217,178,95,.12)',border:'1px solid rgba(217,178,95,.28)',color:'var(--gold)'} : {}}
            >
              🌍 الترتيب العام
            </button>
            {rounds.map((round) => (
              <button
                key={round}
                className="nav-pill"
                onClick={async () => {
                  setSelectedRound(round);
                  await loadRoundPlayers(round);
                }}
                style={selectedRound === round ? {background:'rgba(217,178,95,.12)',border:'1px solid rgba(217,178,95,.28)',color:'var(--gold)'} : {}}
              >
                🏁 {round}
              </button>
            ))}
          </div>
        )}

        {!loading && displayedTotalCount > 5 && (
          <div style={{position:'relative',marginBottom:16}}>
            <input type="text" value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);if(e.target.value && !isRoundMode) loadAllForSearch();}} placeholder="🔍 ابحث عن لاعب..." className="search-box" />
            {searchQuery && (
              <button onClick={()=>setSearchQuery('')} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:16,padding:4}}>✕</button>
            )}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 4px'}}>
          <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>
            {isSearching
              ? `نتائج البحث (${filteredPlayers.length})`
              : isRoundMode
                ? `عرض ${filteredPlayers.length} من ${displayedTotalCount}`
                : `عرض ${(currentPage-1)*PAGE_SIZE+1}–${Math.min(currentPage*PAGE_SIZE,totalCount)} من ${totalCount}`
            }
          </div>
          {!isSearching && !isRoundMode && totalPages > 1 && (
            <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>صفحة {currentPage} / {totalPages}</div>
          )}
        </div>

        {(loading || pageLoading) && [1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{height:72,marginBottom:8}} />
        ))}

        {!loading && !pageLoading && filteredPlayers.length === 0 && (
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{fontSize:42,marginBottom:12}}>{isSearching ? '🔍' : '🏆'}</div>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>{isSearching ? `لا توجد نتائج لـ "${searchQuery}"` : 'لم يبدأ السباق بعد!'}</div>
            {!isSearching && <Link href="/login" className="nav-pill primary" style={{marginTop:16}}>🔑 كن الأول</Link>}
          </div>
        )}

        {!loading && !pageLoading && filteredPlayers.map((player, index) => {
          const isMe = player.user_id === currentUser?.id;
          const globalRank = isRoundMode
            ? roundPlayers.findIndex(p => p.user_id === player.user_id) + 1
            : isSearching
              ? allPlayers.findIndex(p => p.user_id === player.user_id) + 1
              : (currentPage - 1) * PAGE_SIZE + index + 1;
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const delay = `${Math.min(index, 10) * 0.04}s`;
          return (
            <button type="button" onClick={() => loadMemberDetails(player)} key={player.user_id} className="player-row" style={{width:'100%',animationDelay:delay,background:isMe?'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))':'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))',border:`1px solid ${isMe?'rgba(217,178,95,.25)':'var(--line)'}`,borderRadius:16,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12,cursor:'pointer',textAlign:'right'}}>
              <div style={{width:32,textAlign:'center',fontWeight:900,fontSize:globalRank<=3?18:13,color:globalRank<=3?'var(--gold)':'var(--muted)',flexShrink:0}}>
                {globalRank<=3 ? medals[globalRank-1] : `#${globalRank}`}
              </div>
              <div style={{width:38,height:38,borderRadius:'50%',background:isMe?'linear-gradient(135deg,rgba(217,178,95,.3),rgba(217,178,95,.1))':'var(--surface-3)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:isMe?'var(--gold)':'var(--muted)',flexShrink:0,border:isMe?'1px solid rgba(217,178,95,.3)':'1px solid var(--line)'}}>
                {getInitials(player)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:5}}>
                  <span style={{fontWeight:800,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getName(player)}</span>
                  {isMe && <span style={{fontSize:10,padding:'1px 7px',borderRadius:999,background:'rgba(217,178,95,.15)',color:'#ffe3a6',fontWeight:700}}>أنت</span>}
                  {player.profile_completed && <span style={{fontSize:10,color:'var(--green)',fontWeight:700}}>✓</span>}
                  <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,marginRight:'auto'}}>{player.predictions_count} توقع</span>
                </div>
                <div style={{height:4,borderRadius:999,background:'rgba(255,255,255,.06)',overflow:'hidden'}}>
                  <div className={animated?'bar-fill':''} style={{height:'100%',borderRadius:999,background:isMe?'linear-gradient(90deg,#d9b25f,#a8761a)':'rgba(255,255,255,.15)',width:`${pct}%`}} />
                </div>
              </div>
              <div style={{textAlign:'center',flexShrink:0}}>
                <div style={{fontWeight:900,fontSize:17,color:isMe?'var(--gold)':'var(--text)',fontVariantNumeric:'tabular-nums'}}>{player.total_points}</div>
                <div style={{fontSize:10,color:'var(--muted)',fontWeight:700}}>نقطة</div>
              </div>
            </button>
          );
        })}

        {!loading && !isSearching && !isRoundMode && totalPages > 1 && (
          <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:24,flexWrap:'wrap'}}>
            <button className="pg-btn" onClick={()=>goToPage(currentPage-1)} disabled={currentPage===1}>›</button>
            {getPageNumbers().map((pg, i) =>
              pg === '...'
                ? <span key={`d${i}`} className="pg-btn" style={{cursor:'default'}}>…</span>
                : <button key={pg} className={`pg-btn${currentPage===pg?' active':''}`} onClick={()=>goToPage(pg as number)}>{pg}</button>
            )}
            <button className="pg-btn" onClick={()=>goToPage(currentPage+1)} disabled={currentPage===totalPages}>‹</button>
          </div>
        )}

        {!loading && !currentUser && displayedTotalCount > 0 && (
          <div style={{marginTop:40,background:'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))',border:'1px solid rgba(217,178,95,.2)',borderRadius:20,padding:'28px 20px',textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:12}}>🏆</div>
            <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>انضم وتنافس معهم!</div>
            <div style={{color:'var(--muted)',fontSize:13,marginBottom:20,lineHeight:1.8}}>سجّل دخولك وابدأ توقعاتك مجاناً</div>
            <Link href="/login" className="nav-pill primary">🔑 سجّل دخولك الآن</Link>
          </div>
        )}

      {selectedPlayer && (
        <div
          onClick={closeMemberModal}
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,.72)',
            backdropFilter:'blur(6px)',
            zIndex:1000,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding:'20px 12px',
          }}
        >
          <div
            onClick={e=>e.stopPropagation()}
            style={{
              width:'100%',
              maxWidth:920,
              maxHeight:'88vh',
              overflowY:'auto',
              background:'linear-gradient(180deg,#111315,#0d0f11)',
              border:'1px solid rgba(217,178,95,.18)',
              borderRadius:24,
              padding:18,
              boxShadow:'0 24px 80px rgba(0,0,0,.45)',
            }}
          >
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:16}}>
              <div>
                <div style={{fontWeight:900,fontSize:22,marginBottom:4}}>{getName(selectedPlayer)}</div>
                <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.8}}>تفاصيل توقعاته للمباريات المنتهية فقط</div>
              </div>
              <button
                type="button"
                onClick={closeMemberModal}
                style={{
                  width:42,height:42,borderRadius:14,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',cursor:'pointer',fontSize:18,flexShrink:0
                }}
              >
                ✕
              </button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:18}}>
              <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>إجمالي النقاط</div>
                <div style={{fontWeight:900,fontSize:24,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{selectedPlayer.total_points || 0}</div>
                {(selectedPlayer.penalty_points || 0) > 0 && (
                  <div style={{fontSize:11,color:'#ffb4b4',marginTop:6,fontWeight:700}}>خصم: -{selectedPlayer.penalty_points}</div>
                )}
              </div>
              <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>عدد التوقعات</div>
                <div style={{fontWeight:900,fontSize:24,fontVariantNumeric:'tabular-nums'}}>{selectedPlayer.predictions_count || 0}</div>
              </div>
              <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>نقاط الدعوات</div>
                <div style={{fontWeight:900,fontSize:24,color:'#5effa8',fontVariantNumeric:'tabular-nums'}}>{selectedPlayer.referral_points || 0}</div>
              </div>
              <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>نقاط البونص</div>
                <div style={{fontWeight:900,fontSize:24,color:'#7db1ff',fontVariantNumeric:'tabular-nums'}}>{selectedPlayer.bonus_points || 0}</div>
              </div>
            </div>

            {memberModalLoading && (
              <div style={{display:'grid',gap:10}}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:140,borderRadius:18}} />)}
              </div>
            )}

            {!memberModalLoading && memberModalError && (
              <div style={{background:'rgba(201,58,47,.08)',border:'1px solid rgba(201,58,47,.2)',borderRadius:16,padding:'14px 16px',color:'#ffb4b4',fontSize:13,fontWeight:700}}>
                {memberModalError}
              </div>
            )}

            {!memberModalLoading && !memberModalError && selectedPredictions.length === 0 && (
              <div style={{textAlign:'center',padding:'50px 20px',color:'var(--muted)'}}>
                <div style={{fontSize:34,marginBottom:8}}>🗂️</div>
                <div style={{fontWeight:800,fontSize:14}}>لا توجد توقعات منتهية لهذا العضو حاليًا</div>
              </div>
            )}

            {!memberModalLoading && !memberModalError && selectedPredictions.length > 0 && (
              <div style={{display:'grid',gap:12}}>
                {selectedPredictions.map((pred, idx) => {
                  const fixture = pred.fixture;
                  const predictionPoints = pred.points || 0;
                  const positivePoints = predictionPoints >= 0;
                  return (
                    <div key={`${pred.id || idx}-${pred.fixture_id || idx}`} style={{background:'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))',border:`1px solid ${positivePoints ? 'var(--line)' : 'rgba(201,58,47,.22)'}`,borderRadius:20,padding:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14,flexWrap:'wrap'}}>
                        <div>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',fontWeight:900,fontSize:18,marginBottom:6}}>
                            {fixture?.home_team_logo && <img src={fixture.home_team_logo} alt="" width={22} height={22} style={{objectFit:'contain',borderRadius:4}} />}
                            <span>{fixture?.home_team_name || pred.home_team || 'صاحب الأرض'}</span>
                            <span style={{color:'var(--muted)',fontSize:15}}>×</span>
                            <span>{fixture?.away_team_name || pred.away_team || 'الضيف'}</span>
                            {fixture?.away_team_logo && <img src={fixture.away_team_logo} alt="" width={22} height={22} style={{objectFit:'contain',borderRadius:4}} />}
                          </div>
                          <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.8}}>
                            {fixture?.round || '—'} • {formatMatchDate(fixture?.match_date)}
                          </div>
                        </div>
                        <div style={{minWidth:110,textAlign:'center',padding:'10px 14px',borderRadius:14,background:positivePoints?'rgba(39,176,110,.08)':'rgba(201,58,47,.08)',border:`1px solid ${positivePoints?'rgba(39,176,110,.18)':'rgba(201,58,47,.22)'}`}}>
                          <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>نقاط التوقع</div>
                          <div style={{fontWeight:900,fontSize:24,color:positivePoints?'#8ff0bb':'#ffb4b4',fontVariantNumeric:'tabular-nums'}}>{predictionPoints}</div>
                        </div>
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
                        <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px'}}>
                          <div style={{fontSize:12,color:'#9fc1ff',fontWeight:800,marginBottom:10}}>توقعه</div>
                          <div style={{fontWeight:900,fontSize:30,fontVariantNumeric:'tabular-nums',marginBottom:8}}>{pred.predicted_home_score ?? '—'} — {pred.predicted_away_score ?? '—'}</div>
                          <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.9}}>
                            ⚽ الهداف المتوقع: {pred.predicted_first_scorer || '—'}<br />
                            🟥 كارت أحمر: {toBool(pred.predicted_red_card) ? 'نعم' : 'لا'}<br />
                            ⚽ ضربة جزاء: {toBool(pred.predicted_penalty) ? 'نعم' : 'لا'}<br />
                            ⏱ وقت إضافي: {toBool(pred.predicted_extra_time) ? 'نعم' : 'لا'}
                          </div>
                        </div>

                        <div style={{background:'rgba(39,176,110,.08)',border:'1px solid rgba(39,176,110,.16)',borderRadius:16,padding:'14px 16px'}}>
                          <div style={{fontSize:12,color:'#8ff0bb',fontWeight:800,marginBottom:10}}>النتيجة الفعلية</div>
                          <div style={{fontWeight:900,fontSize:30,fontVariantNumeric:'tabular-nums',marginBottom:8}}>{fixture?.actual_home_score ?? '—'} — {fixture?.actual_away_score ?? '—'}</div>
                          <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.9}}>
                            ⚽ أول هداف: {fixture?.first_scorer || '—'}<br />
                            🟥 كارت أحمر: {fixture?.red_card_in_match ? 'نعم' : 'لا'}<br />
                            ⚽ ضربة جزاء: {fixture?.penalty_in_match ? 'نعم' : 'لا'}<br />
                            ⏱ وقت إضافي: {fixture?.went_extra_time ? 'نعم' : 'لا'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      </div>
    </>
  );
}
