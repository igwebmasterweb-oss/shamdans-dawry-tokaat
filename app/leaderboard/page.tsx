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
  round_points?: number;
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
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
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
  const [rounds, setRounds] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [roundRows, setRoundRows] = useState<Player[]>([]);
  const [roundLoading, setRoundLoading] = useState(false);
  const [penaltyMap, setPenaltyMap] = useState<Record<string, number>>({});

  const maxPoints = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isSearching = searchQuery.trim().length > 0;
  const isRoundMode = selectedRound.trim().length > 0;
  const penaltyFor = (userId?: string | null) => (userId ? penaltyMap[userId] || 0 : 0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    loadPenaltyMap();
    loadRounds();
    loadPrizes();
  }, []);

  useEffect(() => {
    if (Object.keys(penaltyMap).length === 0 && !loading) return;
    if (isRoundMode) return;
    loadMyRank();
    if (isSearching) loadAllForSearch();
    else loadPage(currentPage);
  }, [penaltyMap]);

  useEffect(() => {
    if (isRoundMode) return;
    if (isSearching) loadAllForSearch();
    else loadPage(currentPage);
  }, [isSearching]);

  useEffect(() => {
    if (!selectedRound) return;
    setSearchQuery('');
    loadRoundRows(selectedRound);
  }, [selectedRound]);

  const loadPenaltyMap = async () => {
    try {
      const { data } = await supabase
        .from('user_penalty_notices')
        .select('user_id, penalty_points')
        .eq('is_active', true);

      const nextMap: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row?.user_id) nextMap[row.user_id] = Number(row?.penalty_points || 0);
      });
      setPenaltyMap(nextMap);
    } catch (err) {
      console.error('loadPenaltyMap:', err);
      setPenaltyMap({});
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
      setPrizePhases((phases || []) as PrizePhase[]);
      setPrizeWinners((winners || []) as PrizeWinner[]);
    } catch (err) {
      console.error('loadPrizes:', err);
    }
    setPrizesLoading(false);
  };

  const loadMyRank = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const [{ data: myData }, { data: allRows }] = await Promise.all([
      supabase.from('user_points').select('*').eq('user_id', authData.user.id).single(),
      supabase.from('user_points').select('*'),
    ]);

    if (!myData) return;

    const adjustedRows = (allRows || [])
      .map((row: any) => ({
        user_id: row.user_id,
        adjusted_total: Number(row?.total_points || 0) - penaltyFor(row?.user_id),
      }))
      .sort((a, b) => (b.adjusted_total || 0) - (a.adjusted_total || 0));

    const myAdjustedPoints = Number(myData?.total_points || 0) - penaltyFor(authData.user.id);
    setMyPoints(myAdjustedPoints);
    setMyRank(adjustedRows.findIndex((row) => row.user_id === authData.user.id) + 1);
  };

  const loadPage = async (page: number) => {
    if (page !== 1) setPageLoading(true);

    const { data: allData } = await supabase.from('user_points').select('*');

    const adjustedData: Player[] = (allData || [])
      .map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        total_points: Number(row?.total_points || 0) - penaltyFor(row?.user_id),
        raw_total_points: Number(row?.total_points || 0),
        penalty_points: penaltyFor(row?.user_id),
        predictions_count: row.predictions_count || 0,
        profile_completed: row.profile_completed || false,
        referral_points: row.referral_points || 0,
        bonus_points: row.bonus_points || 0,
      }))
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    const pageRows = adjustedData.slice(from, to);

    if (page === 1 && pageRows.length > 0) maxPoints.current = pageRows[0].total_points || 1;
    setPlayers(pageRows);
    setTotalCount(adjustedData.length);
    setCurrentPage(page);
    setLoading(false);
    setPageLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
  };

  const loadAllForSearch = async () => {
    const { data } = await supabase.from('user_points').select('*');

    if (data) {
      const adjusted: Player[] = (data || [])
        .map((row: any) => ({
          user_id: row.user_id,
          user_email: row.user_email,
          display_name: row.full_name || null,
          total_points: Number(row?.total_points || 0) - penaltyFor(row?.user_id),
          raw_total_points: Number(row?.total_points || 0),
          penalty_points: penaltyFor(row?.user_id),
          predictions_count: row.predictions_count || 0,
          profile_completed: row.profile_completed || false,
          referral_points: row.referral_points || 0,
          bonus_points: row.bonus_points || 0,
        }))
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

      setAllPlayers(adjusted);
    }
  };

  const loadRoundRows = async (round: string) => {
    if (!round) return;
    setRoundLoading(true);
    setLoading(false);
    setPageLoading(false);

    try {
      const [{ data: predictionRows }, { data: fixtureRows }, { data: userPointsRows }] = await Promise.all([
        supabase.from('predictions').select('user_id, fixture_id, points'),
        supabase.from('fixtures').select('api_fixture_id').eq('round', round),
        supabase.from('user_points').select('user_id, user_email, full_name, profile_completed, referral_points, bonus_points'),
      ]);

      const fixtureIds = new Set((fixtureRows || []).map((row: any) => Number(row.api_fixture_id)).filter(Boolean));
      const userMeta = new Map((userPointsRows || []).map((row: any) => [row.user_id, row]));
      const grouped = new Map<string, { total_points: number; predictions_count: number }>();

      (predictionRows || []).forEach((row: any) => {
        const fixtureId = Number(row?.fixture_id || 0);
        if (!fixtureIds.has(fixtureId)) return;
        const userId = row?.user_id;
        if (!userId) return;

        const prev = grouped.get(userId) || { total_points: 0, predictions_count: 0 };
        grouped.set(userId, {
          total_points: prev.total_points + Number(row?.points || 0),
          predictions_count: prev.predictions_count + 1,
        });
      });

      const nextRows: Player[] = Array.from(grouped.entries())
        .map(([user_id, agg]) => {
          const meta = userMeta.get(user_id);
          return {
            user_id,
            user_email: meta?.user_email || '',
            display_name: meta?.full_name || null,
            total_points: agg.total_points,
            raw_total_points: agg.total_points,
            round_points: agg.total_points,
            penalty_points: 0,
            predictions_count: agg.predictions_count,
            profile_completed: meta?.profile_completed || false,
            referral_points: meta?.referral_points || 0,
            bonus_points: meta?.bonus_points || 0,
          };
        })
        .sort((a, b) => {
          if ((b.total_points || 0) !== (a.total_points || 0)) return (b.total_points || 0) - (a.total_points || 0);
          return (b.predictions_count || 0) - (a.predictions_count || 0);
        });

      setRoundRows(nextRows);
      if (nextRows.length > 0) maxPoints.current = nextRows[0].total_points || 1;
    } catch (err) {
      console.error('loadRoundRows:', err);
      setRoundRows([]);
    }

    setRoundLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
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
          .not('actual_away_score', 'is', null),
      ]);

      if (predictionsError) throw predictionsError;
      if (fixturesError) throw fixturesError;

      const fixturesMap = new Map((fixturesData || []).map((f: any) => [Number(f.api_fixture_id), f]));

      const merged = (predictionsData || [])
        .map((pred: any) => {
          const fixtureKey = Number(pred.fixture_id);
          const fixture = fixturesMap.get(fixtureKey);
          return { ...pred, fixture: fixture || null };
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

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadPage(page);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getName = (p: Player) => p.display_name || p.user_email?.split('@')[0] || 'مجهول';
  const getInitials = (p: Player) => getName(p).slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

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

  const displayedPlayers = isRoundMode ? roundRows : players;
  const displayedAllPlayers = isRoundMode ? roundRows : allPlayers;
  const displayedTotalCount = isRoundMode ? roundRows.length : totalCount;
  const displayedTotalPages = isRoundMode ? 1 : totalPages;
  const displayedCurrentPage = isRoundMode ? 1 : currentPage;
  const displayedMyRank = isRoundMode ? roundRows.findIndex((p) => p.user_id === currentUser?.id) + 1 : myRank;
  const displayedMyPoints = isRoundMode ? roundRows.find((p) => p.user_id === currentUser?.id)?.total_points || 0 : myPoints;

  const filteredPlayers = isSearching
    ? displayedAllPlayers.filter(
        (p) => getName(p).toLowerCase().includes(searchQuery.toLowerCase()) || p.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayedPlayers;

  const top3 = displayedPlayers.slice(0, 3);
  const today = new Date().toISOString().split('T')[0];

  const getPhaseStatus = (phase: PrizePhase) => {
    const winners = prizeWinners.filter((w) => w.phase_id === phase.id);
    if (winners.length > 0) return 'completed';
    if (phase.end_date < today) return 'past';
    if (phase.start_date <= today && phase.end_date >= today) return 'active';
    return 'upcoming';
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; bd: string }> = {
    completed: { label: '✅ مكتملة', color: '#5effa8', bg: 'rgba(39,176,110,.12)', bd: 'rgba(39,176,110,.25)' },
    active: { label: '🔴 نشطة', color: '#d9b25f', bg: 'rgba(217,178,95,.12)', bd: 'rgba(217,178,95,.28)' },
    past: { label: '⏳ انتهت', color: '#ff9c91', bg: 'rgba(201,58,47,.08)', bd: 'rgba(201,58,47,.2)' },
    upcoming: { label: '⏰ قادمة', color: '#a8a39a', bg: 'rgba(255,255,255,.04)', bd: 'rgba(255,255,255,.08)' },
  };

  const grandPhase = prizePhases.find((p) => p.is_cumulative && p.winner_count >= 1);
  const nonGrandPhases = prizePhases.filter((p) => !(p.is_cumulative && p.winner_count >= 1) || p !== grandPhase);

  return (
    <>
      <div ref={listRef} style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px 80px', scrollMarginTop: 80 }}>
        {!loading && !roundLoading && currentUser && displayedMyRank > 0 && (
          <div style={{ animation: 'slideDown 0.5s cubic-bezier(0.16,1,0.3,1) forwards', background: 'linear-gradient(135deg,rgba(217,178,95,.12),rgba(217,178,95,.04))', border: '1px solid rgba(217,178,95,.25)', borderRadius: 18, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{displayedMyRank <= 3 ? medals[displayedMyRank - 1] : `#${displayedMyRank}`}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{isRoundMode ? `ترتيبك في ${selectedRound}` : 'ترتيبك الحالي'}</div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>المركز #{displayedMyRank}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isSearching && !isRoundMode && displayedMyRank > PAGE_SIZE && (
                <button className="nav-pill" onClick={() => goToPage(Math.ceil(displayedMyRank / PAGE_SIZE))} style={{ padding: '6px 14px', fontSize: 12 }}>
                  اعرض ترتيبي
                </button>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{displayedMyPoints}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>نقطة</div>
              </div>
            </div>
          </div>
        )}

        {!loading && rounds.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <button
              className="nav-pill"
              onClick={() => {
                setSelectedRound('');
                setSearchQuery('');
                setRoundRows([]);
                loadMyRank();
                loadPage(1);
              }}
              style={{
                background: !isRoundMode ? 'linear-gradient(135deg,rgba(217,178,95,.14),rgba(217,178,95,.05))' : '',
                border: !isRoundMode ? '1px solid rgba(217,178,95,.35)' : '',
                color: !isRoundMode ? 'var(--gold)' : '',
              }}
            >
              🌍 الترتيب العام
            </button>
            {rounds.map((round) => {
              const active = selectedRound === round;
              return (
                <button
                  key={round}
                  className="nav-pill"
                  onClick={() => setSelectedRound(round)}
                  style={{
                    background: active ? 'linear-gradient(135deg,rgba(59,130,246,.16),rgba(59,130,246,.06))' : '',
                    border: active ? '1px solid rgba(59,130,246,.45)' : '',
                    color: active ? '#93c5fd' : '',
                  }}
                >
                  🏁 {round}
                </button>
              );
            })}
          </div>
        )}

        {!loading && displayedTotalCount > 5 && (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value && !isRoundMode) loadAllForSearch();
              }}
              placeholder="🔍 ابحث عن لاعب..."
              className="search-box"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                ✕
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
            {isSearching ? `نتائج البحث (${filteredPlayers.length})` : isRoundMode ? `ترتيب ${selectedRound} — ${displayedTotalCount} لاعب` : `عرض ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalCount)} من ${totalCount}`}
          </div>
          {!isSearching && !isRoundMode && totalPages > 1 && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>صفحة {currentPage} / {totalPages}</div>}
        </div>

        {(loading || pageLoading || roundLoading) && [1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8 }} />)}

        {!loading && !pageLoading && filteredPlayers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{isSearching ? '🔍' : '🏆'}</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{isSearching ? `لا توجد نتائج لـ "${searchQuery}"` : isRoundMode ? `لا توجد نتائج في ${selectedRound}` : 'لم يبدأ السباق بعد!'}</div>
          </div>
        )}

        {!loading && !pageLoading && filteredPlayers.map((player, index) => {
          const isMe = player.user_id === currentUser?.id;
          const globalRank = isSearching || isRoundMode ? displayedPlayers.findIndex((p) => p.user_id === player.user_id) + 1 : (currentPage - 1) * PAGE_SIZE + index + 1;
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const delay = `${Math.min(index, 10) * 0.04}s`;
          return (
            <button type="button" onClick={() => loadMemberDetails(player)} key={player.user_id} className="player-row" style={{ width: '100%', animationDelay: delay, background: isMe ? 'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))' : 'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))', border: `1px solid ${isMe ? 'rgba(217,178,95,.25)' : 'var(--line)'}`, borderRadius: 16, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'right' }}>
              <div style={{ width: 32, textAlign: 'center', fontWeight: 900, fontSize: globalRank <= 3 ? 18 : 13, color: globalRank <= 3 ? 'var(--gold)' : 'var(--muted)', flexShrink: 0 }}>{globalRank <= 3 ? medals[globalRank - 1] : `#${globalRank}`}</div>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: isMe ? 'linear-gradient(135deg,rgba(217,178,95,.3),rgba(217,178,95,.1))' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: isMe ? 'var(--gold)' : 'var(--muted)', flexShrink: 0, border: isMe ? '1px solid rgba(217,178,95,.3)' : '1px solid var(--line)' }}>
                {getInitials(player)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getName(player)}</span>
                  {isMe && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(217,178,95,.15)', color: '#ffe3a6', fontWeight: 700 }}>أنت</span>}
                  {player.profile_completed && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>✓</span>}
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginRight: 'auto' }}>{player.predictions_count} توقع</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div className={animated ? 'bar-fill' : ''} style={{ height: '100%', borderRadius: 999, background: isMe ? 'linear-gradient(90deg,#d9b25f,#a8761a)' : 'rgba(255,255,255,.15)', width: `${pct}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: isMe ? 'var(--gold)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{player.total_points}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>نقطة</div>
              </div>
            </button>
          );
        })}

        {!loading && !isSearching && !isRoundMode && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="pg-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>›</button>
            {getPageNumbers().map((pg, i) =>
              pg === '...' ? (
                <span key={`d${i}`} className="pg-btn" style={{ cursor: 'default' }}>…</span>
              ) : (
                <button key={pg} className={`pg-btn${currentPage === pg ? ' active' : ''}`} onClick={() => goToPage(pg as number)}>{pg}</button>
              )
            )}
            <button className="pg-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>‹</button>
          </div>
        )}

        {!loading && !currentUser && totalCount > 0 && (
          <div style={{ marginTop: 40, background: 'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', border: '1px solid rgba(217,178,95,.2)', borderRadius: 20, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>انضم وتنافس معهم!</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.8 }}>سجّل دخولك وابدأ توقعاتك مجاناً</div>
            <Link href="/login" className="nav-pill primary">🔑 سجّل دخولك الآن</Link>
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div onClick={closeMemberModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 920, maxHeight: '88vh', overflowY: 'auto', background: 'linear-gradient(180deg,#111315,#0d0f11)', border: '1px solid rgba(217,178,95,.18)', borderRadius: 24, padding: 18, boxShadow: '0 24px 80px rgba(0,0,0,.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{getName(selectedPlayer)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>تفاصيل توقعاته للمباريات المنتهية فقط</div>
              </div>
              <button onClick={closeMemberModal} className="nav-pill">✕ إغلاق</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
              <div className="stat-card"><div>إجمالي النقاط</div><div>{selectedPlayer.total_points || 0}</div></div>
              <div className="stat-card"><div>عدد التوقعات</div><div>{selectedPlayer.predictions_count || 0}</div></div>
              <div className="stat-card"><div>نقاط الدعوات</div><div>{selectedPlayer.referral_points || 0}</div></div>
              <div className="stat-card"><div>نقاط البونص</div><div>{selectedPlayer.bonus_points || 0}</div></div>
            </div>

            {memberModalLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 10 }} />)}
            {!memberModalLoading && memberModalError && <div style={{ color: '#ff9c91' }}>{memberModalError}</div>}
            {!memberModalLoading && !memberModalError && selectedPredictions.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>🗂️ لا توجد توقعات منتهية لهذا العضو حاليًا</div>}

            {!memberModalLoading && !memberModalError && selectedPredictions.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {selectedPredictions.map((pred, idx) => {
                  const fixture = pred.fixture;
                  const predictionPoints = pred.points || 0;
                  const positivePoints = predictionPoints >= 0;
                  return (
                    <div key={`${pred.id || idx}-${fixture?.api_fixture_id || idx}`} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800 }}>{fixture?.home_team_name || pred.home_team || 'صاحب الأرض'} × {fixture?.away_team_name || pred.away_team || 'الضيف'}</div>
                        <div style={{ color: positivePoints ? '#5effa8' : '#ff9c91', fontWeight: 900 }}>نقاط التوقع {predictionPoints}</div>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>{fixture?.round || '—'} • {formatMatchDate(fixture?.match_date)}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>توقعه</div>
                          <div>{pred.predicted_home_score ?? '—'} — {pred.predicted_away_score ?? '—'}</div>
                          <div>⚽ الهداف المتوقع: {pred.predicted_first_scorer || '—'}</div>
                          <div>🟥 كارت أحمر: {toBool(pred.predicted_red_card) ? 'نعم' : 'لا'}</div>
                          <div>⚽ ضربة جزاء: {toBool(pred.predicted_penalty) ? 'نعم' : 'لا'}</div>
                          <div>⏱ وقت إضافي: {toBool(pred.predicted_extra_time) ? 'نعم' : 'لا'}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>النتيجة الفعلية</div>
                          <div>{fixture?.actual_home_score ?? '—'} — {fixture?.actual_away_score ?? '—'}</div>
                          <div>⚽ أول هداف: {fixture?.first_scorer || '—'}</div>
                          <div>🟥 كارت أحمر: {fixture?.red_card_in_match ? 'نعم' : 'لا'}</div>
                          <div>⚽ ضربة جزاء: {fixture?.penalty_in_match ? 'نعم' : 'لا'}</div>
                          <div>⏱ وقت إضافي: {fixture?.went_extra_time ? 'نعم' : 'لا'}</div>
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
    </>
  );
}
