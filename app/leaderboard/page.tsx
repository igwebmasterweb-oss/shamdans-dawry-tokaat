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
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [myRank, setMyRank] = useState<number>(0);
  const [myPoints, setMyPoints] = useState<number>(0);
  const maxPoints = useRef(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .order('total_points', { ascending: false });

    if (data && data.length > 0) {
      maxPoints.current = Math.max(...data.map((p: any) => p.total_points || 1), 1);
      const mapped = data.map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        total_points: row.total_points || 0,
        predictions_count: row.predictions_count || 0,
        profile_completed: row.profile_completed || false,
      }));
      setPlayers(mapped);

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const idx = mapped.findIndex(p => p.user_id === authData.user.id);
        if (idx >= 0) {
          setMyRank(idx + 1);
          setMyPoints(mapped[idx].total_points);
        }
      }
    }
    setLoading(false);
    setTimeout(() => setAnimated(true), 100);
  };

  const getName = (p: Player) => p.display_name || p.user_email?.split('@')[0] || 'مجهول';
  const getInitials = (p: Player) => getName(p).slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  const filteredPlayers = searchQuery.trim()
    ? players.filter(p =>
        getName(p).toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : players;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg: #070809; --surface: #111315; --surface-2: #171a1d; --surface-3: #1d2125;
          --line: rgba(255,255,255,.08); --text: #f4f1e8; --muted: #a8a39a;
          --gold: #d9b25f; --gold-soft: rgba(217,178,95,.14); --red: #c93a2f;
          --green: #27b06e; --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Cairo', sans-serif;
          background: radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%),
                      radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%),
                      #070809;
          color: var(--text); direction: rtl; min-height: 100vh;
        }
        @keyframes barGrow { from { width: 0% !important; } }
        @keyframes rowIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shimmer {
          0%  { background-position: -200% 0 }
          100%{ background-position:  200% 0 }
        }
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

        .player-row { opacity: 0; animation: rowIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
        .bar-fill { width: 0%; animation: barGrow 1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .top-float { animation: float 3.5s ease-in-out infinite; }
        .skeleton {
          background: linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 18px;
        }
        .my-rank-banner { animation: slideDown 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .nav-pill {
          padding: 9px 20px; border-radius: 999px; border: 1px solid var(--line);
          background: var(--surface-2); color: var(--muted); font-weight: 700;
          text-decoration: none; font-size: 13px; font-family: 'Cairo', sans-serif;
          transition: all .2s; display: inline-flex; align-items: center; gap: 6px;
        }
        .nav-pill:hover { border-color: rgba(217,178,95,.25); color: #f2d79e; }
        .nav-pill.primary {
          background: linear-gradient(135deg,#e0bc73,#b9892d);
          color: #211708; border: none;
          box-shadow: 0 4px 14px rgba(217,178,95,.25);
        }
        .nav-pill.primary:hover { opacity: .88; }
        .search-box {
          width: 100%; padding: 13px 18px; border-radius: 16px;
          border: 1px solid var(--line); background: var(--surface-2);
          color: var(--text); font-family: 'Cairo', sans-serif;
          font-size: 14px; font-weight: 600; outline: none;
          transition: border-color .2s; direction: rtl;
        }
        .search-box:focus { border-color: rgba(217,178,95,.4); }
        .search-box::placeholder { color: var(--muted); }
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(217,178,95,.06), transparent), var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
        fontFamily: "'Cairo', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg,rgba(217,178,95,.2),rgba(217,178,95,.06))',
            border: '1px solid rgba(217,178,95,.2)',
            display: 'grid', placeItems: 'center', fontSize: 20,
          }}>🏆</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>الشمعدان × كأس العالم</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>ترتيب المتسابقين</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {currentUser
            ? <Link href="/dashboard" className="nav-pill primary">⚽ توقعاتي</Link>
            : <Link href="/login" className="nav-pill primary">🔑 سجّل دخولك وانضم</Link>
          }
          <Link href="/" className="nav-pill">🏠 الرئيسية</Link>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <div style={{ textAlign: 'center', padding: '40px 20px 28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold))', borderRadius: 2 }} />
          <span style={{ fontSize: 11, letterSpacing: '.18em', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            World Cup 2026
          </span>
          <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, var(--gold), transparent)', borderRadius: 2 }} />
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
          🏆 صدارة المتسابقين
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {loading ? '⏳ جاري التحميل...' : `${players.length} متسابق · يتحدث تلقائياً`}
        </p>
      </div>

      {/* ══ PODIUM — TOP 3 ══ */}
      {!loading && players.length >= 3 && (
        <div style={{ maxWidth: 680, margin: '0 auto 40px', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14 }}>
            {[1, 0, 2].map((rank) => {
              const p = players[rank];
              const isFirst = rank === 0;
              const podiumH = { 0: 190, 1: 150, 2: 120 };
              const podiumColors = [
                { bg: 'rgba(217,178,95,.9)',    glow: 'rgba(217,178,95,.4)',   text: '#211708' },
                { bg: 'rgba(180,180,190,.7)',   glow: 'rgba(200,200,210,.25)', text: '#111' },
                { bg: 'rgba(180,120,60,.7)',    glow: 'rgba(180,120,60,.25)',  text: '#f4f1e8' },
              ];
              const col = podiumColors[rank];
              return (
                <div
                  key={p.user_id}
                  className={isFirst ? 'top-float' : ''}
                  style={{
                    flex: 1, maxWidth: 200,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  {isFirst && <div style={{ fontSize: 24, marginBottom: 4 }}>👑</div>}
                  <div style={{
                    width: isFirst ? 72 : 58, height: isFirst ? 72 : 58,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${col.bg}, ${col.glow})`,
                    border: `2px solid ${col.bg}`,
                    display: 'grid', placeItems: 'center',
                    fontSize: isFirst ? 24 : 19, fontWeight: 900, color: col.text,
                    boxShadow: `0 8px 24px ${col.glow}`, marginBottom: 10,
                  }}>
                    {getInitials(p)}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: isFirst ? 15 : 13, textAlign: 'center', marginBottom: 4, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getName(p)}
                  </div>
                  <div style={{ fontSize: isFirst ? 20 : 16, fontWeight: 800, color: 'var(--gold)', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {p.total_points} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>نقطة</span>
                  </div>
                  <div style={{
                    width: '100%', height: podiumH[rank as 0|1|2],
                    borderRadius: '14px 14px 0 0',
                    background: `linear-gradient(180deg, ${col.bg}, rgba(0,0,0,.3))`,
                    display: 'grid', placeItems: 'center',
                    boxShadow: `0 -4px 20px ${col.glow}`,
                    fontSize: isFirst ? 36 : 26,
                  }}>
                    {medals[rank]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ MAIN LIST ══ */}
      <div style={{ maxWidth: 800, margin: '0 auto 60px', padding: '0 20px' }}>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--line)', maxWidth: 800, margin: '0 auto 24px' }} />

        {/* ══ MY RANK BANNER ══ */}
        {!loading && currentUser && myRank > 0 && (
          <div className="my-rank-banner" style={{
            background: 'linear-gradient(135deg,rgba(217,178,95,.15),rgba(217,178,95,.06))',
            border: '1px solid rgba(217,178,95,.28)',
            borderRadius: 20, padding: '16px 20px',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(217,178,95,.2)', border: '1px solid rgba(217,178,95,.3)',
              display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0,
            }}>
              {myRank <= 3 ? medals[myRank - 1] : `#${myRank}`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#f2d79e', fontWeight: 700 }}>ترتيبك الحالي</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>المركز #{myRank}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{myPoints}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>نقطة</div>
            </div>
          </div>
        )}

        {/* ══ SECTION LABEL ══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 700 }}>
            {searchQuery ? `نتائج البحث (${filteredPlayers.length})` : 'الترتيب الكامل'}
          </span>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
        </div>

        {/* ══ SEARCH BAR ══ */}
        {!loading && players.length > 5 && (
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث عن لاعب..."
              className="search-box"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: 16, padding: 4,
              }}>✕</button>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: 74, animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}

        {/* Empty — no players */}
        {!loading && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>لم يبدأ السباق بعد!</div>
            <div style={{ fontSize: 14, marginBottom: 20 }}>سجّل دخولك وكن الأول</div>
            <Link href="/login" style={{
              display: 'inline-block', padding: '12px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg,#e0bc73,#b9892d)',
              color: '#211708', fontWeight: 800, textDecoration: 'none', fontSize: 14,
            }}>🔑 سجّل دخولك الآن</Link>
          </div>
        )}

        {/* Empty — no search results */}
        {!loading && players.length > 0 && filteredPlayers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>لا توجد نتائج لـ "{searchQuery}"</div>
          </div>
        )}

        {/* ══ SHIMMER DIVIDER ══ */}
        {!loading && filteredPlayers.length > 0 && (
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--gold), rgba(217,178,95,.4), var(--gold), transparent)',
            marginBottom: 20,
          }} />
        )}

        {/* ══ PLAYER ROWS ══ */}
        {!loading && filteredPlayers.map((player, index) => {
          const isMe = player.user_id === currentUser?.id;
          const globalRank = players.findIndex(p => p.user_id === player.user_id) + 1;
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const delay = `${index * 0.05}s`;

          return (
            <div
              key={player.user_id}
              className="player-row"
              style={{
                animationDelay: delay,
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr auto',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: isMe
                  ? 'linear-gradient(135deg,rgba(217,178,95,.10),rgba(217,178,95,.04))'
                  : 'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))',
                border: isMe ? '1px solid rgba(217,178,95,.28)' : '1px solid var(--line)',
                borderRadius: 20,
                marginBottom: 10,
                transition: 'border-color .2s',
              }}
            >
              {/* Rank */}
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: index < 3 ? 'rgba(217,178,95,.1)' : 'var(--surface-2)',
                border: index < 3 ? '1px solid rgba(217,178,95,.2)' : '1px solid var(--line)',
                display: 'grid', placeItems: 'center',
                color: index < 3 ? 'var(--gold)' : 'var(--muted)',
                fontWeight: 800, fontSize: 14,
                flexShrink: 0,
              }}>
                {globalRank <= 3 ? medals[globalRank - 1] : `#${globalRank}`}
              </div>

              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: isMe
                  ? 'linear-gradient(135deg,rgba(217,178,95,.4),rgba(217,178,95,.15))'
                  : 'var(--surface-3)',
                border: isMe ? '2px solid rgba(217,178,95,.4)' : '1px solid var(--line)',
                display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 14,
                color: index === 0 ? '#211708' : 'var(--gold)',
                flexShrink: 0,
              }}>
                {getInitials(player)}
              </div>

              {/* Name + bar */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: isMe ? 'var(--text)' : 'rgba(244,241,232,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getName(player)}
                  </span>
                  {isMe && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(217,178,95,.18)', border: '1px solid rgba(217,178,95,.3)', color: '#f2d79e', fontWeight: 700, flexShrink: 0 }}>أنت</span>}
                  {player.profile_completed && <span style={{ fontSize: 11, color: 'var(--muted)' }}>✓</span>}
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
                    {player.predictions_count} توقع
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <div
                    className={animated ? 'bar-fill' : ''}
                    style={{
                      height: '100%',
                      width: animated ? `${pct}%` : '0%',
                      borderRadius: 999,
                      background: globalRank === 1
                        ? 'linear-gradient(90deg,#e0bc73,#d9b25f)'
                        : globalRank === 2
                          ? 'linear-gradient(90deg,#b0b0b8,#888890)'
                          : globalRank === 3
                            ? 'linear-gradient(90deg,#c87832,#a05820)'
                            : isMe
                              ? 'linear-gradient(90deg,rgba(217,178,95,.7),rgba(217,178,95,.4))'
                              : 'linear-gradient(90deg,rgba(59,130,246,.5),rgba(99,102,241,.3))',
                      animationDelay: delay,
                      animationDuration: '1s',
                    }}
                  />
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: index < 3 ? 'var(--gold)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {player.total_points}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>نقطة</div>
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}
