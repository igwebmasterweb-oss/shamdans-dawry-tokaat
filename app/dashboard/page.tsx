'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

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
  const [loaded, setLoaded]   = useState(false);
  const [search, setSearch]   = useState('');
  const [open,   setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!homeTeam || !awayTeam) return;
    setLoaded(false);
    setPlayers([]);
    async function load() {
      // ① team_players — السكواد الكامل للفريقين
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

      // ② fallback: fixture_players — التشكيل الفعلي
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

  // إغلاق الـ dropdown لو ضغط برّا
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // لو مفيش لاعبين → input عادي
  if (loaded && players.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="field-input"
        placeholder="اكتب اسم الهداف..."
        style={{ flex: 1 }}
      />
    );
  }

  const filtered     = players.filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()));
  const homePlayers  = filtered.filter(p => p.team_name === homeTeam);
  const awayPlayers  = filtered.filter(p => p.team_name === awayTeam);

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      {/* زر الاختيار */}
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
        <span>{!loaded ? '⏳ جاري التحميل...' : (value || 'اختر الهداف...')}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && loaded && (
        <div style={{
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
        }}>
          {/* Search */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface-2)',
          }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
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

          {/* الفريق الأول */}
          {homePlayers.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
                🏠 {homeTeam}
              </div>
              {homePlayers.map(p => (
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
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 22 }}>{p.position?.[0] ?? '—'}</span>
                  {p.player_name}
                </button>
              ))}
            </>
          )}

          {/* الفريق الثاني */}
          {awayPlayers.length > 0 && (
            <>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: '#7db1ff', fontWeight: 700 }}>
                ✈️ {awayTeam}
              </div>
              {awayPlayers.map(p => (
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
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 22 }}>{p.position?.[0] ?? '—'}</span>
                  {p.player_name}
                </button>
              ))}
            </>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              لا توجد نتائج
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser]                     = useState<any>(null);
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [matches, setMatches]               = useState<any[]>([]);
  const [predictions, setPredictions]       = useState<any[]>([]);
  const [leaderboard, setLeaderboard]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  // ① loadError state
  const [loadError, setLoadError]           = useState(false);
  const [activeTab, setActiveTab]           = useState<'predict' | 'my' | 'leaders' | 'feed' | 'history'>('predict');
  const [activeRound, setActiveRound]       = useState('');
  const [predForms, setPredForms]           = useState<Record<number, any>>({});
  const [submitting, setSubmitting]         = useState<number | null>(null);
  const [messages, setMessages]             = useState<Record<number, string>>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm]       = useState({ display_name: '', phone: '', facebook_url: '' });
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileMsg, setProfileMsg]         = useState('');
  const [referralCode, setReferralCode]     = useState('');
  const [referralCount, setReferralCount]   = useState(0);
  const [myTotalPoints, setMyTotalPoints]   = useState(0);
  const [showReferral, setShowReferral]     = useState(false);
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
  const router = useRouter();

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
    // ① reset error on each attempt
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
            type: 'invite_fri