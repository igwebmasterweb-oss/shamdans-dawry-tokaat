'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';

// ✅ PlayerSelect v2 — يجيب من team_players (السكواد الكامل) أولاً
// لو مش موجود → يجيب من fixture_players (التشكيل الفعلي)
// لو الاتنين فاضيين → input نص عادي

interface Props {
  fixtureId: number;
  homeTeam:  string;
  awayTeam:  string;
  value:     string;
  onChange:  (v: string) => void;
}

export default function PlayerSelect({ fixtureId, homeTeam, awayTeam, value, onChange }: Props) {
  const [players, setPlayers]   = useState<{ player_name: string; team_name: string; position: string | null }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState('');
  const [open,    setOpen]      = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // ① جرب team_players أولاً (السكواد الكامل للفريقين)
      const { data: squadData } = await supabase
        .from('team_players')
        .select('player_name, team_name, position')
        .in('team_name', [homeTeam, awayTeam])
        .order('team_name')
        .order('player_name');

      if (!cancelled && squadData && squadData.length > 0) {
        setPlayers(squadData);
        setLoading(false);
        return;
      }

      // ② fallback: fixture_players (التشكيل الفعلي — متاح بعد الماتش)
      const { data: lineupData } = await supabase
        .from('fixture_players')
        .select('player_name, team_name, position')
        .eq('api_fixture_id', fixtureId)
        .order('team_name')
        .order('player_name');

      if (!cancelled) {
        setPlayers(lineupData || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
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
  if (!loading && players.length === 0) {
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

  const filtered = players.filter(p =>
    p.player_name.toLowerCase().includes(search.toLowerCase())
  );

  // فصّل اللاعبين لفريقين
  const homePlayers = filtered.filter(p => p.team_name === homeTeam);
  const awayPlayers = filtered.filter(p => p.team_name === awayTeam);

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
        <span>{loading ? '⏳ جاري التحميل...' : (value || 'اختر الهداف...')}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && !loading && (
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
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
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
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '.05em' }}>
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
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: '#7db1ff', fontWeight: 700, letterSpacing: '.05em' }}>
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
