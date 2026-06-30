import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// service role عشان نتجاوز RLS ونحسب النسب المجمّعة بدون كشف توقع أي عضو
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// نسبة توقع الأعضاء (فوز المضيف / تعادل / فوز الضيف) لكل ماتش
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids'); // قائمة fixture_id مفصولة بفاصلة

    if (!idsParam) {
      return NextResponse.json({ results: {} }, { status: 200 });
    }

    const fixtureIds = idsParam
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    if (fixtureIds.length === 0) {
      return NextResponse.json({ results: {} }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from('predictions')
      .select('fixture_id, predicted_home_score, predicted_away_score')
      .in('fixture_id', fixtureIds);

    if (error) {
      return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
    }

    // تجميع لكل fixture
    const agg: Record<number, { home: number; draw: number; away: number; total: number }> = {};
    // تجميع النتايج المحددة (scoreline) لكل fixture: المفتاح "home-away"
    const scoreAgg: Record<number, Record<string, { home: number; away: number; count: number }>> = {};
    for (const id of fixtureIds) {
      agg[id] = { home: 0, draw: 0, away: 0, total: 0 };
      scoreAgg[id] = {};
    }

    for (const row of data || []) {
      const fid = Number(row.fixture_id);
      if (!agg[fid]) continue;
      const h = row.predicted_home_score;
      const a = row.predicted_away_score;
      if (h === null || a === null || h === undefined || a === undefined) continue;

      agg[fid].total++;
      if (h > a) agg[fid].home++;
      else if (a > h) agg[fid].away++;
      else agg[fid].draw++;

      // تجميع النتيجة المحددة
      const key = `${h}-${a}`;
      if (!scoreAgg[fid][key]) scoreAgg[fid][key] = { home: Number(h), away: Number(a), count: 0 };
      scoreAgg[fid][key].count++;
    }

    const results: Record<number, any> = {};
    for (const id of fixtureIds) {
      const { home, draw, away, total } = agg[id];
      const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

      // أعلى 3 نتايج توقعاً (الأكثر تكراراً)
      const top_scorelines = Object.values(scoreAgg[id])
        .sort((x, y) => y.count - x.count)
        .slice(0, 3)
        .map((s) => ({
          home: s.home,
          away: s.away,
          count: s.count,
          pct: total > 0 ? Math.round((s.count / total) * 100) : 0,
        }));

      results[id] = {
        home_pct: pct(home),
        draw_pct: pct(draw),
        away_pct: pct(away),
        total,
        top_scorelines,
      };
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
  }
}
