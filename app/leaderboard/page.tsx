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

  const mapGeneralPlayer = (row: any): Player => ({
    user_id: row.user_id,
    user_email: row.user_email || '',
    display_name: row.full_name || null,
    raw_total_points: Number(row.final_points || 0),
    penalty_points: Number(row.penalty_points || 0),
    total_points: Number(row.final_points || 0),
    predictions_count: row.predictions_count || 0,
    profile_completed: row.profile_completed || false,
    referral_points: row.referral_points || 0,
    bonus_points: row.bonus_points || 0,
  });

  const loadGeneralLeaderboard = async () => {
    const { data, error } = await supabase
      .from('leaderboard_general_v1')
      .select('user_id, full_name, user_email, final_points, predictions_count, profile_completed, penalty_points, referral_points, bonus_points')
      .order('final_points', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapGeneralPlayer).sort((a, b) => b.total_points - a.total_points);
  };

  const initializeData = async () => {
    await Promise.all([
      loadMyRank(),
      loadPage(1),
      loadRounds(),
      loadPrizes(),
    ]);
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

  const loadMyRank = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const adjustedAll = await loadGeneralLeaderboard();
    const me = adjustedAll.find((row: any) => row.user_id === authData.user.id);
    if (!me) return;

    setMyPoints(me.total_points || 0);
    setMyRank(adjustedAll.findIndex((row: any) => row.user_id === authData.user.id) + 1);
  };

  const loadPage = async (page: number) => {
    if (page !== 1) setPageLoading(true);

    const adjustedRows = await loadGeneralLeaderboard();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    const pageRows = adjustedRows.slice(from, to);

    if (page === 1 && pageRows.length > 0) maxPoints.current = pageRows[0].total_points || 1;
    setPlayers(pageRows);
    setTotalCount(adjustedRows.length);
    setCurrentPage(page);

    setLoading(false);
    setPageLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
  };

  const loadAllForSearch = async () => {
    const adjustedRows = await loadGeneralLeaderboard();
    setAllPlayers(adjustedRows);
  };


