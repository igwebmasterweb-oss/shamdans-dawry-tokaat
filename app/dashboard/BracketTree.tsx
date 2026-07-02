'use client';
import { R32_SKELETON, R16_PAIRS, QF_PAIRS, SF_PAIRS, type SkelR32 } from './bracketSkeleton';

// ===== أنواع البيانات القادمة من /api/bracket =====
type ApiTeam = { id: number | null; name: string | null; logo: string | null };
type ApiMatch = {
  fixtureId: number;
  date: string;
  status: string;
  finished: boolean;
  home: ApiTeam;
  away: ApiTeam;
  homeScore: number | null;
  awayScore: number | null;
  wentPenalty: boolean;
  winner: 'home' | 'away' | null;
};
type Rounds = Record<string, ApiMatch[]>;

// ===== نوع الخانة المعروضة =====
type SlotTeam = { name: string | null; id: number | null; logo: string | null };
type Slot = {
  home: SlotTeam | null;
  away: SlotTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  wentPenalty: boolean;
  winner: 'home' | 'away' | null;
  played: boolean;   // فيه نتيجة فعلية
  known: boolean;    // الفريقين معروفين (مش TBD)
};

const LOGO = 'https://media.api-sports.io/football/teams/';
const logoFor = (id: number | null | undefined) => (id ? `${LOGO}${id}.png` : null);

const emptySlot = (): Slot => ({
  home: null, away: null, homeScore: null, awayScore: null,
  wentPenalty: false, winner: null, played: false, known: false,
});

// مطابقة فريق بالـid أو الاسم
function teamMatches(t: ApiTeam, id: number | null, name: string): boolean {
  if (id != null && t.id != null && t.id === id) return true;
  if (t.name && name && t.name.toLowerCase().trim() === name.toLowerCase().trim()) return true;
  return false;
}

// ابحث عن مباراة API تطابق زوج فريقين (بأي ترتيب)
function findApiMatch(list: ApiMatch[], aId: number | null, aName: string, bId: number | null, bName: string): ApiMatch | null {
  for (const m of list) {
    const ha = teamMatches(m.home, aId, aName), aa = teamMatches(m.away, aId, aName);
    const hb = teamMatches(m.home, bId, bName), ab = teamMatches(m.away, bId, bName);
    if ((ha && ab) || (hb && aa)) return m;
  }
  return null;
}

function apiToSlot(m: ApiMatch): Slot {
  return {
    home: { name: m.home.name, id: m.home.id, logo: m.home.logo || logoFor(m.home.id) },
    away: { name: m.away.name, id: m.away.id, logo: m.away.logo || logoFor(m.away.id) },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    wentPenalty: m.wentPenalty,
    winner: m.winner,
    played: m.homeScore != null && m.awayScore != null,
    known: true,
  };
}

// الفائز كـ SlotTeam (أو null لو مش محدد)
function winnerTeam(s: Slot): SlotTeam | null {
  if (!s.known || !s.winner) return null;
  return s.winner === 'home' ? s.home : s.away;
}

// خانة الفريقين معروفين (متأهلين من الدور السابق) لكن الماتش لسه ماتلعبش/مش موجود في API.
// بنعرض الفريقين بدون نتيجة — عشان الشجرة تربط نفسها بنفسها حتى لو API ما أنشأش الماتش بعد.
function pendingSlot(wa: SlotTeam, wb: SlotTeam): Slot {
  return {
    home: { name: wa.name, id: wa.id, logo: wa.logo || logoFor(wa.id) },
    away: { name: wb.name, id: wb.id, logo: wb.logo || logoFor(wb.id) },
    homeScore: null, awayScore: null, wentPenalty: false, winner: null,
    played: false, known: true,
  };
}

// ===== كارت مباراة =====
function TeamRow({ t, score, isWinner, pen }: { t: SlotTeam | null; score: number | null; isWinner: boolean; pen: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 6,
      background: isWinner ? 'rgba(217,178,95,.12)' : 'transparent',
    }}>
      {t?.logo
        ? <img src={t.logo} alt="" width={20} height={14} style={{ objectFit: 'cover', borderRadius: 2, flexShrink: 0, background: '#222' }} />
        : <span style={{ width: 20, height: 14, display: 'grid', placeItems: 'center', fontSize: 11, color: '#3a4658', flexShrink: 0 }}>؟</span>}
      <span style={{
        fontSize: 11, fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: isWinner ? '#ffe3a6' : (t?.name ? '#e5e7eb' : '#3a4658'),
        fontFamily: 'Cairo, sans-serif',
      }}>{t?.name ? teamNameAr(t.name) : 'TBD'}</span>
      {pen && <span style={{ fontSize: 9, color: '#f59e0b' }}>ط</span>}
      <span style={{ fontSize: 11, fontWeight: 800, minWidth: 12, textAlign: 'center', color: isWinner ? '#ffe3a6' : '#cbd5e1' }}>
        {score != null ? score : ''}
      </span>
    </div>
  );
}

function MatchCard({ slot }: { slot: Slot }) {
  if (!slot.known) {
    return (
      <div style={{
        width: '100%', minHeight: 52, background: '#0f141e', border: '1px dashed #263041',
        borderRadius: 10, display: 'grid', placeItems: 'center', color: '#3a4658', fontSize: 20, fontWeight: 900,
      }}>؟</div>
    );
  }
  return (
    <div style={{
      width: '100%', background: 'linear-gradient(180deg,#141a26,#0f141e)', border: '1px solid #1e2836',
      borderRadius: 10, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <TeamRow t={slot.home} score={slot.homeScore} isWinner={slot.winner === 'home'} pen={false} />
      <TeamRow t={slot.away} score={slot.awayScore} isWinner={slot.winner === 'away'} pen={slot.wentPenalty} />
    </div>
  );
}

// ===== تعريب أسماء الفرق (fallback للاسم الإنجليزي لو مش موجود) =====
const AR_NAMES: Record<string, string> = {
  'South Africa': 'جنوب أفريقيا', 'Canada': 'كندا', 'Germany': 'ألمانيا', 'Paraguay': 'باراغواي',
  'Netherlands': 'هولندا', 'Morocco': 'المغرب', 'Brazil': 'البرازيل', 'Japan': 'اليابان',
  'France': 'فرنسا', 'Sweden': 'السويد', 'Ivory Coast': 'ساحل العاج', 'Norway': 'النرويج',
  'Mexico': 'المكسيك', 'Ecuador': 'الإكوادور', 'England': 'إنجلترا', 'Congo DR': 'الكونغو',
  'DR Congo': 'الكونغو', 'USA': 'أمريكا', 'Bosnia & Herzegovina': 'البوسنة', 'Belgium': 'بلجيكا',
  'Senegal': 'السنغال', 'Portugal': 'البرتغال', 'Croatia': 'كرواتيا', 'Spain': 'إسبانيا',
  'Austria': 'النمسا', 'Switzerland': 'سويسرا', 'Algeria': 'الجزائر', 'Argentina': 'الأرجنتين',
  'Cape Verde Islands': 'الرأس الأخضر', 'Cape Verde': 'الرأس الأخضر', 'Colombia': 'كولومبيا',
  'Ghana': 'غانا', 'Australia': 'أستراليا', 'Egypt': 'مصر',
};
function teamNameAr(en: string): string { return AR_NAMES[en] || en; }

// ===== بناء الشجرة كاملة من بيانات API + الهيكل الثابت =====
function buildBracket(rounds: Rounds | null) {
  const R32 = rounds?.['Round of 32'] || [];
  const R16 = rounds?.['Round of 16'] || [];
  const QF = rounds?.['Quarter-finals'] || [];
  const SF = rounds?.['Semi-finals'] || [];
  const FN = rounds?.['Final'] || [];

  // R32: 16 خانة من الهيكل، نملّيها من API
  const r32: Slot[] = R32_SKELETON.map((sk: SkelR32) => {
    const m = findApiMatch(R32, sk.home.id, sk.home.name, sk.away.id, sk.away.name);
    if (m) return apiToSlot(m);
    // معروف الفريقين من الهيكل لكن لسه ملعبش
    return {
      home: { name: sk.home.name, id: sk.home.id, logo: logoFor(sk.home.id) },
      away: { name: sk.away.name, id: sk.away.id, logo: logoFor(sk.away.id) },
      homeScore: null, awayScore: null, wentPenalty: false, winner: null, played: false, known: true,
    };
  });

  // R16: 8 خانات — كل واحدة فايز زوج R32. نطابق مع API لو موجودة.
  const r16: Slot[] = R16_PAIRS.map(([iA, iB]) => {
    const wa = winnerTeam(r32[iA]);
    const wb = winnerTeam(r32[iB]);
    // لو عندنا الفريقين المتوقعين، نبحث في API عن المباراة الفعلية
    if (wa && wb) {
      const m = findApiMatch(R16, wa.id, wa.name || '', wb.id, wb.name || '');
      if (m) return apiToSlot(m);
      // الفريقين متأهلين بس API لسه ما أنشأش الماتش — نعرضهم متقدمين بدون نتيجة
      return pendingSlot(wa, wb);
    }
    // لسه الفريقين مش معروفين (الدور السابق ماخلصش) → TBD
    return emptySlot();
  });

  // QF: 4 خانات — فايز زوج R16
  const qf: Slot[] = QF_PAIRS.map(([iA, iB]) => {
    const wa = winnerTeam(r16[iA]);
    const wb = winnerTeam(r16[iB]);
    if (wa && wb) {
      const m = findApiMatch(QF, wa.id, wa.name || '', wb.id, wb.name || '');
      if (m) return apiToSlot(m);
      return pendingSlot(wa, wb);
    }
    return emptySlot();
  });

  // SF: 2 خانات — فايز زوج QF
  const sf: Slot[] = SF_PAIRS.map(([iA, iB]) => {
    const wa = winnerTeam(qf[iA]);
    const wb = winnerTeam(qf[iB]);
    if (wa && wb) {
      const m = findApiMatch(SF, wa.id, wa.name || '', wb.id, wb.name || '');
      if (m) return apiToSlot(m);
      return pendingSlot(wa, wb);
    }
    return emptySlot();
  });

  // النهائي — فايز SF-شمال × فايز SF-يمين
  let final: Slot = emptySlot();
  {
    const wa = winnerTeam(sf[0]);
    const wb = winnerTeam(sf[1]);
    if (wa && wb) {
      const m = findApiMatch(FN, wa.id, wa.name || '', wb.id, wb.name || '');
      final = m ? apiToSlot(m) : pendingSlot(wa, wb);
    }
  }

  // البطل
  const champion = winnerTeam(final);

  return { r32, r16, qf, sf, final, champion };
}

// عمود من مباريات موزّعة بالتساوي عموديًا
function Column({ slots, keyPrefix }: { slots: Slot[]; keyPrefix: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 8, height: '100%' }}>
      {slots.map((s, i) => <MatchCard key={`${keyPrefix}-${i}`} slot={s} />)}
    </div>
  );
}

export default function BracketTree({ rounds }: { rounds: Rounds | null }) {
  const b = buildBracket(rounds);

  // الجهة اليمنى (RTL): R32 يمين → R16 → QF (indices 4-7 لـR16, 2-3 لـQF, 1 لـSF)
  const rightR32 = b.r32.slice(8, 16);       // النصف اليمين (idx 8..15)
  const rightR16 = b.r16.slice(4, 8);
  const rightQF = b.qf.slice(2, 4);
  const rightSF = b.sf[1];

  const leftR32 = b.r32.slice(0, 8);          // النصف الشمال (idx 0..7)
  const leftR16 = b.r16.slice(0, 4);
  const leftQF = b.qf.slice(0, 2);
  const leftSF = b.sf[0];

  const cardW = 148;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>🌳 شجرة البطولة</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>من دور الـ32 حتى النهائي — تتحدّث تلقائيًا مع تأهّل الفرق</p>
      </div>

      <div className="bracket-hint" style={{ display: 'none', textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        ← اسحب أفقيًا لرؤية الشجرة كاملة →
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 8 }}>
        <div className="bracket-cols" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 0.9fr 1fr',
          gap: 10, alignItems: 'stretch', minWidth: 820,
        }}>
          {/* الجهة اليمنى */}
          <div style={{ display: 'grid', gridTemplateColumns: `${cardW}px 1fr 1fr`, gap: 8, direction: 'rtl' }}>
            <Column slots={rightR32} keyPrefix="rr32" />
            <Column slots={rightR16} keyPrefix="rr16" />
            <Column slots={rightQF} keyPrefix="rqf" />
          </div>

          {/* النص: البطل + النهائي + نص النهائي + المركز الثالث */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 132 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>نصف النهائي</div>
              <MatchCard slot={rightSF} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--gold, #d9b25f)', letterSpacing: 1, lineHeight: 1.4 }}>
                بطل العالم<br />WORLD CHAMPION
              </div>
              <div style={{
                marginTop: 6, width: 120, minHeight: 46, border: '1px solid rgba(217,178,95,.4)',
                background: 'linear-gradient(180deg,rgba(217,178,95,.15),rgba(217,178,95,.05))', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 6px', margin: '6px auto 0',
              }}>
                {b.champion?.logo && <img src={b.champion.logo} alt="" width={22} height={15} style={{ objectFit: 'cover', borderRadius: 2 }} />}
                <span style={{ fontSize: b.champion ? 13 : 22, fontWeight: 900, color: '#ffe3a6', fontFamily: 'Cairo, sans-serif' }}>
                  {b.champion ? teamNameAr(b.champion.name || '') : '؟'}
                </span>
              </div>
            </div>

            {/* النهائي */}
            <div style={{ width: 132 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>🏆 النهائي</div>
              <MatchCard slot={b.final} />
            </div>

            <div style={{ width: 132 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>نصف النهائي</div>
              <MatchCard slot={leftSF} />
            </div>

            {/* المركز الثالث (placeholder دائمًا — مش في الهيكل الآلي) */}
            <div style={{ width: 132, marginTop: 2 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>🥉 المركز الثالث</div>
              <div style={{
                width: '100%', minHeight: 44, background: '#0f141e', border: '1px dashed #263041',
                borderRadius: 10, display: 'grid', placeItems: 'center', color: '#3a4658', fontSize: 18, fontWeight: 900,
              }}>؟</div>
            </div>
          </div>

          {/* الجهة اليسرى */}
          <div style={{ display: 'grid', gridTemplateColumns: `1fr 1fr ${cardW}px`, gap: 8, direction: 'rtl' }}>
            <Column slots={leftQF} keyPrefix="lqf" />
            <Column slots={leftR16} keyPrefix="lr16" />
            <Column slots={leftR32} keyPrefix="lr32" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          :global(.bracket-hint) { display: block !important; }
        }
      `}</style>
    </div>
  );
}
