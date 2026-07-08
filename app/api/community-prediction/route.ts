import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// service role عشان نتجاوز RLS ونحسب النسب المجمّعة بدون كشف توقع أي عضو
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// نسبة توقع الأعضاء (فوز المضيف / تعادل / فوز الضيف) لكل ماتش
// ⚡️ التجميع بيتم داخل قاعدة البيانات عبر RPC community_prediction_stats
// بدل جلب كل صفوف predictions (آلاف الصفوف) وحسابها في JS — أسرع وأخف بكتير
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

    // 🎯 استدعاء واحد — الـDB بيرجّع صف مجمّع لكل ماتش (النسب + أعلى النتايج + أعلى الهدافين)
    const { data, error } = await supabaseAdmin.rpc('community_prediction_stats', {
      p_fixture_ids: fixtureIds,
    });

    if (error) {
      return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
    }

    // تحويل صفوف الـRPC لنفس شكل الـresults القديم (مفهرس بـfixture_id)
    // ونضمن إن كل ماتش مطلوب موجود في النتيجة (لو مافيش توقعات → أصفار)
    const results: Record<number, any> = {};
    for (const id of fixtureIds) {
      results[id] = {
        home_pct: 0,
        draw_pct: 0,
        away_pct: 0,
        total: 0,
        top_scorelines: [],
        top_scorers: [],
      };
    }

    for (const row of (data as any[]) || []) {
      const fid = Number(row.fixture_id);
      if (!Number.isFinite(fid)) continue;
      results[fid] = {
        home_pct: Number(row.home_pct) || 0,
        draw_pct: Number(row.draw_pct) || 0,
        away_pct: Number(row.away_pct) || 0,
        total: Number(row.total) || 0,
        top_scorelines: Array.isArray(row.top_scorelines) ? row.top_scorelines : [],
        top_scorers: Array.isArray(row.top_scorers) ? row.top_scorers : [],
      };
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ results: {}, error: error.message }, { status: 200 });
  }
}
