'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// ✅ نظام الإشعارات المركزي (نفس المستخدم في صفحة ليجاتي)
import { useNotifications, sendNotification, getNotificationText } from '../../lib/useNotifications';
// 🏆 هيكل شجرة البطولة الثابت
import BracketTree from './BracketTree';

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
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
  homeTeamId,
  awayTeamId,
  value,
  onChange,
  disabled = false,
  disabledHint,
}: {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  value: string;
  onChange: (v: { player_name: string; player_id?: number | null }) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
   const [players, setPlayers] = useState<{
    player_name: string;
    team_name: string;
    player_id?: number | null;
    team_id?: number | null;
    team_side?: 'home' | 'away' | null;
    position: string | null;
    number: number | null;
  }[]>([]);
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
      const squadQuery = supabase
        .from('team_players')
        .select('player_id, player_name, team_name, team_id, position, number')
        .order('team_name')
        .order('player_name');

      const { data: squadData } =
        homeTeamId && awayTeamId
          ? await squadQuery.in('team_id', [homeTeamId, awayTeamId])
          : await squadQuery.in('team_name', [homeTeam, awayTeam]);

      const playersData: {
        player_name: string;
        team_name: string;
        player_id?: number | null;
        team_id?: number | null;
        team_side?: 'home' | 'away' | null;
        position: string | null;
        number: number | null;
      }[] = (squadData || []).map((p: any) => ({
        player_name: p.player_name,
        player_id: p.player_id ?? null,
        team_name: p.team_name,
        team_id: p.team_id ?? null,
        team_side: homeTeamId && p.team_id === homeTeamId
          ? 'home'
          : awayTeamId && p.team_id === awayTeamId
          ? 'away'
          : null,
        position: p.position ?? null,
        number: (p.number ?? null) === null ? null : Number(p.number),
      }));

      setPlayers(playersData);
      setLoaded(true);
    }

    load();
    }, [fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 🔒 لو معطّل (مثلاً تعادل سلبي 0-0) — نقفل القائمة
  useEffect(() => { if (disabled && open) setOpen(false); }, [disabled, open]);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledHint}
        style={{
          flex: 1, width: '100%', padding: '8px 12px', borderRadius: 12,
          border: '1px solid var(--line)', background: 'var(--surface-3)',
          color: 'var(--muted)', fontFamily: 'Cairo, sans-serif', fontSize: 14,
          fontWeight: 600, textAlign: 'right', cursor: 'not-allowed', opacity: 0.45,
          direction: 'rtl',
        }}
      >
        —
      </button>
    );
  }

  if (loaded && players.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange({ player_name: e.target.value, player_id: null })}
        className="field-input"
        placeholder="..."
        style={{ flex: 1 }}
      />
    );
  }

  const filtered = players.filter(p =>
    p.player_name.toLowerCase().includes(search.toLowerCase())
  );

   const homePlayers = filtered.filter(
    p =>
      p.team_side === 'home' ||
      (homeTeamId && p.team_id === homeTeamId) ||
      p.team_name === homeTeam
  );

  const awayPlayers = filtered.filter(
    p =>
      p.team_side === 'away' ||
      (awayTeamId && p.team_id === awayTeamId) ||
      p.team_name === awayTeam
  );

  // ترتيب المراكز: مهاجم → وسط → دفاع → حارس
  type PlayerRow = (typeof filtered)[number];
  const POS_ORDER: Record<string, number> = { Attacker: 0, Midfielder: 1, Defender: 2, Goalkeeper: 3 };
  const POS_LABEL: Record<string, string> = { Attacker: 'الهجوم', Midfielder: 'الوسط', Defender: 'الدفاع', Goalkeeper: 'حراسة المرمى' };
  // تجميع اللاعبين حسب المركز مع الحفاظ على الترتيب (وداخل كل مجموعة حسب رقم القميص)
  const groupByPosition = (list: PlayerRow[]): { pos: string | null; label: string; rows: PlayerRow[] }[] => {
    const order = ['Attacker', 'Midfielder', 'Defender', 'Goalkeeper'];
    const groups: { pos: string | null; label: string; rows: PlayerRow[] }[] = [];
    for (const pos of order) {
      const rows = list
        .filter(p => p.position === pos)
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
      if (rows.length) groups.push({ pos, label: POS_LABEL[pos], rows });
    }
    // أي مركز غير معروف
    const others = list
      .filter(p => !p.position || !(p.position in POS_ORDER))
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
    if (others.length) groups.push({ pos: null, label: 'أخرى', rows: others });
    return groups;
  };

  // زر لاعب واحد (يعرض رقم القميص بدل حرف المركز)
  const renderPlayerBtn = (p: PlayerRow) => (
    <button
      key={`${p.team_name}-${p.player_name}-${p.player_id ?? p.number ?? ''}`}
      type="button"
      onClick={() => {
        onChange({ player_name: p.player_name, player_id: p.player_id ?? null });
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
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {p.number != null ? p.number : (p.position?.[0] ?? '')}
      </span>
      {p.player_name}
    </button>
  );

  // عرض فريق كامل مقسّم لمجموعات مراكز
  const renderTeamSection = (teamName: string, list: PlayerRow[], color: string) => (
    <>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, color, fontWeight: 700 }}>
        {teamName}
      </div>
      {groupByPosition(list).map(g => (
        <div key={`${teamName}-${g.pos ?? 'other'}`}>
          <div style={{ padding: '4px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', opacity: 0.85, letterSpacing: '0.03em' }}>
            {g.label}
          </div>
          {g.rows.map(renderPlayerBtn)}
        </div>
      ))}
    </>
  );

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

          {homePlayers.length > 0 && renderTeamSection(homeTeam, homePlayers, 'var(--gold)')}

          {awayPlayers.length > 0 && renderTeamSection(awayTeam, awayPlayers, '#7db1ff')}

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

// ════════════════════════════════════════════════════════════════════
// 🎨 مكوّن موحّد لعرض بريك داون النقاط (شارات جمالية)
// يتستخدم في كل أماكن عرض التوقعات: مودال العضو + تاب التوقعات + تاب توقعاتي
// ════════════════════════════════════════════════════════════════════
function PointsBreakdown({ items, total, accuracy }: { items: { icon: string; label: string; pts: number }[]; total: number; accuracy?: { earned: number; max: number; pct: number } }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, padding: '8px 0' }}>
        مفيش نقاط من هذا الماتش
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        🧮 النقاط جت منين
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((it, i) => {
          const positive = it.pts >= 0;
          return (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 800, padding: '6px 10px', borderRadius: 999,
                border: positive ? '1px solid rgba(39,176,110,.28)' : '1px solid rgba(201,58,47,.28)',
                background: positive ? 'rgba(39,176,110,.10)' : 'rgba(201,58,47,.10)',
                color: positive ? '#94f0c0' : '#ffb4b4',
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              <span>{it.icon}</span>
              <span>{it.label}</span>
              <span style={{ fontWeight: 900 }}>{positive ? `+${it.pts}` : it.pts}</span>
            </span>
          );
        })}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 2, padding: '8px 12px', borderRadius: 12,
        background: 'linear-gradient(90deg,rgba(217,178,95,.10),rgba(217,178,95,.03))',
        border: '1px solid rgba(217,178,95,.22)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>إجمالي نقاط الماتش</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {accuracy && accuracy.max > 0 && (
            <span
              title={`دقة توقعك في هذا الماتش: ${accuracy.earned} من ${accuracy.max} نقطة`}
              style={{
                fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                border: '1px solid rgba(192,132,252,.3)', background: 'rgba(192,132,252,.12)',
                color: '#d8b4fe', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              🎯 دقة {accuracy.pct}% ({accuracy.earned}/{accuracy.max})
            </span>
          )}
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
            {total} نقطة
          </span>
        </span>
      </div>
    </div>
  );
}

// 📊 سطرين جماليين: نسبة H2H (آخر 10 مواجهات) + نسبة توقع الأعضاء
type Scoreline = { home: number | null; away: number | null; count: number; pct: number; is_others?: boolean };
type ScorerPick = { name: string; player_id?: number | null; count: number; pct: number; is_others?: boolean };
type StatTriple = { home_pct: number; draw_pct: number; away_pct: number; total: number; top_scorelines?: Scoreline[]; top_scorers?: ScorerPick[] } | undefined;
function MatchStatsLines({
  h2h,
  community,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  compact = false,
  loading = false,
  onPickScore,
  onPickScorer,
}: {
  h2h: StatTriple;
  community: StatTriple;
  homeName?: string;
  awayName?: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  compact?: boolean;
  loading?: boolean;
  // لو ممرّرة (الماتش مفتوح) → الضغط على نتيجة يملا خانات التوقع. لو غير ممرّرة → عرض فقط.
  onPickScore?: (home: number, away: number) => void;
  // لو ممرّرة (الماتش مفتوح) → الضغط على هداف يختاره في التوقع.
  onPickScorer?: (name: string, playerId: number | null) => void;
}) {
  // علم الفريق (بديل 🏠/✈️) — لو مفيش شعار نرجع للأيقونة القديمة
  const TeamFlag = ({ logo, fallback, title: t }: { logo?: string | null; fallback: string; title: string }) =>
    logo
      ? <img src={logo} alt={t} title={t} width={compact ? 14 : 16} height={compact ? 14 : 16} style={{ objectFit: 'contain', borderRadius: 3, verticalAlign: 'middle', flex: '0 0 auto' }} />
      : <span title={t}>{fallback}</span>;
  // ⚔️ سطر H2H يظهر دايماً طالما وصلت بيانات (h2h موجود)؛ لو total=0 نكتب “أول لقاء”
  const hasH2hData = !!h2h;
  const h2hHasHistory = !!h2h && (h2h.total || 0) > 0;
  const hasCommunity = !!community && (community.total || 0) > 0;

  const fs = compact ? 10.5 : 11.5;
  const labelFs = compact ? 9.5 : 10.5;

  // ✨ أثناء التحميل: نعرض هيكل تحميل (skeleton) جمالي يفهّم العضو إن فيه حاجة هتظهر
  if (loading && !hasH2hData && !hasCommunity) {
    const SkelBar = () => (
      <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }} className="stats-skel" />
    );
    const SkelChip = ({ w }: { w: number }) => (
      <div style={{ width: w, height: compact ? 24 : 28, borderRadius: 9, background: 'var(--surface-3)' }} className="stats-skel" />
    );
    const skelBox: React.CSSProperties = { padding: compact ? '7px 9px' : '8px 11px', borderRadius: 11, border: '1px solid var(--line)', display: 'grid', gap: 6 };
    return (
      <div style={{ display: 'grid', gap: 7, marginTop: 8 }} aria-busy="true" aria-label="جارٍ تحميل الإحصائيات">
        <div style={{ ...skelBox, background: 'rgba(34,197,94,.06)', borderColor: 'rgba(34,197,94,.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: labelFs, fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>⚔️ آخر المواجهات</span>
            <span style={{ fontSize: labelFs, color: 'var(--muted)' }}>… جارٍ التحميل</span>
          </div>
          <SkelBar />
        </div>
        <div style={{ ...skelBox, background: 'rgba(59,130,246,.06)', borderColor: 'rgba(59,130,246,.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: labelFs, fontWeight: 800, color: '#93c5fd', whiteSpace: 'nowrap' }}>👥 توقع الأعضاء</span>
            <span style={{ fontSize: labelFs, color: 'var(--muted)' }}>… جارٍ التحميل</span>
          </div>
          <SkelBar />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
            <SkelChip w={56} /><SkelChip w={56} /><SkelChip w={56} /><SkelChip w={56} />
          </div>
        </div>
      </div>
    );
  }

  if (!hasH2hData && !hasCommunity) return null;

  // شريط نسب ثلاثي (مضيف / تعادل / ضيف) بألوان وأيقونات
  const Bar = ({ h, d, a }: { h: number; d: number; a: number }) => (
    <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
      <div style={{ width: `${h}%`, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
      <div style={{ width: `${d}%`, background: 'rgba(148,163,184,.55)' }} />
      <div style={{ width: `${a}%`, background: 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
      {hasH2hData && (
        <div style={{ padding: compact ? '7px 9px' : '8px 11px', borderRadius: 11, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.18)', display: 'grid', gap: 5 }}>
          {h2hHasHistory ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: labelFs, fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>⚔️ آخر {h2h!.total} مواجهات</span>
                <span style={{ fontSize: fs, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span title="فوز المضيف" style={{ color: '#86efac', display: 'inline-flex', alignItems: 'center', gap: 3 }}><TeamFlag logo={homeLogo} fallback="🏠" title={homeName || 'المضيف'} /> {h2h!.home_pct}%</span>
                  <span title="تعادل" style={{ color: '#cbd5e1' }}>🤝 {h2h!.draw_pct}%</span>
                  <span title="فوز الضيف" style={{ color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 3 }}><TeamFlag logo={awayLogo} fallback="✈️" title={awayName || 'الضيف'} /> {h2h!.away_pct}%</span>
                </span>
              </div>
              <Bar h={h2h!.home_pct} d={h2h!.draw_pct} a={h2h!.away_pct} />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: labelFs, fontWeight: 800, color: '#86efac', whiteSpace: 'nowrap' }}>⚔️ مواجهات سابقة</span>
              <span style={{ fontSize: fs, fontWeight: 700, color: 'var(--muted)' }}>أول لقاء بين الفريقين</span>
            </div>
          )}
        </div>
      )}
      {hasCommunity && (
        <div style={{ padding: compact ? '7px 9px' : '8px 11px', borderRadius: 11, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)', display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: labelFs, fontWeight: 800, color: '#93c5fd', whiteSpace: 'nowrap' }}>👥 توقع الأعضاء</span>
            <span style={{ fontSize: fs, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span title="فوز المضيف" style={{ color: '#86efac', display: 'inline-flex', alignItems: 'center', gap: 3 }}><TeamFlag logo={homeLogo} fallback="🏠" title={homeName || 'المضيف'} /> {community!.home_pct}%</span>
              <span title="تعادل" style={{ color: '#cbd5e1' }}>🤝 {community!.draw_pct}%</span>
              <span title="فوز الضيف" style={{ color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 3 }}><TeamFlag logo={awayLogo} fallback="✈️" title={awayName || 'الضيف'} /> {community!.away_pct}%</span>
            </span>
          </div>
          <Bar h={community!.home_pct} d={community!.draw_pct} a={community!.away_pct} />

          {/* 🎯 أكثر النتايج توقّعاً (حتى 4 + "أخرى" تجمع الباقي) — لو الماتش مفتوح الضغط يملا خانات التوقع */}
          {Array.isArray(community!.top_scorelines) && community!.top_scorelines.length > 0 && (
            <div style={{ display: 'grid', gap: 5, marginTop: 3 }}>
              <div style={{ fontSize: labelFs, fontWeight: 700, color: '#93c5fd', opacity: 0.9 }}>
                🎯 أكثر النتايج توقّعاً{onPickScore ? ' — اضغط للاختيار' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {community!.top_scorelines.map((s, i) => {
                  const isOthers = !!s.is_others || s.home === null || s.away === null;
                  const clickable = !!onPickScore && !isOthers;
                  const inner = (
                    <>
                      <span style={{ fontSize: fs, fontWeight: 800, color: isOthers ? 'var(--muted)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{isOthers ? 'أخرى' : `${s.home}–${s.away}`}</span>
                      <span style={{ fontSize: labelFs, fontWeight: 800, color: '#93c5fd' }}>{s.pct}%</span>
                    </>
                  );
                  const baseStyle: React.CSSProperties = {
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: compact ? '4px 8px' : '5px 10px', borderRadius: 9,
                    background: isOthers ? 'rgba(148,163,184,.10)' : 'rgba(59,130,246,.10)',
                    border: isOthers ? '1px solid rgba(148,163,184,.28)' : '1px solid rgba(59,130,246,.28)',
                  };
                  return clickable ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onPickScore!(s.home as number, s.away as number)}
                      title="اضغط لتعيين هذه النتيجة توقّعك"
                      style={{ ...baseStyle, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={i} style={baseStyle}>{inner}</div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ⚽ أكثر الهدافين توقّعاً (توقّع أول هداف) — لو الماتش مفتوح الضغط يختاره */}
          {Array.isArray(community!.top_scorers) && community!.top_scorers.length > 0 && (
            <div style={{ display: 'grid', gap: 5, marginTop: 3 }}>
              <div style={{ fontSize: labelFs, fontWeight: 700, color: '#93c5fd', opacity: 0.9 }}>
                ⚽ أكثر الهدافين توقّعاً{onPickScorer ? ' — اضغط للاختيار' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {community!.top_scorers!.map((sc, i) => {
                  const isOthers = !!sc.is_others;
                  const clickable = !!onPickScorer && !isOthers;
                  const inner = (
                    <>
                      <span style={{ fontSize: fs, fontWeight: 800, color: isOthers ? 'var(--muted)' : 'var(--text)' }}>{sc.name}</span>
                      <span style={{ fontSize: labelFs, fontWeight: 800, color: '#93c5fd' }}>{sc.pct}%</span>
                    </>
                  );
                  const baseStyle: React.CSSProperties = {
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: compact ? '4px 8px' : '5px 10px', borderRadius: 9,
                    background: isOthers ? 'rgba(148,163,184,.10)' : 'rgba(59,130,246,.10)',
                    border: isOthers ? '1px solid rgba(148,163,184,.28)' : '1px solid rgba(59,130,246,.28)',
                  };
                  return clickable ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onPickScorer!(sc.name, sc.player_id ?? null)}
                      title="اضغط لاختيار هذا اللاعب كأول هداف"
                      style={{ ...baseStyle, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={i} style={baseStyle}>{inner}</div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  // 🔥 استطلاع دوري البريمير ليج / التشامبيونز ليج
  const [dreamChoice, setDreamChoice]       = useState<string | null>(null); // 'ready' | 'thinking' | null
  const [dreamSaving, setDreamSaving]       = useState(false);
  const [matches, setMatches]               = useState<any[]>([]);
  const [predictions, setPredictions]       = useState<any[]>([]);
  const [leaderboard, setLeaderboard]       = useState<any[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(false);
  const [activeTab, setActiveTab]           = useState<'predict' | 'my' | 'leaders' | 'roundleaders' | 'feed' | 'history' | 'bracket' | 'elite'>('predict');
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
  const [penaltyMap, setPenaltyMap]         = useState<Record<string, number>>({});
  const [myPenaltyPoints, setMyPenaltyPoints] = useState(0);
  const [reviewNotice, setReviewNotice]     = useState<any | null>(null);
  const [pushLoading, setPushLoading]       = useState(false);
  const [collapsedMatches, setCollapsedMatches] = useState<Record<number, boolean>>({});
  // 🏆 شجرة البطولة (knockout bracket) — تُجلب لحظيًا من /api/bracket
  const [bracketRounds, setBracketRounds] = useState<Record<string, any[]> | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  // 🎯 صدارة دقة التوقع (نُخبة الدقة) — أفضل 25 على آخر 6 ماتشات
  const [eliteLeaders, setEliteLeaders] = useState<any[] | null>(null);
  const [eliteLoading, setEliteLoading] = useState(false);
  const [eliteWindow, setEliteWindow] = useState(0);
  const [myRoundFilter, setMyRoundFilter]     = useState('');
  const [leaderRoundFilter, setLeaderRoundFilter] = useState('');
  const [leaderModalRoundFilter, setLeaderModalRoundFilter] = useState('');
  // 📊 نسب H2H (آخر 10 مواجهات) ونسب توقع الأعضاء — مفهرسة بـ fixtureId
  const [h2hStats, setH2hStats] = useState<Record<number, { home_pct: number; draw_pct: number; away_pct: number; total: number }>>({});
  const [communityStats, setCommunityStats] = useState<Record<number, { home_pct: number; draw_pct: number; away_pct: number; total: number; top_scorelines?: { home: number | null; away: number | null; count: number; pct: number; is_others?: boolean }[]; top_scorers?: { name: string; player_id?: number | null; count: number; pct: number; is_others?: boolean }[] }>>({});
  // ✨ حالة تحميل إحصائيات الماتشات (H2H + توقع الأعضاء) — لعرض هيكل التحميل
  const [statsLoading, setStatsLoading] = useState(true);
  // ✅ الإشعارات (جرس الداش بورد) — نفس منطق صفحة ليجاتي
  const [showNotif, setShowNotif] = useState(false);
  const { notifications, unreadCount, markRead, markNonInviteRead } = useNotifications();
  const getPenaltyPoints = (userId?: string | null) =>
    userId ? Number(penaltyMap[userId] || 0) : 0;


  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setPushEnabled(true);
      });
    });
  }, []);

  // 🏆 جلب أدوار الإقصاء لحظيًا أول ما يُفتح تاب الشجرة (مرة واحدة)
  useEffect(() => {
    if (activeTab !== 'bracket' || bracketRounds !== null || bracketLoading) return;
    setBracketLoading(true);
    fetch('/api/bracket')
      .then(r => r.json())
      .then(d => setBracketRounds(d?.rounds || {}))
      .catch(() => setBracketRounds({}))
      .finally(() => setBracketLoading(false));
  }, [activeTab, bracketRounds, bracketLoading]);

  // 🎯 جلب صدارة دقة التوقع أول ما يُفتح تاب نُخبة الدقة (مرة واحدة)
  useEffect(() => {
    if (activeTab !== 'elite' || eliteLeaders !== null || eliteLoading) return;
    setEliteLoading(true);
    fetch('/api/accuracy-leaders')
      .then(r => r.json())
      .then(d => { setEliteLeaders(d?.leaders || []); setEliteWindow(d?.window || 0); })
      .catch(() => setEliteLeaders([]))
      .finally(() => setEliteLoading(false));
  }, [activeTab, eliteLeaders, eliteLoading]);

  // 📊 جلب نسب توقع الأعضاء (طلب واحد مجمّع) + نسب H2H لكل ماتش ظاهر
  useEffect(() => {
    if (!matches || matches.length === 0) return;

    const fixtureIds = Array.from(
      new Set(
        matches
          .map((m: any) => Number(m?.fixture?.id))
          .filter((n: number) => Number.isFinite(n))
      )
    );
    if (fixtureIds.length === 0) return;

    let cancelled = false;
    setStatsLoading(true);

    // نسب توقع الأعضاء — طلب واحد لكل الماتشات
    fetch(`/api/community-prediction?ids=${fixtureIds.join(',')}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.results) return;
        const mapped: Record<number, any> = {};
        for (const k of Object.keys(d.results)) mapped[Number(k)] = d.results[k];
        setCommunityStats((prev) => ({ ...prev, ...mapped }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatsLoading(false); });

    // نسب H2H — طلب لكل ماتش (له فريقين)
    matches.forEach((m: any) => {
      const fid = Number(m?.fixture?.id);
      const homeId = Number(m?.teams?.home?.id);
      const awayId = Number(m?.teams?.away?.id);
      if (!Number.isFinite(fid) || !Number.isFinite(homeId) || !Number.isFinite(awayId)) return;
      fetch(`/api/h2h?home=${homeId}&away=${awayId}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d) return;
          setH2hStats((prev) => ({ ...prev, [fid]: d }));
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [matches]);

  const router = useRouter();
  const animatedPoints = useCountUp(0);
  const countdown = useCountdown(upcomingAlert?.fixture?.date ?? null);

  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
    'Round of 32':     'دور الـ 32',
    'Round of 16':     'دور الـ 16',
    'Quarter-finals':  'ربع النهائي',
    'Semi-finals':     'نصف النهائي',
    '3rd Place Final': 'مباراة الثالث',
    'Final':           'النهائي',
  };

  // الترتيب الرسمي لكل الأدوار (لترتيب التابات وتحديد القادمة)
  const ROUND_ORDER = [
    'Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3',
    'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place Final', 'Final',
  ];

  // الأدوار اللي عندها ماتشات فعلًا (متاحة للتوقع)
  const rounds = [...new Set(matches.map((m: any) => m.league?.round).filter(Boolean))] as string[];

  // الأدوار القادمة (معلنة لكن لسه مفيش ماتشات — placeholder "قريبًا")
  const upcomingRounds = ROUND_ORDER.filter((r) => !rounds.includes(r));
  // كل الأدوار بالترتيب الرسمي (المتاح أولًا ثم أي دور غير معروف في الآخر)
  const displayRounds = [
    ...ROUND_ORDER.filter((r) => rounds.includes(r)),
    ...rounds.filter((r) => !ROUND_ORDER.includes(r)),
  ];

  useEffect(() => {
    if (!myRoundFilter && activeRound) setMyRoundFilter(activeRound);
  }, [activeRound, myRoundFilter]);


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
      // ✅ نقرأ كود الإحالة من الـ URL أولاً ثم sessionStorage (zay pendingLeague).
      // مهم: رحلة OAuth (فيسبوك/جوجل) بتعمل redirect خارجي وأحيانًا بيضيع معاها sessionStorage،
      // لكن ?ref= بيفضل في الـ URL (buildRedirectUrl بيضيفه). فالقراءة من الاتنين تضمن عدم فقدان الإحالة.
      const pendingRef =
        (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null) ||
        (typeof window !== 'undefined' ? window.sessionStorage.getItem('pendingRef') : null);
      // ✅ الربط يتم لأي مستخدم عنده pendingRef — بما فيهم مستخدمي فيسبوك (auth.email = NULL).
      // الدالة process_referral آمنة بدون إيميل ومحمية من التكرار عبر referred_by IS NOT NULL.
      if (pendingRef) {
        const { error: refErr } = await supabase.rpc('process_referral', {
          p_referred_id: userId,
          p_referral_code: pendingRef,
        });
        if (!refErr) {
          if (typeof window !== 'undefined') window.sessionStorage.removeItem('pendingRef');
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
  'api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,first_scorer_id,scorers_json,scorers_ids_json,went_extra_time,went_penalty_shootout,red_card_in_match,penalty_in_match,both_teams_scored,home_team_name,away_team_name,home_team_id,away_team_id'
),
        supabase.from('predictions').select('*').eq('user_id', userId),
        supabase.from('user_points').select('referral_count,total_points,referral_points,bonus_points,profile_completed').eq('user_id', userId).maybeSingle(),
        supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('historical_rankings').select('*').order('week_start', { ascending: false }).order('total_points', { ascending: false }),
        supabase.from('user_points').select('*').order('total_points', { ascending: false }),
        supabase.from('user_points').select('*', { count: 'exact', head: true }),
      ]);

      const [penaltyRowsResult, reviewNoticeResult, dreamSurveyResult] = await Promise.allSettled([
        supabase.from('user_penalty_notices').select('user_id, penalty_points').eq('is_active', true),
        supabase.from('user_penalty_notices').select('id, user_id, message, status, penalty_points').eq('user_id', userId).eq('is_active', true).maybeSingle(),
        supabase.from('dream_league_survey').select('choice').eq('user_id', userId).maybeSingle(),
      ]);

      // 🔥 اختيار العضو في استطلاع الدوري الجديد (لو سبق واختار)
      if (dreamSurveyResult.status === 'fulfilled') {
        setDreamChoice((dreamSurveyResult.value?.data as any)?.choice ?? null);
      }

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

      const penaltyRows =
        penaltyRowsResult.status === 'fulfilled' && !(penaltyRowsResult.value as any)?.error
          ? ((penaltyRowsResult.value as any)?.data || [])
          : [];

      const reviewNoticeData =
        reviewNoticeResult.status === 'fulfilled' && !(reviewNoticeResult.value as any)?.error
          ? ((reviewNoticeResult.value as any)?.data || null)
          : null;

      const nextPenaltyMap = Object.fromEntries((penaltyRows || []).map((row: any) => [row.user_id, Number(row.penalty_points || 0)]));
      const penaltyFor = (targetUserId?: string | null) => targetUserId ? Number(nextPenaltyMap[targetUserId] || 0) : 0;
      const myPenaltyFromNotices = reviewNoticeData?.user_id === userId
        ? Number(reviewNoticeData?.penalty_points || 0)
        : penaltyFor(userId);
      setPenaltyMap(nextPenaltyMap);
      setMyPenaltyPoints(myPenaltyFromNotices);
      setReviewNotice(reviewNoticeData);
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
          email:        profileData.email || sessionData?.session?.user?.email || '',
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
          first_scorer_id:   sb?.first_scorer_id   ?? null,
          scorers_json:      sb?.scorers_json      ?? null,
          scorers_ids_json:  sb?.scorers_ids_json  ?? null,
          went_extra_time:   sb?.went_extra_time   ?? false,
          went_penalty_shootout: sb?.went_penalty_shootout ?? false,
          red_card_in_match: sb?.red_card_in_match ?? false,
          penalty_in_match:  sb?.penalty_in_match  ?? false,
          both_teams_scored: sb?.both_teams_scored ?? false,
          db_home_team:      sb?.home_team_name    ?? m.teams.home.name,
          db_away_team:      sb?.away_team_name    ?? m.teams.away.name,
          db_home_team_id:   sb?.home_team_id      ?? m.teams.home.id,
          db_away_team_id:   sb?.away_team_id      ?? m.teams.away.id,
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
        // ✅ آخر 6 أيام بس (مرتبة تنازليًا من الأحدث)
        const allDates = [...new Set(normalizedHist.map((r: any) => r.week_start))].sort((a: string, b: string) => b.localeCompare(a)) as string[];
        const dates = allDates.slice(0, 6);
        const datesSet = new Set(dates);
        setHistoryDates(dates);
        setActiveHistoryDate(prev => {
          const normalizedPrev = prev ? String(prev).slice(0, 10) : '';
          return normalizedPrev && dates.includes(normalizedPrev) ? normalizedPrev : dates[0];
        });
        // dedupe: keep highest total_points per user_id per day, then top 25 per day
        const dedupeMap = new Map<string, any>();
        for (const row of normalizedHist) {
          if (!datesSet.has(row.week_start)) continue; // نتجاهل الأيام خارج آخر 6
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

      // Load general leaderboard from leaderboard_unified_v2
      const { data: generalLbData } = await supabase
        .from('leaderboard_unified_v2')
        .select('user_id, full_name, user_email, official_total_points, details_total_points, raw_total_points, prediction_points, referral_points, profile_points, bonus_points, predictions_count, profile_completed, penalty_points')
        .order('official_total_points', { ascending: false });

      setLeaderboard((generalLbData || []).map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        profile_completed: row.profile_completed || false,
        totalPoints: row.official_total_points || 0,
        details_total_points: row.details_total_points || 0,
        raw_total_points: row.raw_total_points || 0,
        prediction_points: row.prediction_points || 0,
        referral_points: row.referral_points || 0,
        profile_points: row.profile_points || 0,
        bonus_points: row.bonus_points || 0,
        count: row.predictions_count || 0,
        penalty_points: row.penalty_points || 0,
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
  const targetRound = leaderRoundFilter || activeRound;
  if (!targetRound) {
    setRoundLeaderboardRows([]);
    return;
  }

  let cancelled = false;
  setRoundLeaderLoading(true);

  (async () => {
    try {
      const { data, error } = await supabase.rpc('get_round_leaderboard', { p_round: targetRound });

      if (cancelled) return;
      if (error) throw error;

      const generalMap = new Map((leaderboard || []).map((row: any) => [String(row.user_id), row]));
      const enrichedRoundRows = (data || []).map((row: any) => {
        const generalRow = generalMap.get(String(row.user_id));
        return {
          ...row,
          totalPoints: generalRow?.totalPoints ?? row.total_points ?? 0,
          details_total_points: generalRow?.details_total_points ?? row.total_points ?? 0,
          prediction_points: generalRow?.prediction_points ?? row.total_points ?? 0,
          referral_points: generalRow?.referral_points ?? 0,
          profile_points: generalRow?.profile_points ?? 0,
          bonus_points: generalRow?.bonus_points ?? 0,
          penalty_points: generalRow?.penalty_points ?? 0,
          profile_completed: generalRow?.profile_completed ?? false,
          count: generalRow?.count ?? row.predictions_count ?? 0,
        };
      });

      setRoundLeaderboardRows(enrichedRoundRows);
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
}, [leaderRoundFilter, activeRound]);





// 🔥 حفظ اختيار العضو في استطلاع دوري البريمير/التشامبيونز
const saveDreamChoice = async (choice: 'ready' | 'thinking') => {
  if (!user?.id || dreamSaving) return;
  setDreamSaving(true);
  try {
    const { error } = await supabase.from('dream_league_survey').upsert({
      user_id: user.id,
      user_email: user.email || null,
      full_name: profile?.full_name?.trim() || null,
      phone: profile?.phone?.trim() || null,
      choice,
    }, { onConflict: 'user_id' });
    if (error) throw error;
    // بمجرد الاختيار يختفي الكارت
    setDreamChoice(choice);
  } catch (e) {
    console.error('dream survey save failed', e);
    alert('حصل خطأ أثناء حفظ اختيارك، حاول تاني.');
  } finally {
    setDreamSaving(false);
  }
};

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
        email:                emailValue,
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
      firstScorerId:        ex?.predicted_first_scorer_id ?? null,
      extraTime:            ex?.predicted_extra_time  ?? false,
      penaltyShootout:      ex?.predicted_penalty_shootout ?? false,
      predicted_red_card:   ex?.predicted_red_card    ?? false,
      predicted_penalty:    ex?.predicted_penalty     ?? false,
    };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms(prev => ({ ...prev, [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch } }));

  // 🥅 تعديل النتيجة مع إلغاء ركلات الترجيح تلقائياً لو النتيجة بقت فيها فائز (مش متعادلة).
  // الترجيح مابيحصلش إلا بتعادل، فمنع توقع متناقض (فائز + ترجيح). الوقت الإضافي يفضل زي ما هو.
  const setScore = (fixtureId: number, patch: { homeScore?: number; awayScore?: number }) => {
    const cur = getForm({ fixture: { id: fixtureId } });
    const nextHome = patch.homeScore ?? cur.homeScore ?? 0;
    const nextAway = patch.awayScore ?? cur.awayScore ?? 0;
    const extra = nextHome !== nextAway ? { penaltyShootout: false } : {};
    // 🔒 تعادل سلبي 0-0 — مفيش أول هداف، نمسح أي هداف مختار
    const clearScorer = (nextHome === 0 && nextAway === 0) ? { firstScorer: '', firstScorerId: null } : {};
    setForm(fixtureId, { ...patch, ...extra, ...clearScorer });
  };

// 🔧 تطبيع الاسم: حذف الأكسنت + توحيد الحالة + حذف المسافات الزائدة
// (نفس فلسفة namesReferToSamePlayer في الباك إند لضمان الاتساق)
const normalizeScorerName = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // حذف علامات الأكسنت (ñ→n, ć→c, ı→i...)
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// 🔧 آخر كلمة (اسم العائلة) للمطابقة الاحتياطية
const lastToken = (s: string): string => {
  const parts = normalizeScorerName(s).replace(/\./g, ' ').split(' ').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
};

// 🔧 resolveFirstScorerId مُحصَّن: يجمع نطاق team_id + team_name معاً،
// ويستخدم مطابقة مرنة (تطبيع الأكسنت/الحالة) ثم مطابقة احتياطية باسم العائلة
const resolveFirstScorerId = async (match: any, scorerName?: string | null) => {
  if (!scorerName?.trim()) return null;
  const cleanName = scorerName.trim();

  // اجمع كل المرشحين من النطاقين معاً (team_id لو متوفر + team_name كاحتياط)
  const teamIds = [match?.db_home_team_id, match?.db_away_team_id].filter(
    (v): v is number => typeof v === 'number'
  );
  const teamNames = [match?.teams?.home?.name, match?.teams?.away?.name].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );

  const candidates: { player_id: number | null; player_name: string }[] = [];

  if (teamIds.length > 0) {
    const { data } = await supabase
      .from('team_players')
      .select('player_id, player_name, team_id')
      .in('team_id', teamIds);
    if (data) candidates.push(...data);
  }

  if (candidates.length === 0 && teamNames.length > 0) {
    const { data } = await supabase
      .from('team_players')
      .select('player_id, player_name, team_name')
      .in('team_name', teamNames);
    if (data) candidates.push(...data);
  }

  const valid = candidates.filter((p) => p.player_id != null);
  if (valid.length === 0) return null;

  // ① مطابقة دقيقة (الاسم كما هو)
  const exact = valid.find((p) => p.player_name === cleanName);
  if (exact) return exact.player_id ?? null;

  // ② مطابقة مرنة بعد التطبيع (تجاهل الأكسنت/الحالة/المسافات)
  const target = normalizeScorerName(cleanName);
  const fuzzy = valid.find((p) => normalizeScorerName(p.player_name) === target);
  if (fuzzy) return fuzzy.player_id ?? null;

  // ③ مطابقة احتياطية باسم العائلة (آخر كلمة) — فقط لو فريدة لتجنب اللبس
  const targetLast = lastToken(cleanName);
  if (targetLast) {
    const byLast = valid.filter((p) => lastToken(p.player_name) === targetLast);
    if (byLast.length === 1) return byLast[0].player_id ?? null;
  }

  return null;
};

const submitPrediction = async (match: any) => {
  if (!user) return;

  if (!match?.is_open) {
    setMessages(m => ({ ...m, [match.fixture.id]: '🔒 تم إغلاق التوقعات لهذه المباراة' }));
    setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    return;
  }

  setSubmitting(match.fixture.id);
  const form = getForm(match);

  // 🥅 حماية منطقية: ركلات الترجيح مابتحصلش إلا بتعادل. لو النتيجة المتوقعة فيها فائز
  // نلغي الترجيح قبل الحفظ (منع توقع متناقض حتى لو الـ UI اتجاوز). الوقت الإضافي يفضل زي ما هو.
  const penaltyShootoutSafe = ((form.homeScore || 0) === (form.awayScore || 0)) ? (form.penaltyShootout ?? false) : false;

  try {
    const ex = predictions.find((p: any) => p.fixture_id === match.fixture.id);
    const resolvedFirstScorerId = form.firstScorerId ?? (
      form.firstScorer ? await resolveFirstScorerId(match, form.firstScorer) : null
    );

    const payload = {
      user_id: user.id,
      user_email: user.email,
      fixture_id: match.fixture.id,
      home_team: match.teams.home.name,
      away_team: match.teams.away.name,
      predicted_home_score: form.homeScore,
      predicted_away_score: form.awayScore,
      predicted_first_scorer: form.firstScorer || null,
      predicted_first_scorer_id: resolvedFirstScorerId,
      predicted_extra_time: form.extraTime,
      predicted_penalty_shootout: penaltyShootoutSafe,
      predicted_red_card: form.predicted_red_card ?? false,
      predicted_penalty: form.predicted_penalty ?? false,
      submitted_at: new Date().toISOString(),
    };

   if (ex) {
      const { error } = await supabase
        .from('predictions')
        .update({
          predicted_home_score:   form.homeScore,
          predicted_away_score:   form.awayScore,
          predicted_first_scorer: form.firstScorer || null,
          predicted_first_scorer_id: resolvedFirstScorerId,
          predicted_extra_time:   form.extraTime,
          predicted_penalty_shootout: penaltyShootoutSafe,
          predicted_red_card:     form.predicted_red_card ?? false,
          predicted_penalty:      form.predicted_penalty ?? false,
          submitted_at:           new Date().toISOString(),
        })
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

    setPredictions((data || []).map((row: any) => ({
...row,
predicted_first_scorer_id: row.predicted_first_scorer_id ?? null,
})));
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

  // ✅ الرد على دعوة ليج من جرس الداش بورد (نفس منطق صفحة ليجاتي)
  const respondToInvite = async (notif: any, accept: boolean) => {
    if (!user) return;
    const { league_id, league_name, from_user_id } = notif.data;
    try {
      const { data: inviteRow, error: inviteErr } = await supabase
        .from('mini_league_invitations')
        .select('id, status')
        .eq('league_id', league_id)
        .eq('invited_user', user.id)
        .maybeSingle();
      if (inviteErr) throw inviteErr;

      if (!inviteRow) {
        alert('❌ الدعوة غير موجودة أو تم حذفها');
        await markRead(notif.id);
        return;
      }
      if (inviteRow.status !== 'pending') {
        alert('ℹ️ تم التعامل مع هذه الدعوة بالفعل');
        await markRead(notif.id);
        return;
      }

      const { error: updateInviteErr } = await supabase
        .from('mini_league_invitations')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', inviteRow.id);
      if (updateInviteErr) throw updateInviteErr;

      if (accept) {
        const { data: existingMember, error: existingErr } = await supabase
          .from('mini_league_members')
          .select('league_id')
          .eq('league_id', league_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (existingErr) throw existingErr;

        if (!existingMember) {
          const { error: memberInsertErr } = await supabase
            .from('mini_league_members')
            .insert({ league_id, user_id: user.id, role: 'member' });
          if (memberInsertErr) throw memberInsertErr;
        }

        await sendNotification(from_user_id, 'invite_accepted', {
          league_id, league_name, invited_user_name: displayName,
        });
        setLeagueJoinMsg(`✅ انضممت لـ "${league_name}"`);
      } else {
        await sendNotification(from_user_id, 'invite_declined', {
          league_id, league_name, invited_user_name: displayName,
        });
        setLeagueJoinMsg('تم رفض الدعوة');
      }

      await markRead(notif.id);
    } catch (err: any) {
      alert('❌ ' + (err.message || 'حدث خطأ أثناء التعامل مع الدعوة'));
    }
  };

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
      setLeaderModalRoundFilter('');

      const summaryData = null;

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
    first_scorer_id: matchInfo?.first_scorer_id ?? null,
    scorers_json: matchInfo?.scorers_json ?? null,
    scorers_ids_json: matchInfo?.scorers_ids_json ?? null,
    red_card_in_match: matchInfo?.red_card_in_match ?? null,
    penalty_in_match: matchInfo?.penalty_in_match ?? null,
    both_teams_scored: matchInfo?.both_teams_scored ?? null,
    went_extra_time: matchInfo?.went_extra_time ?? null,
    went_penalty_shootout: matchInfo?.went_penalty_shootout ?? null,
  };
})
.filter((pred: any) => pred.home_team || pred.away_team)
.sort((a: any, b: any) => {
  const dateA = a.fixture_date ? new Date(a.fixture_date).getTime() : 0;
  const dateB = b.fixture_date ? new Date(b.fixture_date).getTime() : 0;
  return dateA - dateB;
});

// ✅ توحيد مصدر الإجمالي: نجيب بيانات اللاعب الحقيقية من الترتيب العام (leaderboard)
// عشان أي تاب (لاعبين/جولات/نشاط) يدي نفس الإجمالي الصح وما يحصلش لخبطة
let lbRow: any = leaderboard.find((r: any) => String(r.user_id) === String(player?.user_id)) || {};
// 🎯 fallback: لو اللاعب اتفتح من مصدر مالوش صف في الترتيب المحلي (زي تاب نُخبة الدقة)
// نجيب صفّه مباشرةً من الفيو الموحّد عشان الإجمالي وباقي البنود يظهروا صح مش صفر
if (!lbRow.user_id && player?.user_id) {
  const { data: uRow } = await supabase
    .from('leaderboard_unified_v2')
    .select('user_id, full_name, user_email, official_total_points, details_total_points, prediction_points, referral_points, profile_points, bonus_points, penalty_points, profile_completed')
    .eq('user_id', player.user_id)
    .maybeSingle();
  if (uRow) {
    lbRow = {
      user_id: uRow.user_id,
      totalPoints: uRow.official_total_points || 0,
      details_total_points: uRow.details_total_points || 0,
      prediction_points: uRow.prediction_points || 0,
      referral_points: uRow.referral_points || 0,
      profile_points: uRow.profile_points || 0,
      bonus_points: uRow.bonus_points || 0,
      penalty_points: uRow.penalty_points || 0,
      profile_completed: uRow.profile_completed || false,
    };
  }
}
const resolvedTotal =
  lbRow.details_total_points ?? lbRow.totalPoints ??
  player?.details_total_points ?? player?.totalPoints ?? 0;
setSelectedLeaderSummary({ ...(summaryData || {}), totalPoints: resolvedTotal, prediction_points: lbRow.prediction_points ?? player?.prediction_points ?? 0, penalty_points: lbRow.penalty_points ?? player?.penalty_points ?? getPenaltyPoints(player.user_id), referral_points: lbRow.referral_points ?? player?.referral_points ?? 0, profile_points: lbRow.profile_points ?? player?.profile_points ?? 0, bonus_points: lbRow.bonus_points ?? player?.bonus_points ?? 0, profile_completed: lbRow.profile_completed ?? player?.profile_completed ?? false });
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

 const myLeaderRow = leaderboard.find((p: any) => p.user_id === user?.id) || null;
  const myPoints = myLeaderRow?.totalPoints || 0;
  const myRank      = leaderboard.findIndex(p => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const mySelectedRound = myRoundFilter || activeRound;
  const myFilteredMatches = matches.filter((m: any) => m.league?.round === mySelectedRound);
  const predictionOnlyPoints = predictions
    .reduce((sum: number, pr: any) => sum + (Number(pr?.points) || 0), 0);
  const myRoundPts = predictions
    .filter((pr: any) => filteredMatches.some((m: any) => m.fixture.id === pr.fixture_id))
    .reduce((sum: number, pr: any) => sum + (Number(pr?.points) || 0), 0);
  const myFilteredRoundPts = predictions
    .filter((pr: any) => myFilteredMatches.some((m: any) => m.fixture.id === pr.fixture_id))
    .reduce((sum: number, pr: any) => sum + (Number(pr?.points) || 0), 0);
  const myPredictionBreakdown = myLeaderRow?.prediction_points ?? predictionOnlyPoints;
const myProfilePoints      = myLeaderRow?.profile_points ?? (profileCompleted ? 5 : 0);
const myReferralBreakdown  = myLeaderRow?.referral_points ?? referralPoints;
const myBonusBreakdown     = myLeaderRow?.bonus_points ?? bonusPoints;
const myPenaltyBreakdown   = myLeaderRow?.penalty_points ?? myPenaltyPoints;

// بوكس ترتيبي يعرض الرقم الرسمي من الفيو
const myDisplayedTotal =
  myLeaderRow?.details_total_points ??
  myLeaderRow?.totalPoints ??
  0;
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

// ✅ دقة التوقع الجديدة = مجموع البنود الصح ÷ مجموع البنود اللي ليها نتيجة فعلية
// (الحسبة نفسها في computeMatchAccuracy تحت) — الإجمالي محسوب بعد تعريف الدالة.
const normScorer = (name: string | null | undefined): string =>
  (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ════════════════════════════════════════════════════════════════════
// 🧮 بريك داون نقاط التوقع لماتش واحد — مطابق 100% لمنطق update-results
// بيرجّع بنود (أيقونة + وصف + نقاط) عشان العضو يفهم النقط جت منين.
// المجموع لازم يساوي pred.points المحفوظة بالظبط (مفيش لخبطة).
// البنود: اتجاه صح +5 | نتيجة بالظبط +5 | أول هداف +3 | سجّل هدف +1
//        | كارت أحمر +3/-1 | ضربة جزاء +3/-1
// (مفيش وقت إضافي ومفيش "الفريقين سجلا" لأنهم مش في نظام الحساب الرسمي)
// ════════════════════════════════════════════════════════════════════
const computeBreakdown = (pred: any): { items: { icon: string; label: string; pts: number }[]; total: number } => {
  const items: { icon: string; label: string; pts: number }[] = [];

  // لازم تكون فيه نتيجة فعلية محسومة
  const actualHome = pred.actual_home_score;
  const actualAway = pred.actual_away_score;
  if (actualHome === null || actualHome === undefined || actualAway === null || actualAway === undefined) {
    return { items, total: 0 };
  }

  // بيانات الماتش الفعلية (من predictions نفسها أو من جدول الماتشات matches)
  const mx = matches.find((m: any) => m.fixture?.id === (pred.fixture_id || pred.api_fixture_id));
  const actualFirstScorer = pred.first_scorer_actual ?? mx?.first_scorer ?? null;
  const actualFirstScorerId =
    (pred.first_scorer_id ?? mx?.first_scorer_id) != null
      ? Number(pred.first_scorer_id ?? mx?.first_scorer_id)
      : null;
  const scorerIds: number[] = Array.isArray(mx?.scorers_ids_json)
    ? mx.scorers_ids_json.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
    : [];
  const redCardInMatch = (pred.red_card_in_match ?? mx?.red_card_in_match) === true;
  const penaltyInMatch = (pred.penalty_in_match ?? mx?.penalty_in_match) === true;
  const wentExtraTime  = (pred.went_extra_time ?? mx?.went_extra_time) === true;
  const wentPenaltyShootout = (pred.went_penalty_shootout ?? mx?.went_penalty_shootout) === true;

  const predHome = pred.predicted_home_score;
  const predAway = pred.predicted_away_score;
  const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
  const predWinner   = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';

  // 1️⃣ الاتجاه (فائز/تعادل) — +5
  if (actualWinner === predWinner) {
    items.push({ icon: '✅', label: 'الاتجاه صح (فائز/تعادل)', pts: 5 });
  }
  // 2️⃣ النتيجة بالظبط — +5 إضافية (فوق الاتجاه)
  if (predHome === actualHome && predAway === actualAway) {
    items.push({ icon: '🎯', label: 'النتيجة بالظبط', pts: 5 });
  }

  // 3️⃣ أول هداف (أولوية للـ ID، ثم بالاسم) — +3 لأول هداف، +1 لو سجّل بس مش الأول
  const predScorerName = pred.predicted_first_scorer || null;
  const predScorerId =
    pred.predicted_first_scorer_id != null ? Number(pred.predicted_first_scorer_id) : null;

  // كل أسماء الهدافين في الماتش (للـ fallback بالاسم، مطابق للباك إند)
  const allScorerNames: string[] = extractScorersList(mx?.scorers_json, actualFirstScorer);

  const isFirstById = predScorerId !== null && actualFirstScorerId !== null && predScorerId === actualFirstScorerId;
  const scoredById  = predScorerId !== null && scorerIds.includes(predScorerId);
  const isFirstByName =
    !!predScorerName && !!actualFirstScorer && normScorer(predScorerName) === normScorer(actualFirstScorer);
  // سجّل في الماتش بالاسم (لو الـ ID مش متوفر/مش مطابق لكن الاسم موجود ضمن الهدافين)
  const scoredByName =
    !!predScorerName && allScorerNames.some((nm) => normScorer(nm) === normScorer(predScorerName));

  if (isFirstById || isFirstByName) {
    items.push({ icon: '⚽', label: 'أول هداف صح', pts: 3 });
  } else if (scoredById || scoredByName) {
    items.push({ icon: '⚽', label: 'سجّل هدف (مش الأول)', pts: 1 });
  }

  // 4️⃣ كارت أحمر — +3 لو توقعه وحصل، -1 لو توقعه وماحصلش
  if (pred.predicted_red_card === true && redCardInMatch) {
    items.push({ icon: '🟥', label: 'كارت أحمر صح', pts: 3 });
  } else if (pred.predicted_red_card === true && !redCardInMatch) {
    items.push({ icon: '🟥', label: 'كارت أحمر غلط', pts: -1 });
  }

  // 5️⃣ ضربة جزاء في الماتش (penalty_in_match) — +3 لو توقعها وحصلت، -1 لو توقعها وماحصلتش
  if (pred.predicted_penalty === true && penaltyInMatch) {
    items.push({ icon: '⚽', label: 'ضربة جزاء في الماتش صح', pts: 3 });
  } else if (pred.predicted_penalty === true && !penaltyInMatch) {
    items.push({ icon: '⚽', label: 'ضربة جزاء في الماتش غلط', pts: -1 });
  }

  // 6️⃣ وقت إضافي — +3 لو توقعه وحصل، -1 لو توقعه وماحصلش (مطابق update-results)
  if (pred.predicted_extra_time === true && wentExtraTime) {
    items.push({ icon: '⏱️', label: 'وقت إضافي صح', pts: 3 });
  } else if (pred.predicted_extra_time === true && !wentExtraTime) {
    items.push({ icon: '⏱️', label: 'وقت إضافي غلط', pts: -1 });
  }

  // 7️⃣ ركلات الترجيح (went_penalty_shootout) — +3 لو توقعها وحصلت، -1 لو توقعها وماحصلتش (مطابق update-results)
  if (pred.predicted_penalty_shootout === true && wentPenaltyShootout) {
    items.push({ icon: '🎯', label: 'الماتش راح لركلات الترجيح صح', pts: 3 });
  } else if (pred.predicted_penalty_shootout === true && !wentPenaltyShootout) {
    items.push({ icon: '🎯', label: 'الماتش راح لركلات الترجيح غلط', pts: -1 });
  }

  const total = items.reduce((s, i) => s + i.pts, 0);
  return { items, total };
};

// ════════════════════════════════════════════════════════════════════
// 🎯 دقة توقع الماتش — نسبة اختيارات العضو الصح من البنود اللي ليها نتيجة فعلية
// المقام = عدد البنود المحسومة فعليًا في الماتش (اللي ليها نتيجة).
// البسط  = عدد البنود اللي العضو خمّنها صح.
// البنود: الاتجاه | السكور بالظبط | أول هداف (لو اختاره) | بنلطي | كارت أحمر
//        | وقت إضافي | ركلات ترجيح | الفريقين سجّلوا  (بندين منفصلين للنتيجة)
// ════════════════════════════════════════════════════════════════════
const computeMatchAccuracy = (pred: any): { correct: number; total: number; pct: number } => {
  const actualHome = pred.actual_home_score;
  const actualAway = pred.actual_away_score;
  if (actualHome === null || actualHome === undefined || actualAway === null || actualAway === undefined) {
    return { correct: 0, total: 0, pct: 0 };
  }

  const mx = matches.find((m: any) => m.fixture?.id === (pred.fixture_id || pred.api_fixture_id));
  const actualFirstScorer = pred.first_scorer_actual ?? mx?.first_scorer ?? null;
  const redCardInMatch      = (pred.red_card_in_match ?? mx?.red_card_in_match) === true;
  const penaltyInMatch      = (pred.penalty_in_match ?? mx?.penalty_in_match) === true;
  const wentExtraTime       = (pred.went_extra_time ?? mx?.went_extra_time) === true;
  const wentPenaltyShootout = (pred.went_penalty_shootout ?? mx?.went_penalty_shootout) === true;

  const predHome = pred.predicted_home_score;
  const predAway = pred.predicted_away_score;
  const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
  const predWinner   = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';

  let correct = 0;
  let total = 0;

  // 1️⃣ الاتجاه (بند منفصل)
  total++;
  if (actualWinner === predWinner) correct++;

  // 2️⃣ السكور بالظبط (بند منفصل)
  total++;
  if (predHome === actualHome && predAway === actualAway) correct++;

  // 3️⃣ أول هداف — يُحسب فقط لو العضو اختار هداف والماتش ليه هداف فعلي
  // المطابقة بأولوية الـ ID ثم الاسم المُطبَّع (مطابق لمنطق update-results)
  const predScorer = pred.predicted_first_scorer || null;
  const predScorerIdAcc =
    pred.predicted_first_scorer_id != null ? Number(pred.predicted_first_scorer_id) : null;
  const actualFirstScorerIdAcc =
    (pred.first_scorer_id ?? mx?.first_scorer_id) != null
      ? Number(pred.first_scorer_id ?? mx?.first_scorer_id)
      : null;
  if (predScorer && actualFirstScorer) {
    total++;
    const firstById =
      predScorerIdAcc !== null && actualFirstScorerIdAcc !== null && predScorerIdAcc === actualFirstScorerIdAcc;
    const firstByName = normScorer(predScorer) === normScorer(actualFirstScorer);
    if (firstById || firstByName) correct++;
  }

  // 4️⃣-8️⃣ البنود البوليانية — كلها محسومة فعليًا في الماتش
  const boolChecks: { pred: any; actual: boolean }[] = [
    { pred: pred.predicted_penalty,          actual: penaltyInMatch },
    { pred: pred.predicted_red_card,         actual: redCardInMatch },
    { pred: pred.predicted_extra_time,       actual: wentExtraTime },
    { pred: pred.predicted_penalty_shootout, actual: wentPenaltyShootout },
  ];
  for (const b of boolChecks) {
    total++;
    if ((b.pred === true) === b.actual) correct++;
  }

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, pct };
};

// 📊 إجمالي دقة التوقع العام = مجموع البنود الصح ÷ مجموع البنود المحسومة
// (عبر كل الماتشات اللي ليها نتيجة) — مطابق لبوكس الدقة داخل كل ماتش.
const accuracyAgg = resolvedPreds.reduce(
  (acc: { correct: number; total: number }, pr: any) => {
    const a = computeMatchAccuracy(pr);
    return { correct: acc.correct + a.correct, total: acc.total + a.total };
  },
  { correct: 0, total: 0 }
);
const efficiencyPct = accuracyAgg.total > 0
  ? Math.round((accuracyAgg.correct / accuracyAgg.total) * 100) : 0;

// ════════════════════════════════════════════════════════════════════
// 🏆 أقصى نقاط واقعية ممكنة لماتش محسوم — لو العضو خمّن كل الأحداث اللي
// حصلت فعلًا صح. مطابق لسقف نقاط computeBreakdown (بدون البنود السالبة).
//   اتجاه +5 | نتيجة بالظبط +5 | أول هداف +3 (لو الماتش ليه هداف فعلي)
//   + 3 لكل حدث بولياني حصل فعلًا: كارت أحمر/بنلتي/وقت إضافي/ركلات ترجيح
// ════════════════════════════════════════════════════════════════════
const computeMatchMaxPoints = (pred: any): number => {
  const actualHome = pred.actual_home_score;
  const actualAway = pred.actual_away_score;
  if (actualHome === null || actualHome === undefined || actualAway === null || actualAway === undefined) {
    return 0;
  }
  const mx = matches.find((m: any) => m.fixture?.id === (pred.fixture_id || pred.api_fixture_id));
  const actualFirstScorer   = pred.first_scorer_actual ?? mx?.first_scorer ?? null;
  const redCardInMatch      = (pred.red_card_in_match ?? mx?.red_card_in_match) === true;
  const penaltyInMatch      = (pred.penalty_in_match ?? mx?.penalty_in_match) === true;
  const wentExtraTime       = (pred.went_extra_time ?? mx?.went_extra_time) === true;
  const wentPenaltyShootout = (pred.went_penalty_shootout ?? mx?.went_penalty_shootout) === true;

  let max = 5 + 5; // الاتجاه + النتيجة بالظبط
  if (actualFirstScorer) max += 3; // أول هداف (الماتش ليه هداف فعلي)
  if (redCardInMatch)      max += 3;
  if (penaltyInMatch)      max += 3;
  if (wentExtraTime)       max += 3;
  if (wentPenaltyShootout) max += 3;
  return max;
};

// 🎯 دقة الماتش بالنقاط = نقاط الماتش الفعلية ÷ أقصى نقاط واقعية للماتش (للبادج داخل كل ماتش)
const computeMatchPointsAccuracy = (pred: any): { earned: number; max: number; pct: number } => {
  const max = computeMatchMaxPoints(pred);
  if (max <= 0) return { earned: 0, max: 0, pct: 0 };
  const earned = computeBreakdown(pred).total;
  const pct = Math.round((earned / max) * 100);
  return { earned, max, pct };
};

// 🏅 نقاطك الفعلية (من الماتشات المحسومة) ÷ أقصى نقاط واقعية ممكنة
const resolvedActualPoints = resolvedPreds.reduce(
  (sum: number, pr: any) => sum + (Number(pr?.points) || 0),
  0
);
const maxPossiblePoints = resolvedPreds.reduce(
  (sum: number, pr: any) => sum + computeMatchMaxPoints(pr),
  0
);
const pointsEfficiencyPct = maxPossiblePoints > 0
  ? Math.round((resolvedActualPoints / maxPossiblePoints) * 100) : 0;

  // PredVsActual: بوكس موحّد — كل اختيارات العضو (سطر لكل واحد) + الفعلي بمقابل ✅/❌
  const PredVsActual = ({ pred }: { pred: any }) => {
    const mx = matches.find((m: any) => m.fixture?.id === (pred.fixture_id || pred.api_fixture_id));
    const actualHomeRaw = pred.actual_home_score ?? mx?.actual_home_score ?? null;
    const hasResult = actualHomeRaw !== null && actualHomeRaw !== undefined;
    const actualHome = actualHomeRaw;
    const actualAway = pred.actual_away_score ?? mx?.actual_away_score ?? null;
    const actualFirstScorer = pred.first_scorer_actual ?? mx?.first_scorer ?? null;
    const actualScorers = extractScorersList(mx?.scorers_json, actualFirstScorer);
    const redCardInMatch = (pred.red_card_in_match ?? mx?.red_card_in_match) === true;
    const penaltyInMatch = (pred.penalty_in_match ?? mx?.penalty_in_match) === true;
    const wentExtraTime  = (pred.went_extra_time ?? mx?.went_extra_time) === true;
    const wentPenaltyShootout = (pred.went_penalty_shootout ?? mx?.went_penalty_shootout) === true;
    const bothTeamsScored = (pred.both_teams_scored ?? mx?.both_teams_scored) === true;

    // ⚽ أول هداف: نطابق منطق الحساب في update-results بالظبط —
    // أولوية للـ ID (مطابقة دقيقة)، ثم fallback بالاسم المُطبَّع.
    // ده بيحل مشكلة الاسم المختصر مقابل الكامل (مثال: "B. Embolo" = "Breel Embolo").
    const predScorer = pred.predicted_first_scorer || null;
    const predScorerId =
      pred.predicted_first_scorer_id != null ? Number(pred.predicted_first_scorer_id) : null;
    const actualFirstScorerId =
      (pred.first_scorer_id ?? mx?.first_scorer_id) != null
        ? Number(pred.first_scorer_id ?? mx?.first_scorer_id)
        : null;
    const isFirstById =
      predScorerId !== null && actualFirstScorerId !== null && predScorerId === actualFirstScorerId;
    const isFirstByName =
      !!predScorer && !!actualFirstScorer && normScorer(predScorer) === normScorer(actualFirstScorer);
    const scorerCorrect = isFirstById || isFirstByName;
    const yesNo = (v: boolean) => (v ? 'نعم' : 'لا');

    type Row = { icon: string; label: string; predText: string; actualText: string; correct: boolean | null };
    const rows: Row[] = [];

    const predHome = pred.predicted_home_score;
    const predAway = pred.predicted_away_score;
    const exactScore = hasResult && predHome === actualHome && predAway === actualAway;
    rows.push({
      icon: '🔢', label: 'النتيجة',
      predText: (predHome ?? '?') + ' – ' + (predAway ?? '?'),
      actualText: hasResult ? actualHome + ' – ' + actualAway : '—',
      correct: hasResult ? exactScore : null,
    });

    if (predScorer) {
      rows.push({
        icon: '⚽', label: 'أول هداف',
        predText: predScorer,
        actualText: hasResult ? (actualFirstScorer || '—') : '—',
        correct: hasResult ? scorerCorrect : null,
      });
    }

    const boolRows: { key: string; icon: string; label: string; actual: boolean }[] = [
      { key: 'predicted_penalty',          icon: '⚽', label: 'ضربة جزاء في الماتش', actual: penaltyInMatch },
      { key: 'predicted_red_card',         icon: '🟥', label: 'كارت أحمر',              actual: redCardInMatch },
      { key: 'predicted_extra_time',       icon: '⏱️', label: 'وقت إضافي',             actual: wentExtraTime },
      { key: 'predicted_penalty_shootout', icon: '🎯', label: 'ركلات الترجيح',        actual: wentPenaltyShootout },
    ];
    // 🔹 نعرض كل اختيارات العضو (نعم/لا) — مش بس اللي قال فيها نعم
    for (const br of boolRows) {
      const predYes = pred[br.key] === true;
      rows.push({
        icon: br.icon, label: br.label,
        predText: predYes ? 'نعم' : 'لا',
        actualText: hasResult ? yesNo(br.actual) : '—',
        correct: hasResult ? predYes === (br.actual === true) : null,
      });
    }

    const rowStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: 1.5, padding: '3px 0',
    };

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--line)' }}>
          <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>توقّعه</div>
          <div style={{ display: 'grid', gap: 2 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ ...rowStyle, borderBottom: i === rows.length - 1 ? 'none' : '1px dashed var(--line)' }}>
                <span style={{ flex: '0 0 auto' }}>{r.icon}</span>
                <span style={{ color: 'var(--muted)', flex: '0 0 auto' }}>{r.label}:</span>
                <span style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.predText}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 12, background: hasResult ? 'rgba(39,176,110,.07)' : 'var(--surface-3)', border: hasResult ? '1px solid rgba(39,176,110,.2)' : '1px solid var(--line)' }}>
          <div style={{ color: hasResult ? '#94f0c0' : 'var(--muted)', fontSize: 10, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>الفعلي</div>
          {hasResult ? (
            <div style={{ display: 'grid', gap: 2 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ ...rowStyle, borderBottom: i === rows.length - 1 ? 'none' : '1px dashed var(--line)' }}>
                  <span style={{ flex: '0 0 auto', fontSize: 13 }}>{r.correct === null ? '•' : r.correct ? '✅' : '❌'}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.actualText}</span>
                </div>
              ))}
              {actualScorers.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                  <div style={{ opacity: 0.8, marginBottom: 2 }}>الهدافون ({actualScorers.length})</div>
                  {actualScorers.map((s, si) => <div key={si}>⚽ {s}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>لم تُحسم بعد</div>
          )}
        </div>
      </div>
    );
  };

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
  // ✅ الرسالة تظهر لو ناقص أي حقل من الأربعة (اسم + تليفون + إيميل + فيسبوك)،
  // مستقلة عن profile_completed — عشان ننبّه اللي ناقصهم حقل بدون ما نخسّرهم نقاط
  const _pf = (v: any) => String(v ?? '').trim() !== '';
  const profileMissing: string[] = [];
  if (!_pf(profile?.full_name)) profileMissing.push('الاسم');
  if (!_pf(profile?.phone)) profileMissing.push('التليفون');
  if (!_pf(profile?.email)) profileMissing.push('الإيميل');
  if (!_pf(profile?.facebook_url)) profileMissing.push('رابط فيسبوك');
  const profileIncomplete = profileMissing.length > 0;
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
const myFilteredPredictionsSorted = [...predictions]
  .filter((p: any) => myFilteredMatches.some((m: any) => m.fixture.id === p.fixture_id))
  .sort((a: any, b: any) => {
    const aFinished = a.actual_home_score !== null && a.actual_home_score !== undefined;
    const bFinished = b.actual_home_score !== null && b.actual_home_score !== undefined;

    if (aFinished !== bFinished) return aFinished ? -1 : 1;

    const matchA = matches.find((m: any) => m.fixture.id === a.fixture_id);
    const matchB = matches.find((m: any) => m.fixture.id === b.fixture_id);

    const dateA = matchA?.fixture?.date ? new Date(matchA.fixture.date).getTime() : 0;
    const dateB = matchB?.fixture?.date ? new Date(matchB.fixture.date).getTime() : 0;

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
        @keyframes statsShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .stats-skel { position:relative; background-image:linear-gradient(90deg, transparent 0%, rgba(255,255,255,.10) 50%, transparent 100%); background-size:200% 100%; animation:statsShimmer 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .stats-skel { animation:pulse 1.6s ease-in-out infinite; } }
        .tab-btn { padding:10px 22px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; transition:all .2s; }
        .tab-btn.active { background:linear-gradient(90deg,rgba(217,178,95,.18),rgba(217,178,95,.06)); border-color:rgba(217,178,95,.3); color:#fff1ce; }
        .round-btn { padding:8px 16px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:all .2s; }
        .round-btn.active { color:#fff1ce; border-color:rgba(217,178,95,.3); background:rgba(217,178,95,.12); }
        .round-btn.upcoming { color:var(--muted); border-style:dashed; border-color:rgba(217,178,95,.28); background:rgba(217,178,95,.05); cursor:default; opacity:.85; }
        .round-btn.upcoming .soon-badge { display:inline-block; margin-inline-start:6px; font-size:10px; font-weight:800; color:#d9b25f; background:rgba(217,178,95,.14); border:1px solid rgba(217,178,95,.3); border-radius:999px; padding:1px 7px; }
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
        /* ✅ كارت الماتش الشغّال — نصّين: يمين (العنوان+الفريقين+التاريخ) وشمال (التوقع) */
        .live-match-card { display:flex; gap:12px; align-items:stretch; padding:14px 16px; border:1px solid rgba(59,130,246,.24); border-radius:18px; margin-bottom:14px; background:linear-gradient(90deg,rgba(59,130,246,.10),rgba(255,255,255,.02)); }
        .live-match-right { flex:0 0 46%; min-width:0; display:flex; flex-direction:column; gap:8px; text-align:right; border-left:1px solid var(--line); padding-left:12px; }
        .live-match-left  { flex:1 1 0; min-width:0; display:flex; flex-direction:column; justify-content:center; }
        .medal-box { width:44px; height:44px; border-radius:14px; background:rgba(217,178,95,.1); display:grid; place-items:center; font-size:22px; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px); display:grid; place-items:center; z-index:1000; padding:20px; }
        .modal-box { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015)),var(--surface); border:1px solid rgba(217,178,95,.2); border-radius:28px; padding:28px; width:100%; max-width:460px; box-shadow:0 24px 64px rgba(0,0,0,.6); max-height:90vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .modal-input { width:100%; padding:13px 16px; border-radius:14px; background:var(--surface-3); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; outline:none; transition:border-color .2s; direction:rtl; }
        .modal-input:focus { border-color:rgba(217,178,95,.4); }
        .quick-input { flex:1; padding:12px 16px; border-radius:14px; background:var(--surface-2); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; outline:none; transition:border-color .2s; direction:ltr; text-align:center; letter-spacing:.1em; }
        .quick-input:focus { border-color:rgba(217,178,95,.4); }
        .alert-banner { animation: slideDown .4s cubic-bezier(0.16,1,0.3,1); }
        .pulse { animation: pulse 2s ease-in-out infinite; }

        /* ══════ تحسينات الموبايل (≤ 600px) — بتعدّل على الـ classes بس، مفيش لمس للمنطق ══════ */
        @media (max-width: 600px) {
          /* منع الـ scroll الأفقي المزعج */
          html, body { overflow-x: hidden; max-width: 100%; }
          img, video { max-width: 100%; height: auto; }

          /* بطاقات الماتشات: مسافات أصغر = محتوى أوضح */
          .match-card { padding: 14px; border-radius: 18px; margin-bottom: 11px; }
          .pred-box { padding: 10px 12px; border-radius: 14px; }
          .score-row { padding: 10px 12px; gap: 8px; border-radius: 14px; }
          .field-row { padding: 10px 12px; gap: 8px; border-radius: 14px; }

          /* أزرار +/- : حجم متوازن يرتاح جوّا بوكس الفريق (بوكسين جنب بعض) */
          .score-btn { width: 40px; height: 40px; border-radius: 12px; font-size: 21px; }
          .score-val { font-size: 22px; min-width: 28px; }
          /* بوكس إدخال توقع النتيجة: تصغير المسافات الداخلية عشان ميطلعش برّه الشاشة */
          .score-input-box { padding: 10px 8px !important; }
          .score-input-box > div:last-child { gap: 6px !important; }
          .score-input-row { gap: 6px !important; }

          /* التابات الرئيسية حاويتها scroll أفقي → flex-shrink:0 يخليها تمرّ ناعم بدل التزاحم */
          .tab-btn { padding: 9px 16px; font-size: 13px; flex-shrink: 0; }
          /* الجولات حاويتها flex-wrap → تسيبها تلفّ طبيعي (مفيش flex-shrink) */
          .round-btn { padding: 7px 13px; font-size: 12px; }

          /* كارت الماتش الشغّال: يفضل نصّين على الموبايل بمسافات أصغر */
          .live-match-card { padding: 12px; gap: 10px; border-radius: 16px; }
          .live-match-right { flex-basis: 45%; padding-left: 10px; gap: 6px; }

          /* عناصر الترتيب والمودال */
          .rank-item { padding: 12px 14px; gap: 10px; border-radius: 16px; }
          .medal-box { width: 38px; height: 38px; border-radius: 12px; font-size: 19px; }
          .modal-box { padding: 20px; border-radius: 22px; }
          .modal-overlay { padding: 12px; }
          .save-btn { padding: 13px; font-size: 14px; }
        }

        /* شاشات صغيرة جداً (≤ 380px): تصغير إضافي خفيف */
        @media (max-width: 380px) {
          .match-card { padding: 12px; }
          .score-btn { width: 42px; height: 42px; }
          .tab-btn { padding: 8px 13px; font-size: 12px; }
        }
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
              {profileIncomplete ? '⚠️ أكمل بياناتك' : `✏️ ${displayName}`}
            </button>
            <Link href="/my-leagues" style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#93c5fd', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🏆 ليجاتي
            </Link>
            {/* ✅ جرس الإشعارات — يعرض الإعلانات ودعوات الليج (قبول/رفض) */}
            <button
              onClick={() => { setShowNotif(true); markNonInviteRead(); }}
              style={{ position: 'relative', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(217,178,95,.3)', background: 'rgba(217,178,95,.08)', color: '#f2d79e', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              🔔 الإشعارات
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: '#c93a2f', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'grid', placeItems: 'center', padding: '0 4px' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowReferral(true)} style={{ padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(39,176,110,.3)', background: 'rgba(39,176,110,.08)', color: '#5effa8', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🎁 ادعُ صديق
              {referralCount > 0 && <span style={{ background: 'rgba(39,176,110,.2)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{referralCount}</span>}
            </button>
            <button
              onClick={handlePushSubscribe}
              disabled={pushEnabled || pushLoading}
              style={{ padding: '8px 14px', borderRadius: 12, border: pushEnabled ? '1px solid rgba(39,176,110,.3)' : '1px solid rgba(255,255,255,.12)', background: pushEnabled ? 'rgba(39,176,110,.08)' : 'var(--surface-2)', color: pushEnabled ? '#5effa8' : 'var(--muted)', cursor: pushEnabled ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pushLoading ? 0.6 : 1, transition: 'all .2s' }}
            >
              {pushEnabled ? '✅ التنبيهات مفعّلة' : pushLoading ? '...' : '🔕 تفعيل التنبيهات'}
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

      {reviewNotice ? (
        <div style={{ background: 'linear-gradient(90deg,rgba(239,68,68,.10),rgba(217,178,95,.06))', borderBottom: '1px solid rgba(239,68,68,.18)', padding: '12px 20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#ffd6d6', lineHeight: 1.9 }}>
          <strong style={{ color: '#fff1f1' }}>⚠️ الحساب قيد المراجعة</strong>
          <span style={{ marginRight: 8 }}>{reviewNotice.message}</span>
        </div>
      ) : profileIncomplete ? (
        <div onClick={() => setShowProfileModal(true)} style={{ background: 'linear-gradient(90deg,rgba(217,178,95,.1),rgba(217,178,95,.04))', borderBottom: '1px solid rgba(217,178,95,.18)', padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#f2d79e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          ⚠️ لضمان أحقيتك في الجوائز أكمل النواقص ({profileMissing.join('، ')}) — <strong>اضغط هنا</strong>
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
      {selectedLeaderSummary?.totalPoints ?? 0}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
      {leaderModalRoundFilter ? `نقاط ${roundLabels[leaderModalRoundFilter] || leaderModalRoundFilter}` : 'نقاط التوقعات'}
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#ffe3a6', fontVariantNumeric: 'tabular-nums' }}>
      {selectedLeaderPredictions.reduce((sum: number, pred: any) => {
        // لو فيه دور مختار من المينو: نجمع نقاط الدور المختار بس. الديفولت = إجمالي كل التوقعات.
        if (leaderModalRoundFilter) {
          const matchInfo = matches.find((m: any) => Number(m.fixture.id) === Number(pred.fixture_id || pred.api_fixture_id));
          const predRound = pred.round || matchInfo?.league?.round;
          if (predRound !== leaderModalRoundFilter) return sum;
        }
        return sum + (pred.points || 0);
      }, 0)}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط الدعوات</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#94f0c0', fontVariantNumeric: 'tabular-nums' }}>
      {(selectedLeaderSummary?.penalty_points ?? 0) > 0 ? 0 : (selectedLeaderSummary?.referral_points ?? 0)}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط إكمال البروفايل</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#7db1ff', fontVariantNumeric: 'tabular-nums' }}>
      {(selectedLeaderSummary?.penalty_points ?? 0) > 0 ? 0 : (selectedLeaderSummary?.profile_points ?? 0)}
    </div>
  </div>

  <div className="stat-card" style={{ padding: 14, borderRadius: 18 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نقاط بونص مسابقة حلمك فيها</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#5effa8', fontVariantNumeric: 'tabular-nums' }}>
      {(selectedLeaderSummary?.penalty_points ?? 0) > 0 ? 0 : (selectedLeaderSummary?.bonus_points ?? 0)}
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

  {selectedLeader?.user_id === user?.id && (selectedLeaderSummary?.penalty_points ?? 0) > 0 && (
    <div className="stat-card" style={{ padding: 14, borderRadius: 18, border: '1px solid rgba(239,68,68,.22)', background: 'rgba(239,68,68,.08)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>الخصم الإداري</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fca5a5', fontVariantNumeric: 'tabular-nums' }}>
        -{selectedLeaderSummary?.penalty_points ?? 0}
      </div>
      <div style={{ fontSize: 11, color: '#ffd6d6', marginTop: 6 }}>
        تم إخفاء نقاط الدعوات والبروفايل والبونص لهذا العضو أثناء سريان الجزاء
      </div>
    </div>
  )}
</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>📋 توقعات العضو</div>
                  {rounds.length > 0 && (
                    <select
                      value={leaderModalRoundFilter}
                      onChange={e => setLeaderModalRoundFilter(e.target.value)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: leaderModalRoundFilter ? 'rgba(217,178,95,.12)' : 'var(--surface-3)',
                        color: leaderModalRoundFilter ? 'var(--gold)' : 'var(--text)',
                        fontFamily: 'Cairo, sans-serif',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        direction: 'rtl',
                        outline: 'none',
                      }}
                    >
                      <option value="">كل الجولات</option>
                      {displayRounds.map(r => (
                        <option key={r} value={r}>{roundLabels[r] || r}</option>
                      ))}
                    </select>
                  )}
                </div>

                {(() => {
                  const now = new Date();
                  // ✅ كل الماتشات الشغّالة دلوقتي (بدأت ولسه ما اتحسمتش) — ممكن يبقوا أكتر من ماتش
                  const currentMatches = [...matches]
                    .filter((m: any) => {
                      const matchDate = m?.fixture?.date ? new Date(m.fixture.date) : null;
                      const started = !!matchDate && matchDate <= now;
                      const hasFinalResult = m?.actual_home_score !== null && m?.actual_home_score !== undefined;
                      return started && !hasFinalResult;
                    })
                    .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

                  if (currentMatches.length === 0) {
                    return (
                      <div className="rank-item" style={{ marginBottom: 14, borderStyle: 'dashed', opacity: 0.9 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>🟡 التوقع الحالي للماتش الجاري</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
                          لا يوجد الآن ماتش جارٍ لعرض التوقع الحالي. سيظهر هنا تلقائيًا عند بدء أي مباراة وقبل تسجيل النتيجة النهائية.
                        </div>
                      </div>
                    );
                  }

                  return (<>
                  {currentMatches.length > 1 && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd', marginBottom: 8, textAlign: 'right' }}>
                      🔵 فيه {currentMatches.length} ماتشات شغّالة دلوقتي
                    </div>
                  )}
                  {currentMatches.map((currentMatch: any) => {
                  const currentFixtureId = Number(currentMatch?.fixture?.id);
                  const currentPrediction = selectedLeaderPredictions.find((pred: any) => Number(pred.fixture_id) === currentFixtureId || Number(pred.api_fixture_id) === currentFixtureId);

                  const currentMatchDate = currentMatch?.fixture?.date
                    ? new Date(currentMatch.fixture.date).toLocaleDateString('ar-EG', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <div key={currentFixtureId} className="live-match-card">
                      {/* ✅ النص اليمين: العنوان + الفريقين + التاريخ/الوقت (كل واحد في سطر) */}
                      <div className="live-match-right">
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', lineHeight: 1.6 }}>🔵 التوقع الحالي</div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', lineHeight: 1.7, justifyContent: 'flex-end' }}>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{currentMatch?.teams?.home?.name || currentMatch?.home_team_name || 'صاحب الأرض'}</span>
                          {currentMatch?.teams?.home?.logo && <img src={currentMatch.teams.home.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', borderRadius: 3, flex: '0 0 auto' }} />}
                          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>×</span>
                          {currentMatch?.teams?.away?.logo && <img src={currentMatch.teams.away.logo} alt="" width={16} height={16} style={{ objectFit: 'contain', borderRadius: 3, flex: '0 0 auto' }} />}
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{currentMatch?.teams?.away?.name || currentMatch?.away_team_name || 'الضيف'}</span>
                        </div>
                        {currentMatchDate && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                            🕒 {currentMatchDate}
                          </div>
                        )}
                        <div style={{ alignSelf: 'flex-end', padding: '3px 9px', borderRadius: 999, background: 'rgba(59,130,246,.10)', border: '1px solid rgba(59,130,246,.22)', color: '#93c5fd', fontSize: 10, fontWeight: 800, lineHeight: 1.6 }}>بدأت المباراة</div>
                        {/* 📊 نسبة H2H + نسبة توقع الأعضاء */}
                        <MatchStatsLines
                          h2h={h2hStats[currentFixtureId]}
                          community={communityStats[currentFixtureId]}
                          homeName={currentMatch?.teams?.home?.name}
                          awayName={currentMatch?.teams?.away?.name}
                          homeLogo={currentMatch?.teams?.home?.logo}
                          awayLogo={currentMatch?.teams?.away?.logo}
                          compact
                          loading={statsLoading && !communityStats[currentFixtureId] && !h2hStats[currentFixtureId]}
                        />
                      </div>

                      {/* ✅ النص الشمال: التوقع زي ما هو */}
                      <div className="live-match-left">
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
                      </div>{/* نهاية live-match-left */}
                    </div>
                  );
                  })}
                  </>);
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
                        if (!(hasResult || !started)) return false;
                        if (leaderModalRoundFilter) {
                          const predRound = pred.round || matchInfo?.league?.round;
                          return predRound === leaderModalRoundFilter;
                        }
                        return true;
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
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', direction: 'ltr' }}>
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

                            {/* بوكس موحّد: كل اختيارات العضو + الفعلي ✅/❌ */}
                            <PredVsActual pred={pred} />

                            {/* 🧮 بريك داون النقاط الموحّد — يوضح للعضو كل بند جاب كام نقطة */}
                            {hasResult && (() => {
                              const bd = computeBreakdown(pred);
                              const acc = computeMatchPointsAccuracy(pred);
                              return (
                                <div style={{ marginBottom: 12 }}>
                                  <PointsBreakdown items={bd.items} total={bd.total} accuracy={acc} />
                                </div>
                              );
                            })()}

                            <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                              وقت إرسال التوقع: {pred.submitted_at ? new Date(pred.submitted_at).toLocaleString('ar-EG') : 'بدون تاريخ'}
                            </div>
                          </div>

                          {/* صندوق الانتظار يظهر فقط لو مفيش نتيجة — الإجمالي بقى في PointsBreakdown */}
                          {!hasResult && (
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 14,
                              background: 'var(--surface-3)',
                              border: '1px solid var(--line)',
                              color: 'var(--muted)',
                              textAlign: 'center',
                              minWidth: 88,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>⏳</div>
                            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>بانتظار</div>
                          </div>
                          )}
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
          { pts: '+3',  text: 'توقع إن الماتش ينتهي بركلات الترجيح (بداية من دور الـ 32)', color: '#c084fc' },
          { pts: '+3',  text: 'توقعك الصح إن هيكون فيه كارت أحمر في الماتش (أيوة)', color: '#f97316' },
          { pts: '+3',  text: 'توقعك الصح إن هيكون فيه ضربة جزاء في الماتش (أيوة)', color: '#f97316' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: item.color, minWidth: 32, flexShrink: 0 }}>{item.pts}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{item.text}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, background: 'rgba(255,80,80,.06)', border: '1px solid rgba(255,80,80,.15)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#ff9e9e', lineHeight: 1.8 }}>
          ⚠️ لو توقعت غلط في حوار الكارت الأحمر أو ضربة الجزاء أو الوقت الإضافي أو ركلات الترجيح، هتتخصم منك نقطة (-1). فركّز كويس في توقعاتك!
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
  note: [
    '🚨 يشترط تقديم أغلفة الأكواد كلها في حال الفوز حتى يتم تأكيد النقاط.',
    '⚠️ أي محاولة كسب نقاط بطرق غير شرعية ستتسبب في عقوبة خصم نقاط من المشارك وقد تصل لإنهاء حسابه تمامًا في دوري التوقعات.'
  ]
},
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                                   <div>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{item.text} </span>
              {item.pts && <span style={{ fontWeight: 800, color: '#8ae0b3', fontSize: 13 }}>{item.pts}</span>}
              {item.note && (
                Array.isArray(item.note) ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      background: 'linear-gradient(180deg, rgba(220,38,38,.16), rgba(127,29,29,.18))',
                      border: '1px solid rgba(248,113,113,.35)',
                      borderRadius: 12,
                    }}
                  >
                    {item.note.map((line: string, ni: number) => (
                      <div
                        key={ni}
                        style={{
                          fontSize: 12,
                          color: '#ffd5d5',
                          lineHeight: 1.9,
                          fontWeight: 700,
                          marginBottom: ni < item.note.length - 1 ? 6 : 0,
                          textShadow: '0 0 10px rgba(255,120,120,.12)',
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, opacity: 0.7 }}>
                    {item.note}
                  </div>
                )
              )}
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

      {/* Section 6 — حق الاستبعاد (ملفت) */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(220,38,38,.16), rgba(127,29,29,.20))', border: '1.5px solid rgba(248,113,113,.45)', borderRadius: 18, padding: '18px 18px', marginBottom: 14, boxShadow: '0 0 24px rgba(220,38,38,.12), inset 0 0 40px rgba(220,38,38,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚖️</span>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#ffd5d5', textShadow: '0 0 12px rgba(255,120,120,.18)' }}>٦. حق إدارة المسابقة في الاستبعاد</div>
        </div>
        <div style={{ fontSize: 12.5, color: '#ffe3e3', lineHeight: 2, fontWeight: 600, marginBottom: 12, textAlign: 'justify' }}>
          تحتفظ إدارة المسابقة بالحق المطلق، ووفقًا لتقديرها المنفرد والنهائي وغير القابل للطعن، في استبعاد أي مشارك يثبت أو يُشتبه بقيامه بأي سلوك غير لائق أو مسيء أو من شأنه الإضرار بسير المسابقة أو بسمعة القائمين عليها أو المشاركين فيها. ويشمل ذلك، على سبيل المثال لا الحصر: استخدام ألفاظ أو عبارات غير لائقة، إرسال رسائل متكررة أو مزعجة، إساءة استخدام قنوات التواصل مع إدارة المسابقة، تقديم بلاغات أو ادعاءات كيدية أو غير صحيحة، أو ارتكاب أي تصرف آخر ترى إدارة المسابقة، وفق تقديرها المطلق، أنه يشكل مخالفة لقواعد المشاركة أو إخلالًا بنزاهة المسابقة.
        </div>
        <div style={{ fontSize: 12.5, color: '#ffe3e3', lineHeight: 2, fontWeight: 600, textAlign: 'justify', borderTop: '1px solid rgba(248,113,113,.25)', paddingTop: 12 }}>
          ويُعد قرار الاستبعاد نهائيًا وملزمًا، ويترتب عليه إلغاء أهلية المشارك للحصول على أي جوائز أو مزايا مرتبطة بالمسابقة، مع سقوط أي حق له في المطالبة بأي تعويض أو مراجعة أو اعتراض. كما تحتفظ إدارة المسابقة بحقها في اتخاذ أي إجراءات إضافية تراها مناسبة، بما في ذلك استبعاد أو تعليق أو حذف أي حسابات أخرى يثبت ارتباطها بالمشارك ذاته أو استخدامها للتحايل على قرار الاستبعاد، وذلك دون إشعار مسبق ودون أي مسؤولية قانونية أو التزام تجاه المشارك.
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.9 }}>
        بنتمنى لكم وقت ممتع مع مسابقات الشمعدان وبطولة كأس العالم 2026 🇪🇬<br />
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>فريق الشمعدان و KOR Platforms</span> — 11 يونيو 2026
      </div>
    </div>
  </div>
)}

      {/* ══ NOTIFICATIONS MODAL (نفس ستايل صفحة ليجاتي) ══ */}
      {showNotif && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowNotif(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🔔 الإشعارات</div>
              <button onClick={() => setShowNotif(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>

            {/* Empty state */}
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>لا توجد إشعارات بعد</div>
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)', opacity: .7 }}>هتظهر هنا الإعلانات ودعوات الليج</div>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} className="notif-item" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)', opacity: n.is_read ? 0.5 : 1, transition: 'opacity .25s' }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 600 : 800, lineHeight: 1.65, color: n.is_read ? 'var(--muted)' : 'var(--text)', marginBottom: 5 }}>
                    {getNotificationText(n)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: n.type === 'invite' && !n.is_read ? 10 : 0 }}>
                    {new Date(n.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {n.type === 'invite' && !n.is_read && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => respondToInvite(n, true)} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0', borderRadius: 12, padding: '8px 20px', fontSize: 13 }}>✅ قبول</button>
                      <button onClick={() => respondToInvite(n, false)} className="action-btn" style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91', borderRadius: 12, padding: '8px 20px', fontSize: 13 }}>❌ رفض</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'توقعاتي',    value: predictions.length,                                        color: '#8ae0b3', icon: '⚽' },
            { label: 'المتسابقون', value: totalParticipants, color: '#7db1ff', icon: '👥' },
           { label: 'دقة التوقع', value: maxPossiblePoints > 0 ? `${pointsEfficiencyPct}%` : '—', color: '#c084fc', icon: '🎯', sub: maxPossiblePoints > 0 ? `${resolvedActualPoints} من ${maxPossiblePoints} نقطة` : '' },
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
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff1ce', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{myDisplayedTotal} نقطة</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 8 }}>
  {(() => {
    const predPoints = myPredictionBreakdown;
            const chips = [
      { label: '⚽ توقعات', value: predPoints, color: 'rgba(138,224,179,.15)', border: 'rgba(138,224,179,.25)', text: '#8ae0b3' },
      ...(myReferralBreakdown > 0 ? [{ label: '👥 دعوات', value: myReferralBreakdown, color: 'rgba(125,177,255,.15)', border: 'rgba(125,177,255,.25)', text: '#7db1ff' }] : []),
      ...(myBonusBreakdown > 0 ? [{ label: '🎁 بونص', value: myBonusBreakdown, color: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.25)', text: '#c084fc' }] : []),
      ...(myProfilePoints > 0 ? [{ label: '👤 بروفايل', value: myProfilePoints, color: 'rgba(249,115,22,.15)', border: 'rgba(249,115,22,.25)', text: '#fb923c' }] : []),
      ...(myPenaltyBreakdown > 0 ? [{ label: '⛔ خصم', value: -myPenaltyBreakdown, color: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', text: '#fca5a5' }] : []),
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

        {/* بانر تشجيعي ذهبي — يحفّز اللاعب على المشاركة والتوقع */}
        <div style={{
          background: 'linear-gradient(90deg,rgba(217,178,95,.18),rgba(217,178,95,.06))',
          border: '1px solid rgba(217,178,95,.3)',
          borderRadius: 18,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 26, flexShrink: 0 }}>🌟</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff1ce', lineHeight: 1.7 }}>
            شارك في مسابقة حلمك وزود نقاطك — كل مشاركة وتوقع بيقرّبك من الذهب في نهاية البطولة!
          </div>
        </div>

        {/* 🔥 استطلاع دوري البريمير ليج / التشامبيونز ليج — يختفي بعد اختيار العضو */}
        {dreamChoice === null && (
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg,rgba(56,189,248,.12),rgba(217,178,95,.10))',
            border: '1px solid rgba(56,189,248,.32)',
            borderRadius: 20,
            padding: '18px 20px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#ffe3a6', marginBottom: 6, lineHeight: 1.7 }}>
              جاهز تكمل معانا الرحلة دي ولا لسه بتفكر؟ 🔥
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#cfe6ff', lineHeight: 1.9, marginBottom: 14 }}>
              إيه رأيك، تكون معانا في دوري توقعات البريمير ليج والتشامبيونز ليج؟ جاهز تشد حزامك وتدخل السباق وتكون واحد من نجوم التوقعات مع جوائز كتيرة.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => saveDreamChoice('ready')}
                disabled={dreamSaving}
                style={{ flex: '1 1 160px', padding: '13px 16px', borderRadius: 14, background: 'linear-gradient(135deg,#e0bc73,#b9892d)', border: 'none', color: '#211708', fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif', cursor: dreamSaving ? 'wait' : 'pointer' }}
              >
                {dreamSaving ? '⏳' : 'أكيد جاهز، يلا نبدأ! 🔥'}
              </button>
              <button
                onClick={() => saveDreamChoice('thinking')}
                disabled={dreamSaving}
                style={{ flex: '1 1 160px', padding: '13px 16px', borderRadius: 14, background: 'rgba(148,163,184,.12)', border: '1px solid rgba(148,163,184,.3)', color: '#cbd5e1', fontWeight: 700, fontSize: 14, fontFamily: 'Cairo, sans-serif', cursor: dreamSaving ? 'wait' : 'pointer' }}
              >
                {dreamSaving ? '⏳' : 'لسه مش مقرر، سيبني أفكر'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.8 }}>
              💡 جاهز ومتحمس؟ كمّل بياناتك (تليفون وإيميل) عشان الدعوة الجديدة توصلك.
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
            { id: 'bracket', label: '👑 طريق البطل' },
            { id: 'elite',   label: '🎯 نُخبة الدقة' },
            // مخفي مؤقتًا — تاب "المسار" (السجل التاريخي). محفوظ للرجوع مستقبلًا.
            // { id: 'history', label: '📈 المسار' },
            { id: 'feed',    label: '🌍 النشاط' },
          ] as const).map(({ id, label }) => (
            <button key={id} className={`tab-btn${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</button>
          ))}
        </div>

        {profileIncomplete && (
          <div
            style={{
              marginTop: -10,
              marginBottom: 18,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid rgba(245,158,11,.26)',
              background: 'linear-gradient(180deg,rgba(245,158,11,.10),rgba(217,119,6,.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#ffe3a6', marginBottom: 2 }}>
                  لضمان أحقيتك في الجوائز لا بد من إكمال بيانات بروفايلك
                </div>
                <div style={{ fontSize: 12, color: '#f6ddb0', lineHeight: 1.8 }}>
                  الناقص عندك: <strong>{profileMissing.join('، ')}</strong>. كمّله من نافذة البروفايل، وسيختفي هذا التنبيه تلقائيًا بعد الإكمال.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid rgba(245,158,11,.32)',
                background: 'rgba(245,158,11,.14)',
                color: '#ffe3a6',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              أكمل البروفايل
            </button>
          </div>
        )}

        {activeTab === 'predict' && (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {displayRounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r] || r} ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
              {upcomingRounds.map(r => (
                <button key={r} className="round-btn upcoming" disabled title="جولة جديدة بجوائز إضافية — تظهر بعد تأهل الفرق">
                  {roundLabels[r] || r}<span className="soon-badge">قريبًا</span>
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
                      {/* بوكس موحّد: كل اختيارات العضو + الفعلي ✅/❌ */}
                      {existing && (
                        <PredVsActual pred={{ ...existing, fixture_id: match.fixture.id, actual_home_score: match.actual_home_score, actual_away_score: match.actual_away_score }} />
                      )}
                      {/* 📊 نسبة H2H + نسبة توقع الأعضاء — للماتشات المغلقة/المحسومة (المفتوحة تظهر جوّا الفورم) */}
                      {!match.is_open && (
                        <div style={{ marginBottom: 12 }}>
                          <MatchStatsLines
                            h2h={h2hStats[match.fixture.id]}
                            community={communityStats[match.fixture.id]}
                            homeName={match?.teams?.home?.name}
                            awayName={match?.teams?.away?.name}
                            homeLogo={match?.teams?.home?.logo}
                            awayLogo={match?.teams?.away?.logo}
                            loading={statsLoading && !communityStats[match.fixture.id] && !h2hStats[match.fixture.id]}
                          />
                        </div>
                      )}
                      {/* 🧮 بريك داون النقاط الموحّد (للماتشات المحسومة) */}
                      {existing && hasResult && (() => {
                        const bdPred = { ...existing, actual_home_score: match.actual_home_score, actual_away_score: match.actual_away_score };
                        const bd = computeBreakdown(bdPred);
                        const acc = computeMatchPointsAccuracy(bdPred);
                        return (
                          <div style={{ marginBottom: 12 }}>
                            <PointsBreakdown items={bd.items} total={bd.total} accuracy={acc} />
                          </div>
                        );
                      })()}

                      {match.is_open && (
                        <div>
                          {/* 📊 نسبة H2H + نسبة توقع الأعضاء — تظهر للعضو وهو بيتوقع. الضغط على نتيجة يملا الخانات */}
                          <MatchStatsLines
                            h2h={h2hStats[match.fixture.id]}
                            community={communityStats[match.fixture.id]}
                            homeName={match?.teams?.home?.name}
                            awayName={match?.teams?.away?.name}
                            homeLogo={match?.teams?.home?.logo}
                            awayLogo={match?.teams?.away?.logo}
                            loading={statsLoading && !communityStats[match.fixture.id] && !h2hStats[match.fixture.id]}
                            onPickScore={(h, a) => setScore(match.fixture.id, { homeScore: h, awayScore: a })}
                            onPickScorer={(name, pid) => setForm(match.fixture.id, { firstScorer: name, firstScorerId: pid })}
                          />
                          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 12, marginTop: 12 }}>توقّع النتيجة</div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                            <div className="score-input-box" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{match.teams.home.name}</div>
                              <div className="score-input-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <button className="score-btn" onClick={() => setScore(match.fixture.id, { homeScore: Math.max(0, (form.homeScore || 0) - 1) })}>−</button>
                                <span className="score-val">{form.homeScore || 0}</span>
                                <button className="score-btn plus" onClick={() => setScore(match.fixture.id, { homeScore: (form.homeScore || 0) + 1 })}>+</button>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 800, fontSize: 16 }}>VS<br /><span style={{ fontSize: 10 }}>—</span></div>
                            <div className="score-input-box" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{match.teams.away.name}</div>
                              <div className="score-input-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                <button className="score-btn" onClick={() => setScore(match.fixture.id, { awayScore: Math.max(0, (form.awayScore || 0) - 1) })}>−</button>
                                <span className="score-val">{form.awayScore || 0}</span>
                                <button className="score-btn plus" onClick={() => setScore(match.fixture.id, { awayScore: (form.awayScore || 0) + 1 })}>+</button>
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
  homeTeamId={match.db_home_team_id}
  awayTeamId={match.db_away_team_id}
  value={form.firstScorer}
  onChange={val => setForm(match.fixture.id, { firstScorer: val.player_name, firstScorerId: val.player_id ?? null })}
  disabled={(form.homeScore || 0) === 0 && (form.awayScore || 0) === 0}
  disabledHint="التعادل السلبي (0-0) مفيهوش أول هداف"
/>
                          </div>

                          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              توقعات إضافية
                              <span className="points-tag" style={{ background: 'rgba(217,178,95,.1)', color: '#ffe3a6', border: '1px solid rgba(217,178,95,.2)' }}>
اكسب 3 نقاط اضافية لكل توقع صحيح هنا 👇</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#fdba74', background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                              ⚠️ خد بالك، لو توقعت أي حاجة من دول بشكل غلط هتتخصم منك نقطة (-1) 😉
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              {[
                                { key: 'predicted_red_card', label: '🟥 بطاقة حمراء؟' },
                                { key: 'predicted_penalty',  label: '⚽ ركلة جزاء؟' },
                                // ⏱️🥅 الوقت الإضافي والترجيح — يظهروا بس في الأدوار الإقصائية (بداية من دور الـ 32)
                                //    whitelist أأمن من إخفاء group stage: نطابق أسماء أدوار خروج المغلوب في API-Football.
                                ...(/round of (32|16)|quarter|semi|final|3rd place|third place|play.?off/i.test(String(match.league?.round || match.round || '')) ? [
                                  { key: 'extraTime', label: '⏱️ وقت إضافي؟' },
                                  { key: 'penaltyShootout', label: '🥅 انتهى بركلات الترجيح؟' },
                                ] : []),
                              ].map(({ key, label }) => {
                                // 🥅 ركلات الترجيح مابتحصلش إلا بتعادل مستمر — لو المستخدم متوقّع فائز
                                // (نتيجة مش متعادلة) نعطّل خيار الترجيح ونمنع اختياره (تناقض منطقي).
                                const isDraw = (form.homeScore || 0) === (form.awayScore || 0);
                                const penaltyDisabled = key === 'penaltyShootout' && !isDraw;
                                return (
                                <label key={key} title={penaltyDisabled ? 'ركلات الترجيح متاحة فقط لو توقعت تعادل' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: penaltyDisabled ? 'not-allowed' : 'pointer', opacity: penaltyDisabled ? .45 : 1, padding: '10px 12px', borderRadius: 12, background: form[key] ? 'rgba(217,178,95,.08)' : 'var(--surface-3)', border: `1px solid ${form[key] ? 'rgba(217,178,95,.25)' : 'var(--line)'}`, transition: 'all .2s' }}>
                                  <input
                                    type="checkbox"
                                    disabled={penaltyDisabled}
                                    checked={form[key] ?? false}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      if (key === 'penaltyShootout' && penaltyDisabled) return;
                                      // ركلات الترجيح تستلزم وقت إضافي: اختيارها يفعّل الوقت الإضافي تلقائياً،
                                      // وإلغاء الوقت الإضافي يلغي الترجيح كمان.
                                      if (key === 'penaltyShootout') {
                                        setForm(match.fixture.id, checked
                                          ? { penaltyShootout: true, extraTime: true }
                                          : { penaltyShootout: false });
                                      } else if (key === 'extraTime') {
                                        setForm(match.fixture.id, checked
                                          ? { extraTime: true }
                                          : { extraTime: false, penaltyShootout: false });
                                      } else {
                                        setForm(match.fixture.id, { [key]: checked });
                                      }
                                    }}
                                    style={{ width: 17, height: 17, accentColor: 'var(--gold)', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: form[key] ? '#ffe3a6' : 'var(--muted)' }}>{label}</span>
                                </label>
                                );
                              })}
                            </div>
                            {(form.homeScore || 0) !== (form.awayScore || 0) && /round of (32|16)|quarter|semi|final|3rd place|third place|play.?off/i.test(String(match.league?.round || match.round || '')) && (
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                                ℹ️ ركلات الترجيح متاحة فقط لو توقعت تعادل. لو متوقّع فوز فريق، تقدر تختار «وقت إضافي» بس.
                              </div>
                            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>توقعاتي</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 12, padding: '8px 16px', fontWeight: 800, color: 'var(--gold)' }}>🏅 إجمالي التوقعات: {predictionOnlyPoints} نقطة</div>
                  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 16px', fontWeight: 800, color: 'var(--text)' }}>📍 {roundLabels[mySelectedRound] || mySelectedRound || roundLabels[activeRound] || activeRound || 'الجولة الحالية'}: {myFilteredRoundPts} نقطة</div>
                </div>
              </div>
              <div style={{ minWidth: 220, width: '100%', maxWidth: 280 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>اختر الجولة</div>
                <select
                  value={mySelectedRound}
                  onChange={(e) => setMyRoundFilter(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    color: 'var(--text)',
                    fontFamily: 'Cairo, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  {displayRounds.map((round: string) => (
                    <option key={round} value={round}>{roundLabels[round] || round}</option>
                  ))}
                </select>
              </div>
            </div>
            {(() => {
              const topPredictionsWithZero = [...pointsBreakdown]
                .sort((a: any, b: any) => Number(b.points ?? 0) - Number(a.points ?? 0))
                .slice(0, 15);

              return topPredictionsWithZero.length > 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>🔝 أفضل 15 توقع بالنقاط</div>
                {topPredictionsWithZero.map((p: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < topPredictionsWithZero.length - 1 ? '1px solid var(--line)' : 'none' }}>
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
            ) : myFilteredPredictionsSorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 44, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20 }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>🗂️</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>لا توجد توقعات في هذه الجولة</div>
                <div style={{ fontSize: 12 }}>اختر جولة أخرى من القائمة لعرض توقعاتها</div>
              </div>
            ) : myFilteredPredictionsSorted.map((p, i) => {
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

              return (
  <div
    key={i}
    className="rank-item"
    style={{
      display: 'grid',
      gridTemplateColumns: hasResult ? '1fr' : '1fr auto',
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

      {/* بوكس موحّد: كل اختيارات العضو + الفعلي ✅/❌ */}
      <PredVsActual pred={p} />

      {/* 🧮 بريك داون النقاط الموحّد */}
      {hasResult && (() => {
        const bd = computeBreakdown(p);
        const acc = computeMatchPointsAccuracy(p);
        return (
          <div style={{ marginBottom: 10 }}>
            <PointsBreakdown items={bd.items} total={bd.total} accuracy={acc} />
          </div>
        );
      })()}
    </div>

    {!hasResult && (
    <div
      style={{
        minWidth: 90,
        borderRadius: 16,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid var(--line)',
        display: 'grid',
        placeItems: 'center',
        padding: '12px 10px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--muted)' }}>⏳</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>بانتظار</div>
      </div>
    </div>
    )}
  </div>
              );
            })}
          </div>
        )}

        {(activeTab === 'leaders' || activeTab === 'roundleaders') && (() => {
          const finishedRounds = rounds.filter(r => {
            const roundMatches = matches.filter((m: any) => m.league?.round === r);
            return roundMatches.length > 0 && roundMatches.every((m: any) => m.actual_home_score !== null && m.actual_home_score !== undefined);
          });
          const selectableRounds = displayRounds;
          const effectiveRound = leaderRoundFilter;

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={leaderRoundFilter}
                    onChange={e => setLeaderRoundFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-3)',
                      color: 'var(--text)',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      direction: 'rtl',
                      outline: 'none',
                      minWidth: 190,
                    }}
                  >
                    <option value="">🏆 الصدارة العامة</option>
                    {selectableRounds.map(r => (
                      <option key={r} value={r}>
                        {roundLabels[r] || r}{r === activeRound ? ' (الحالية)' : ''}
                      </option>
                    ))}
                    {upcomingRounds.map(r => (
                      <option key={r} value={r} disabled>
                        {roundLabels[r] || r} — قريبًا 🔒
                      </option>
                    ))}
                  </select>
                </div>

                <Link href="/leaderboard" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>عرض الكامل ←</Link>
              </div>

              {roundLeaderLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>جاري تحميل صدارة {roundLabels[effectiveRound] || effectiveRound}</div>
                </div>
              ) : (() => {
                const isGeneralView = !leaderRoundFilter;
                const rankingData = isGeneralView ? leaderboard : roundLeaderboardRows;
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
                  const playerPredictionsCount = isGeneralView ? (player.count || 0) : (player.predictions_count || 0);
                  const playerPoints = isGeneralView ? (player.totalPoints || 0) : (player.total_points || 0);
                  return (
                    <div
                      key={`leader-${isGeneralView ? 'general' : effectiveRound}-${player.user_id}`}
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
                          {isGeneralView
                            ? `${playerPredictionsCount || 0} توقع`
                            : `مجموع نقاط التوقعات في ${roundLabels[effectiveRound] || effectiveRound}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                          {playerPoints}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>نقطة</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          );
        })()}

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

        {activeTab === 'elite' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>🎯 نُخبة الدقة</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                أفضل 25 متسابقًا في <strong style={{ color: 'var(--gold)' }}>دقة التوقع</strong> خلال آخر {eliteWindow || 6} مباريات محسومة — الدقة = النقاط اللي كسبها ÷ أقصى نقاط ممكنة لنفس الماتشات.
              </p>
            </div>
            {eliteLoading && eliteLeaders === null ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>جارٍ حساب الدقة…</div>
              </div>
            ) : (eliteLeaders && eliteLeaders.length > 0) ? (
              <>
                {eliteLeaders.map((p: any, i: number) => {
                  const isMe = p.user_id === user?.id;
                  return (
                    <button
                      type="button"
                      key={p.user_id || i}
                      onClick={() => openLeaderDetails({ user_id: p.user_id, display_name: p.display_name, user_email: p.user_email })}
                      className={`rank-item${isMe ? ' me' : ''}`}
                      style={{ width: '100%', textAlign: 'right', cursor: 'pointer', border: 'none', font: 'inherit' }}
                    >
                      <div className="medal-box">{i < 3 ? medals[i] : <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span>}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {p.display_name || '—'}
                          {isMe && <span style={{ fontSize: 11, background: 'rgba(217,178,95,.15)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px' }}>أنت</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {p.earned} من {p.max} نقطة — في {p.count} توقع
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{p.pct}%</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>دقة</div>
                      </div>
                    </button>
                  );
                })}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>لسة مفيش بيانات كافية</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>تظهر الصدارة بعد حسم عدد كافٍ من المباريات</div>
              </div>
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
                  <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openLeaderDetails({
                        user_id: item.user_id,
                        display_name: item.user_name || item.data?.display_name || item.data?.full_name || null,
                        user_email: item.user_email || item.data?.user_email || null,
                        totalPoints: 0,
                        count: 0,
                        profile_completed: false,
                      })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: 'var(--gold)',
                        cursor: 'pointer',
                        fontFamily: 'Cairo, sans-serif',
                        fontSize: 14,
                        fontWeight: 800,
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                      }}
                    >
                      {item.user_name || 'لاعب'}
                    </button>
                    {item.user_id === user?.id && <span style={{ fontSize: 11, background: 'rgba(217,178,95,.15)', color: '#ffe3a6', borderRadius: 999, padding: '2px 8px' }}>أنت</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{feedEventLabel(item.type, item.data)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{timeAgo(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bracket' && (
          <div>
            {bracketLoading && bracketRounds === null ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌳</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>جارٍ تحميل الشجرة…</div>
              </div>
            ) : (
              <BracketTree rounds={bracketRounds} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
