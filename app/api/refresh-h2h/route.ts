import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// فاصل زمني بين طلبات API لتفادي تجاوز الحد لكل دقيقة
const THROTTLE_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchH2H(home: number, away: number) {
  const API_KEY = process.env.FOOTBALL_API_KEY || '';
  if (!API_KEY) return null;

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${home}-${away}&last=10`,
    { headers: { 'x-apisports-key': API_KEY }, cache: 'no-store' }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const errs = data?.errors;
  const hasErr = errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0);
  if (hasErr) return { _rateLimited: true } as any;

  const matches: any[] = Array.isArray(data?.response) ? data.response : [];
  let homeWins = 0, awayWins = 0, draws = 0;
  for (const m of matches) {
    const gh = m?.goals?.home;
    const ga = m?.goals?.away;
    if (gh === null || ga === null || gh === undefined || ga === undefined) continue;
    const fh = Number(m?.teams?.home?.id);
    const fa = Number(m?.teams?.away?.id);
    let win: number | null = null;
    if (gh > ga) win = fh;
    else if (ga > gh) win = fa;
    if (win === null) draws++;
    else if (win === home) homeWins++;
    else if (win === away) awayWins++;
    else {
      const hw = m?.teams?.home?.winner;
      if (hw === true) { fh === home ? homeWins++ : awayWins++; }
      else { fa === away ? awayWins++ : homeWins++; }
    }
  }
  const total = homeWins + awayWins + draws;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    home_wins: homeWins, away_wins: awayWins, draws, total,
    home_pct: pct(homeWins), draw_pct: pct(draws), away_pct: pct(awayWins),
  };
}

// يحدّث كاش H2H لكل أزواج الفرق في الـ fixtures (يُستدعى بـ cron يومي)
export async function GET(_req: NextRequest) {
  try {
    // كل أزواج الفرق الفريدة من الماتشات اللي ليها فريقين
    const { data: fx, error } = await supabaseAdmin
      .from('fixtures')
      .select('home_team_id, away_team_id')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 200 });

    // أزواج فريدة (بالترتيب اللي بيتعرض بيه: home ثم away)
    const seen = new Set<string>();
    const pairs: { home: number; away: number }[] = [];
    for (const r of fx || []) {
      const h = Number(r.home_team_id);
      const a = Number(r.away_team_id);
      if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
      const key = `${h}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ home: h, away: a });
    }

    let updated = 0;
    let rateLimited = 0;
    let failed = 0;

    for (const p of pairs) {
      const r: any = await fetchH2H(p.home, p.away);
      if (!r) { failed++; }
      else if (r._rateLimited) {
        rateLimited++;
        await sleep(THROTTLE_MS * 4); // تباطؤ أكثر عند الوصول للحد
      } else {
        await supabaseAdmin
          .from('h2h_cache')
          .upsert({ home_team_id: p.home, away_team_id: p.away, ...r, updated_at: new Date().toISOString() });
        updated++;
      }
      await sleep(THROTTLE_MS);
    }

    return NextResponse.json({ pairs: pairs.length, updated, rateLimited, failed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
