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

const TEAM_COLORS = [
  { bg: '#e8002d', glow: 'rgba(232,0,45,0.4)', name: 'Ferrari' },
  { bg: '#3671C6', glow: 'rgba(54,113,198,0.4)', name: 'Red Bull' },
  { bg: '#27F4D2', glow: 'rgba(39,244,210,0.4)', name: 'Mercedes' },
  { bg: '#FF8000', glow: 'rgba(255,128,0,0.4)', name: 'McLaren' },
  { bg: '#00D2BE', glow: 'rgba(0,210,190,0.4)', name: 'Aston Martin' },
  { bg: '#B6BABD', glow: 'rgba(182,186,189,0.4)', name: 'Williams' },
  { bg: '#52E252', glow: 'rgba(82,226,82,0.4)', name: 'Kick' },
  { bg: '#9B0000', glow: 'rgba(155,0,0,0.4)', name: 'Haas' },
];

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const maxPoints = useRef(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user || null);
    });
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .order('total_points', { ascending: false });

    if (data && data.length > 0) {
      maxPoints.current = Math.max(...data.map((p: any) => p.total_points || 1), 1);
      setPlayers(data.map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        total_points: row.total_points || 0,
        predictions_count: row.predictions_count || 0,
        profile_completed: row.profile_completed || false,
      })));
    }
    setLoading(false);
    setTimeout(() => setAnimated(true), 100);
  };

  const getName = (p: Player) => p.display_name || p.user_email?.split('@')[0] || 'مجهول';
  const getInitials = (p: Player) => getName(p).slice(0, 2).toUpperCase();
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'Tajawal, sans-serif',
      direction: 'rtl',
      overflowX: 'hidden',
    }}>

      {/* ── GOOGLE FONT ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');

        @keyframes trackSlide {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes barGrow {
          from { width: 0% !important; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes carReveal {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .car-row {
          opacity: 0;
          animation: carReveal 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .bar-fill {
          width: 0%;
          animation: barGrow 1s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .top-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      {/* ── BACKGROUND GRID ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* ── SCANLINE EFFECT ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.03) 50%)',
        backgroundSize: '100% 4px',
        opacity: 0.4,
      }} />

      {/* ── HEADER ── */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '40px 20px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 4, background: '#e8002d', borderRadius: 2 }} />
          <span style={{ fontSize: 12, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            الشمعدان × كأس العالم 2026
          </span>
          <div style={{ width: 40, height: 4, background: '#e8002d', borderRadius: 2 }} />
        </div>
        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 4rem)',
          fontWeight: 900,
          margin: 0,
          background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          🏁 سباق التوقعات
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>
          {players.length} متسابق · يتحدث تلقائياً
        </p>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          {currentUser ? (
            <Link href="/dashboard" style={{
              padding: '10px 24px', borderRadius: 100, background: '#e8002d',
              color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14,
              fontFamily: 'Tajawal, sans-serif',
            }}>⚽ توقعاتي</Link>
          ) : (
            <Link href="/login" style={{
              padding: '10px 24px', borderRadius: 100, background: '#e8002d',
              color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14,
              fontFamily: 'Tajawal, sans-serif',
            }}>🔑 سجّل دخولك وانضم</Link>
          )}
          <Link href="/" style={{
            padding: '10px 24px', borderRadius: 100,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', fontWeight: 700, textDecoration: 'none', fontSize: 14,
            fontFamily: 'Tajawal, sans-serif',
          }}>🏠 الرئيسية</Link>
        </div>
      </div>

      {/* ── PODIUM (Top 3) ── */}
      {!loading && players.length >= 3 && (
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 700, margin: '30px auto 0', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
            {/* 2nd place */}
            {[1, 0, 2].map((rank) => {
              const p = players[rank];
              const color = TEAM_COLORS[rank % TEAM_COLORS.length];
              const heights = [160, 200, 130];
              const h = heights[rank === 0 ? 1 : rank === 1 ? 0 : 2];
              const isFirst = rank === 0;
              return (
                <div key={p.user_id} className={isFirst ? 'top-float' : ''} style={{
                  flex: 1, maxWidth: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: isFirst ? 72 : 56, height: isFirst ? 72 : 56,
                    borderRadius: '50%', background: color.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isFirst ? 24 : 18, fontWeight: 900,
                    boxShadow: `0 0 ${isFirst ? 30 : 16}px ${color.glow}`,
                    marginBottom: 8, border: `2px solid ${color.bg}`,
                  }}>
                    {getInitials(p)}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: isFirst ? 16 : 14, textAlign: 'center', marginBottom: 4 }}>
                    {getName(p)}
                  </div>
                  <div style={{ fontSize: isFirst ? 22 : 18, fontWeight: 900, color: color.bg, marginBottom: 8 }}>
                    {p.total_points} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>نقطة</span>
                  </div>
                  {/* Podium block */}
                  <div style={{
                    width: '100%', height: h,
                    background: `linear-gradient(180deg, ${color.bg}22, ${color.bg}11)`,
                    border: `1px solid ${color.bg}44`,
                    borderBottom: 'none', borderRadius: '8px 8px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36,
                  }}>
                    {medals[rank]}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Finish line */}
          <div style={{
            height: 6, background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 20px, #000 20px, #000 40px)',
            borderRadius: 3, opacity: 0.8,
          }} />
        </div>
      )}

      {/* ── RACE TRACK (Full List) ── */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 800, margin: '40px auto 60px', padding: '0 20px' }}>

        {/* Track label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            ترتيب السباق الكامل
          </span>
          <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {loading ? (
          /* Skeleton */
          <div>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                height: 72, borderRadius: 16, marginBottom: 10,
                background: 'rgba(255,255,255,0.04)',
                animation: 'pulse-glow 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
            <p>لم يبدأ السباق بعد!</p>
            <Link href="/login" style={{ color: '#e8002d', fontWeight: 700, textDecoration: 'none' }}>
              سجّل دخولك وكن الأول
            </Link>
          </div>
        ) : players.map((player, index) => {
          const color = TEAM_COLORS[index % TEAM_COLORS.length];
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const isCurrentUser = player.user_id === currentUser?.id;
          const delay = `${index * 0.07}s`;

          return (
            <div
              key={player.user_id}
              className="car-row"
              style={{
                animationDelay: delay,
                marginBottom: 10,
                background: isCurrentUser
                  ? `linear-gradient(135deg, ${color.bg}15, rgba(255,255,255,0.03))`
                  : 'rgba(255,255,255,0.03)',
                border: isCurrentUser
                  ? `1px solid ${color.bg}50`
                  : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16,
                padding: '14px 18px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                {/* Position number */}
                <div style={{
                  minWidth: 40, textAlign: 'center',
                  fontWeight: 900,
                  fontSize: index < 3 ? 22 : 16,
                  color: index < 3 ? color.bg : 'rgba(255,255,255,0.3)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {index < 3 ? medals[index] : `P${index + 1}`}
                </div>

                {/* Avatar circle */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${color.bg}, ${color.bg}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 14,
                  boxShadow: `0 0 12px ${color.glow}`,
                }}>
                  {getInitials(player)}
                </div>

                {/* Name + Race bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: isCurrentUser ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                      {getName(player)}
                    </span>
                    {isCurrentUser && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: `${color.bg}22`, color: color.bg, fontWeight: 700, border: `1px solid ${color.bg}40` }}>
                        أنت
                      </span>
                    )}
                    {player.profile_completed && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>✓</span>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginRight: 'auto' }}>
                      {player.predictions_count} توقع
                    </span>
                  </div>

                  {/* Race track bar */}
                  <div style={{
                    height: 8, borderRadius: 100,
                    background: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    <div
                      className={animated ? 'bar-fill' : ''}
                      style={{
                        height: '100%',
                        width: animated ? `${Math.max(pct, 2)}%` : '0%',
                        background: `linear-gradient(90deg, ${color.bg}, ${color.bg}aa)`,
                        borderRadius: 100,
                        boxShadow: `0 0 8px ${color.glow}`,
                        animationDelay: delay,
                        animationDuration: '1s',
                        transition: animated ? 'none' : undefined,
                      }}
                    />
                    {/* Checkered flag at end */}
                    {index === 0 && (
                      <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10 }}>🏁</span>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div style={{
                  minWidth: 56, textAlign: 'center',
                  fontWeight: 900, fontSize: 20,
                  color: index === 0 ? color.bg : index < 3 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {player.total_points}
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>نقطة</div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', paddingBottom: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
        🏁 الشمعدان × كأس العالم 2026
      </div>
    </div>
  );
}
