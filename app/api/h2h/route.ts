import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// service role عشان نقرا/نكتب في h2h_cache بدون قيود RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// مدة صلاحية الكاش: 24 ساعة (نسب المواجهات التاريخية بتتغير نادراً)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type H2HResult = {
  home_wins: number;
  away_wins: number;
  draws: number;
  total: number;
  home_pct: number;
  draw_pct: number;
  away_pct: number;
};

const ZERO: H2HResult = { home_wins: 0, away_wins: 0, draws: 0, total: 0, home_pct: 0, draw_pct: 0, away_pct: 0 };

// يجيب نسب المواجهات من API-Football ويحسبها
async function fetchFromApi(home: string, away: string): Promise<H2HResult | null> {
  const API_KEY = process.env.FOOTBALL_API_KEY || '';
  if (!API_KEY) return null;

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${home}-${away}&last=10`,
    { headers: { 'x-apisports-key': API_KEY }, cache: 'no-store' }
  );
  if (!res.ok) return null;

  const data = await res.json();
  // لو API رجّع خطأ (rate limit مثلاً) → null عشان مانكتبش صفر غلط في الكاش
  const errs = data?.errors;
  const hasErr = errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0);
  if (hasErr) return null;

  const matches: any[] = Array.isArray(data?.response) ? data.response : [];
  const homeId = Number(home);
  const awayId = Number(away);

  let homeWins = 0, awayWins = 0, draws = 0;
  for (const m of matches) {
    const gh = m?.goals?.home;
    const ga = m?.goals?.away;
    if (gh === null || ga === null || gh === undefined || ga === undefined) continue;

    const fixtureHomeId = Number(m?.teams?.home?.id);
    const fixtureAwayId = Number(m?.teams?.away?.id);

    let winnerTeamId: number | null = null;
    if (gh > ga) winnerTeamId = fixtureHomeId;
    else if (ga > gh) winnerTeamId = fixtureAwayId;

    if (winnerTeamId === null) draws++;
    else if (winnerTeamId === homeId) homeWins++;
    else if (winnerTeamId === awayId) awayWins++;
    else {
      const hw = m?.teams?.home?.winner;
      const aw = m?.teams?.away?.winner;
      if (hw === true) { fixtureHomeId === homeId ? homeWins++ : awayWins++; }
      else if (aw === true) { fixtureAwayId === awayId ? awayWins++ : homeWins++; }
      else draws++;
    }
  }

  const total = homeWins + awayWins + draws;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    home_wins: homeWins,
    away_wins: awayWins,
    draws,
    total,
    home_pct: pct(homeWins),
    draw_pct: pct(draws),
    away_pct: pct(awayWins),
  };
}

// نسبة فوز كل فريق في آخر 10 مواجهات مباشرة — مع كاش في DB لتفادي rate limit
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const home = searchParams.get('home');
    const away = searchParams.get('away');

    if (!home || !away) {
      return NextResponse.json({ ...ZERO, error: 'missing team ids' }, { status: 200 });
    }

    const homeId = Number(home);
    const awayId = Number(away);

    // 1️⃣ جرّب الكاش الأول
    const { data: cached } = await supabaseAdmin
      .from('h2h_cache')
      .select('home_wins, away_wins, draws, total, home_pct, draw_pct, away_pct, updated_at')
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)
      .maybeSingle();

    const isFresh =
      cached?.updated_at &&
      Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS;

    if (cached && isFresh) {
      return NextResponse.json({
        home_wins: cached.home_wins,
        away_wins: cached.away_wins,
        draws: cached.draws,
        total: cached.total,
        home_pct: cached.home_pct,
        draw_pct: cached.draw_pct,
        away_pct: cached.away_pct,
        _cached: true,
      });
    }

    // 2️⃣ مفيش كاش حديث → اجيب من API
    const fresh = await fetchFromApi(home, away);

    if (!fresh) {
      // فشل API (rate limit مثلاً) → ارجع الكاش القديم لو موجود، وإلا أصفار
      if (cached) {
        return NextResponse.json({
          home_wins: cached.home_wins,
          away_wins: cached.away_wins,
          draws: cached.draws,
          total: cached.total,
          home_pct: cached.home_pct,
          draw_pct: cached.draw_pct,
          away_pct: cached.away_pct,
          _stale: true,
        });
      }
      return NextResponse.json({ ...ZERO, error: 'api unavailable' }, { status: 200 });
    }

    // 3️⃣ خزّن في الكاش (بدون انتظار النتيجة عشان السرعة)
    supabaseAdmin
      .from('h2h_cache')
      .upsert({ home_team_id: homeId, away_team_id: awayId, ...fresh, updated_at: new Date().toISOString() })
      .then(() => {});

    return NextResponse.json({ ...fresh, _fresh: true });
  } catch (error: any) {
    return NextResponse.json({ ...ZERO, error: error.message }, { status: 200 });
  }
}
