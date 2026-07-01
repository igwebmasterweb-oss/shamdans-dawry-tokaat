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

    // PostgREST بيقص النتايج عند 1000 صف افتراضيًا — نجيب كل الصفوف بالـpagination
    // عشان النسب المجمّعة تبقى مطابقة للداتا بيز مهما زاد عدد التوقعات
    const PAGE = 1000;
    const data: Array<{
      fixture_id: number | null;
      predicted_home_score: number | null;
      predicted_away_score: number | null;
      predicted_first_scorer: string | null;
      predicted_first_scorer_id: number | null;
    }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabaseAdmin
        .from('predictions')
        .select('fixture_id, predicted_home_score, predicted_away_score, predicted_first_scorer, predicted_first_scorer_id')
        .in('fixture_id', fixtureIds)
        .range(from, from + PAGE - 1);

      if (error) {
        return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
      }
      if (!page || page.length === 0) break;
      data.push(...page);
      if (page.length < PAGE) break;
    }

    // تجميع لكل fixture
    const agg: Record<number, { home: number; draw: number; away: number; total: number }> = {};
    // تجميع النتايج المحددة (scoreline) لكل fixture: المفتاح "home-away"
    const scoreAgg: Record<number, Record<string, { home: number; away: number; count: number }>> = {};
    // تجميع أول هداف متوقَّع لكل fixture: المفتاح اسم اللاعب (بعد trim)
    const scorerAgg: Record<number, Record<string, { name: string; player_id: number | null; count: number }>> = {};
    for (const id of fixtureIds) {
      agg[id] = { home: 0, draw: 0, away: 0, total: 0 };
      scoreAgg[id] = {};
      scorerAgg[id] = {};
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

      // تجميع أول هداف متوقَّع (لو موجود)
      const rawName = typeof row.predicted_first_scorer === 'string' ? row.predicted_first_scorer.trim() : '';
      if (rawName) {
        const sKey = rawName.toLowerCase();
        if (!scorerAgg[fid][sKey]) {
          scorerAgg[fid][sKey] = { name: rawName, player_id: row.predicted_first_scorer_id ?? null, count: 0 };
        }
        scorerAgg[fid][sKey].count++;
        if (scorerAgg[fid][sKey].player_id == null && row.predicted_first_scorer_id != null) {
          scorerAgg[fid][sKey].player_id = row.predicted_first_scorer_id;
        }
      }
    }

    const results: Record<number, any> = {};
    for (const id of fixtureIds) {
      const { home, draw, away, total } = agg[id];
      const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

      // أعلى 4 نتايج توقعاً + تجميع الباقي في "أخرى" (بحيث المجموع = كل التوقعات)
      const scorelinesSorted = Object.values(scoreAgg[id]).sort((x, y) => y.count - x.count);
      const top_scorelines: Array<{ home: number | null; away: number | null; count: number; pct: number; is_others?: boolean }> =
        scorelinesSorted.slice(0, 4).map((s) => ({
          home: s.home,
          away: s.away,
          count: s.count,
          pct: total > 0 ? Math.round((s.count / total) * 100) : 0,
        }));
      const scorelinesRest = scorelinesSorted.slice(4).reduce((acc, s) => acc + s.count, 0);
      if (scorelinesRest > 0) {
        top_scorelines.push({
          home: null,
          away: null,
          count: scorelinesRest,
          pct: total > 0 ? Math.round((scorelinesRest / total) * 100) : 0,
          is_others: true,
        });
      }

      // أعلى 4 هدافين متوقَّعين + تجميع الباقي في "أخرى" — النسبة من إجمالي مَن اختاروا هدافاً
      const scorerTotal = Object.values(scorerAgg[id]).reduce((acc, s) => acc + s.count, 0);
      const scorersSorted = Object.values(scorerAgg[id]).sort((x, y) => y.count - x.count);
      const top_scorers: Array<{ name: string; player_id: number | null; count: number; pct: number; is_others?: boolean }> =
        scorersSorted.slice(0, 4).map((s) => ({
          name: s.name,
          player_id: s.player_id,
          count: s.count,
          pct: scorerTotal > 0 ? Math.round((s.count / scorerTotal) * 100) : 0,
        }));
      const scorersRest = scorersSorted.slice(4).reduce((acc, s) => acc + s.count, 0);
      if (scorersRest > 0) {
        top_scorers.push({
          name: 'أخرى',
          player_id: null,
          count: scorersRest,
          pct: scorerTotal > 0 ? Math.round((scorersRest / scorerTotal) * 100) : 0,
          is_others: true,
        });
      }

      results[id] = {
        home_pct: pct(home),
        draw_pct: pct(draw),
        away_pct: pct(away),
        total,
        top_scorelines,
        top_scorers,
      };
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
  }
}
