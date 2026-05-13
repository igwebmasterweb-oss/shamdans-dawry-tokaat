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
  const maxPoints = useRef(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    const { data } = await supabase
      .from('user_points').select('*').order('total_points', { ascending: false });
    if (data && data.length > 0) {
      maxPoints.current = Math.max(...data.map((p: any) => p.total_points || 1), 1);
      setPlayers(data.map((row: any) => ({
        user_id: row.user_id, user_email: row.user_email,
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
  const getInitials = (p: Player) => getName(p).slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at top left, rgba(217,178,95,.10), transparent 28%),
        radial-gradient(circle at top right, rgba(201,58,47,.08), transparent 26%),
        #070809
      `,
      color: '#f4f1e8',
      fontFamily: "'Cairo', sans-serif",
      direction: 'rtl',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg: #070809; --surface: #111315; --surface-2: #171a1d; --surface-3: #1d2125;
          --line: rgba(255,255,255,.08); --text: #f4f1e8; --muted: #a8a39a;
          --gold: #d9b25f; --gold-soft: rgba(217,178,95,.14); --red: #c93a2f;
          --green: #27b06e; --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes barGrow { from { width: 0% !important; } }
        @keyframes rowIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shimmer {
          0%{background-position:-200% 0} 100%{background-position:200% 0}
        }

        .player-row {
          opacity: 0;
          animation: rowIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .bar-fill { width: 0%; animation: barGrow 1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .top-float { animation: float 3.5s ease-in-out infinite; }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 18px;
        }
        .nav-pill {
          padding: 9px 20px; border-radius: 999px;
          border: 1px solid var(--line); background: var(--surface-2);
          color: var(--muted); font-weight: 700; text-decoration: none;
          font-size: 13px; font-family: 'Cairo', sans-serif; transition: all .2s;
        }
        .nav-pill:hover { border-color: rgba(217,178,95,.25); color: #f2d79e; }
        .nav-pill.primary {
          background: linear-gradient(135deg, #e0bc73, #b9892d);
          color: #211708; border: none;
          box-shadow: 0 4px 14px rgba(217,178,95,.25);
        }
        .nav-pill.primary:hover { opacity: .88; }
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(217,178,95,.06), transparent), var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, #f0cf84, #a97b26)',
            display: 'grid', placeItems: 'center', fontSize: 20,
            boxShadow: '0 4px 16px rgba(217,178,95,.25)',
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

      {/* ══ PAGE TITLE ══ */}
      <div style={{ textAlign: 'center', padding: '40px 20px 28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold))', borderRadius: 2 }} />
          <span style={{ fontSize: 11, letterSpacing: '.18em', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            الشمعدان × كأس العالم 2026
          </span>
          <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, var(--gold), transparent)', borderRadius: 2 }} />
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
          🏆 صدارة المتسابقين
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {players.length} متسابق · يتحدث تلقائياً
        </p>
      </div>

      {/* ══ PODIUM — TOP 3 ══ */}
      {!loading && players.length >= 3 && (
        <div style={{ maxWidth: 680, margin: '0 auto 40px', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14 }}>
            {[1, 0, 2].map((rank) => {
              const p = players[rank];
              const isFirst = rank === 0;
              const heights = { 0: 190, 1: 150, 2: 120 };
              const h = heights[rank as 0|1|2];
              const podiumColors = [
                { bg: 'rgba(217,178,95,.9)', glow: 'rgba(217,178,95,.35)', text: '#211708' },
                { bg: 'rgba(180,180,190,.7)', glow: 'rgba(200,200,210,.25)', text: '#111' },
                { bg: 'rgba(180,120,60,.7)',  glow: 'rgba(180,120,60,.25)',  text: '#f4f1e8' },
              ];
              const col = podiumColors[rank];
              return (
                <div key={p.user_id} className={isFirst ? 'top-float' : ''} style={{
                  flex: 1, maxWidth: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: isFirst ? 70 : 54, height: isFirst ? 70 : 54, borderRadius: '50%',
                    background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isFirst ? 22 : 17, fontWeight: 800, color: col.text,
                    boxShadow: `0 0 ${isFirst ? 28 : 14}px ${col.glow}`,
                    marginBottom: 8, border: `2px solid ${col.bg}`,
                  }}>{getInitials(p)}</div>
                  <div style={{ fontWeight: 800, fontSize: isFirst ? 15 : 13, textAlign: 'center', marginBottom: 4, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getName(p)}
                  </div>
                  <div style={{ fontSize: isFirst ? 20 : 16, fontWeight: 800, color: 'var(--gold)', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {p.total_points} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>نقطة</span>
                  </div>
                  {/* Podium block */}
                  <div style={{
                    width: '100%', height: h,
                    background: `linear-gradient(180deg, ${col.bg}22, ${col.bg}0a)`,
                    border: `1px solid ${col.bg}44`, borderBottom: 'none',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
                  }}>
                    {medals[rank]}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Gold finish line */}
          <div style={{
            height: 5,
            background: 'linear-gradient(90deg, transparent, var(--gold), rgba(217,178,95,.4), var(--gold), transparent)',
            borderRadius: 3,
          }} />
        </div>
      )}

      {/* ══ FULL LIST ══ */}
      <div style={{ maxWidth: 800, margin: '0 auto 60px', padding: '0 20px' }}>

        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 700 }}>
            الترتيب الكامل
          </span>
          <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: 74, animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🏆</div>
            <p style={{ fontSize: 15, marginBottom: 16 }}>لم يبدأ السباق بعد!</p>
            <Link href="/login" style={{
              padding: '10px 28px', borderRadius: 999,
              background: 'linear-gradient(135deg, #e0bc73, #b9892d)',
              color: '#211708', fontWeight: 800, textDecoration: 'none',
              fontSize: 14, fontFamily: 'Cairo, sans-serif',
            }}>سجّل دخولك وكن الأول</Link>
          </div>
        )}

        {/* Player rows */}
        {!loading && players.map((player, index) => {
          const isMe = player.user_id === currentUser?.id;
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const delay = `${index * 0.06}s`;

          return (
            <div key={player.user_id} className="player-row" style={{
              animationDelay: delay,
              marginBottom: 10,
              background: isMe
                ? 'linear-gradient(90deg, rgba(217,178,95,.10), rgba(255,255,255,.02))'
                : 'linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01))',
              border: isMe ? '1px solid rgba(217,178,95,.28)' : '1px solid var(--line)',
              borderRadius: 20, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                {/* Rank */}
                <div style={{
                  minWidth: 38, textAlign: 'center', fontWeight: 900,
                  fontSize: index < 3 ? 22 : 15,
                  color: index < 3 ? 'var(--gold)' : 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {index < 3 ? medals[index] : `#${index + 1}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: index === 0
                    ? 'linear-gradient(135deg, #f0cf84, #a97b26)'
                    : 'linear-gradient(135deg, rgba(217,178,95,.3), rgba(217,178,95,.1))',
                  border: '1px solid rgba(217,178,95,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, color: index === 0 ? '#211708' : 'var(--gold)',
                }}>
                  {getInitials(player)}
                </div>

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: isMe ? 'var(--text)' : 'rgba(244,241,232,.85)' }}>
                      {getName(player)}
                    </span>
                    {isMe && (
                      <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 999, background: 'rgba(217,178,95,.14)', color: '#f2d79e', fontWeight: 700, border: '1px solid rgba(217,178,95,.25)' }}>
                        أنت
                      </span>
                    )}
                    {player.profile_completed && <span style={{ fontSize: 11, color: 'var(--muted)' }}>✓</span>}
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
                      {player.predictions_count} توقع
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                    <div className={animated ? 'bar-fill' : ''} style={{
                      height: '100%',
                      width: animated ? `${Math.max(pct, 2)}%` : '0%',
                      background: index === 0
                        ? 'linear-gradient(90deg, #f0cf84, #d9b25f)'
                        : 'linear-gradient(90deg, rgba(217,178,95,.7), rgba(217,178,95,.3))',
                      borderRadius: 999,
                      boxShadow: index === 0 ? '0 0 8px rgba(217,178,95,.4)' : 'none',
                      animationDelay: delay,
                      animationDuration: '1s',
                    }} />
                  </div>
                </div>

                {/* Points */}
                <div style={{
                  minWidth: 58, textAlign: 'center',
                  background: index < 3 ? 'rgba(217,178,95,.1)' : 'var(--surface-2)',
                  border: index < 3 ? '1px solid rgba(217,178,95,.2)' : '1px solid var(--line)',
                  borderRadius: 14, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: index < 3 ? 'var(--gold)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {player.total_points}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>نقطة</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ FOOTER ══ */}
      <footer style={{ textAlign: 'center', paddingBottom: 40, color: 'var(--muted)', fontSize: 12 }}>
        <div style={{ height: 1, background: 'var(--line)', maxWidth: 800, margin: '0 auto 24px' }} />
        🏆 الشمعدان × كأس العالم 2026
      </footer>
    </div>
  );
}
