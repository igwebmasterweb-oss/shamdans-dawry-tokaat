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
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const maxPoints = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isSearching = searchQuery.trim().length > 0;
  const isRoundMode = selectedRound.trim().length > 0;

  const penaltyFor = (userId?: string | null) =>
    userId ? (penaltyMap[userId] || 0) : 0;

  // ── Effect 1: init
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    loadPenaltyMap();
    loadRounds();
    loadPrizes();
  }, []);

  // ── Effect 2: بعد تحميل penaltyMap نحمّل الترتيب والصفحة
  useEffect(() => {
    loadMyRank();
    loadPage(1);
  }, [penaltyMap]);

  // ── Effect 3: البحث
  useEffect(() => {
    if (isSearching) loadAllForSearch();
    else loadPage(currentPage);
  }, [isSearching]);

  // ── Effect 4: تغيير الجولة ← هذا كان الناقص
  useEffect(() => {
    if (isRoundMode) {
      loadRoundRows(selectedRound);
    } else {
      setRoundRows([]);
      loadMyRank();
      loadPage(1);
    }
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
      const uniqueRounds = Array.from(
        new Set((data || []).map((row: any) => row?.round).filter(Boolean))
      ) as string[];
      setRounds(uniqueRounds);
    } catch (err) {
      console.error('loadRounds:', err);
    }
  };

  const loadRoundRows = async (round: string) => {
    if (!round) return;
    setRoundLoading(true);
    try {
      // جلب fixture ids للجولة المختارة
      const { data: fixtureRows } = await supabase
        .from('fixtures')
        .select('api_fixture_id')
        .eq('round', round);

      const fixtureIds = new Set(
        (fixtureRows || []).map((row: any) => Number(row.api_fixture_id)).filter(Boolean)
      );

      if (fixtureIds.size === 0) {
        setRoundRows([]);
        setRoundLoading(false);
        return;
      }

      // جلب predictions + user_points معاً
      const [{ data: predictionRows }, { data: userPointsRows }] = await Promise.all([
        supabase
          .from('predictions')
          .select('user_id, fixture_id, points'),
        supabase
          .from('user_points')
          .select('user_id, user_email, full_name, profile_completed, referral_points, bonus_points'),
      ]);

      const userMeta = new Map(
        (userPointsRows || []).map((row: any) => [row.user_id, row])
      );

      // تجميع نقاط الجولة لكل لاعب
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
            total_points: agg.total_points,        // نقاط الجولة فقط، بدون خصم
            raw_total_points: agg.total_points,
            round_points: agg.total_points,
            penalty_points: 0,                      // الجولات لا تتأثر بالخصم
            predictions_count: agg.predictions_count,
            profile_completed: meta?.profile_completed || false,
            referral_points: meta?.referral_points || 0,
            bonus_points: meta?.bonus_points || 0,
          };
        })
        .sort((a, b) => {
          if ((b.total_points || 0) !== (a.total_points || 0))
            return (b.total_points || 0) - (a.total_points || 0);
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
    setTimeout(() => setAnimated(
