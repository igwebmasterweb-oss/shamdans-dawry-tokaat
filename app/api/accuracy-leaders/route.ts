import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// service role عشان نتجاوز RLS ونحسب دقة كل الأعضاء بدون كشف توقعاتهم
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// dynamic: يتنفّذ عند الطلب فقط (مش وقت البناء) — الاستعلامات تقيلة وبتتجاوز مهلة الـ static generation.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ════════════════════════════════════════════════════════════════════
// 🎯 صدارة دقة التوقع — أفضل 25 متسابق حسب (نقاط مكتسبة ÷ أقصى نقاط ممكنة)
// على آخر 6 ماتشات محسومة في البطولة. نفس معادلة السقف في الداشبورد:
//   اتجاه +5 | نتيجة بالظبط +5 | أول هداف +3 (لو الماتش ليه هداف فعلي)
//   + 3 لكل حدث حصل فعلًا: كارت أحمر/بنلتي/وقت إضافي/ركلات ترجيح
// السقف بيعتمد على أحداث الماتش نفسه (مش على توقّع العضو)، فهو ثابت لكل ماتش.
// ════════════════════════════════════════════════════════════════════

const WINDOW = 6;       // آخر كام ماتش محسوم
const TOP = 25;         // كام متسابق نطلّع
const MIN_PREDS = 3;    // أقل عدد توقعات داخل النافذة عشان العضو يظهر (عدالة)

function matchMaxPoints(f: any): number {
  let max = 5 + 5; // الاتجاه + النتيجة بالظبط
  if (f.first_scorer)          max += 3; // الماتش ليه هداف فعلي
  if (f.red_card_in_match)     max += 3;
  if (f.penalty_in_match)      max += 3;
  if (f.went_extra_time)       max += 3;
  if (f.went_penalty_shootout) max += 3;
  return max;
}

export async function GET() {
  try {
    // 1) آخر 6 ماتشات محسومة (نتيجة مسجّلة) بترتيب زمني تنازلي
    const { data: fixtures, error: fxErr } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id, match_date, first_scorer, red_card_in_match, penalty_in_match, went_extra_time, went_penalty_shootout')
      .not('actual_home_score', 'is', null)
      .not('actual_away_score', 'is', null)
      .order('match_date', { ascending: false })
      .limit(WINDOW);

    if (fxErr) {
      return NextResponse.json({ leaders: [], error: fxErr.message }, { status: 200 });
    }
    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ leaders: [], window: 0 });
    }

    // سقف نقاط كل ماتش (ثابت لكل الأعضاء)
    const fixtureIds = fixtures.map((f: any) => Number(f.api_fixture_id));
    const maxByFixture = new Map<number, number>();
    for (const f of fixtures) maxByFixture.set(Number(f.api_fixture_id), matchMaxPoints(f));

    // 2) كل توقعات هذه الماتشات (pagination عشان نتجاوز حد 1000 صف)
    const PAGE = 1000;
    type PredRow = { user_id: string; fixture_id: number | null; points: number | null; user_email: string | null };
    const preds: PredRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabaseAdmin
        .from('predictions')
        .select('user_id, fixture_id, points, user_email')
        .in('fixture_id', fixtureIds)
        .range(from, from + PAGE - 1);
      if (error) {
        return NextResponse.json({ leaders: [], error: error.message }, { status: 200 });
      }
      if (!page || page.length === 0) break;
      preds.push(...page);
      if (page.length < PAGE) break;
    }

    // 3) تجميع لكل عضو: مجموع النقاط المكتسبة + مجموع السقف للماتشات اللي توقّعها
    const agg = new Map<string, { earned: number; max: number; count: number; email: string | null }>();
    for (const p of preds) {
      const fid = Number(p.fixture_id);
      const mx = maxByFixture.get(fid);
      if (mx == null) continue; // مش من ضمن الـ20
      const cur = agg.get(p.user_id) || { earned: 0, max: 0, count: 0, email: p.user_email ?? null };
      cur.earned += Number(p.points) || 0;
      cur.max += mx;
      cur.count += 1;
      if (!cur.email && p.user_email) cur.email = p.user_email;
      agg.set(p.user_id, cur);
    }

    // 4) الأسماء من profiles
    const userIds = Array.from(agg.keys());
    const nameById = new Map<string, string | null>();
    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += 500) {
        const slice = userIds.slice(i, i + 500);
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', slice);
        for (const pr of profs || []) nameById.set(pr.id, pr.full_name ?? null);
      }
    }

    // 5) الترتيب حسب الدقة تنازليًا (كسر التعادل بالنقاط المكتسبة ثم عدد التوقعات)
    const leaders = Array.from(agg.entries())
      .filter(([, v]) => v.count >= MIN_PREDS && v.max > 0)
      .map(([user_id, v]) => ({
        user_id,
        display_name: nameById.get(user_id) || (v.email ? v.email.split('@')[0] : null),
        user_email: v.email,
        earned: v.earned,
        max: v.max,
        count: v.count,
        pct: Math.round((v.earned / v.max) * 100),
      }))
      .sort((a, b) =>
        b.pct - a.pct ||
        b.earned - a.earned ||
        b.count - a.count
      )
      .slice(0, TOP);

    return NextResponse.json({
      leaders,
      window: fixtures.length,
      min_predictions: MIN_PREDS,
    });
  } catch (error: any) {
    return NextResponse.json({ leaders: [], error: error.message }, { status: 200 });
  }
}
