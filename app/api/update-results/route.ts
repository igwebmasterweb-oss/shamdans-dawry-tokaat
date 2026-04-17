import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // جيب كل الـ fixtures اللي عندها نتيجة فعلية
    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('api_fixture_id, actual_home_score, actual_away_score, first_scorer, went_extra_time, surprise_answer, surprise_question')
      .not('actual_home_score', 'is', null)
      .not('actual_away_score', 'is', null);

    if (fixturesError) throw fixturesError;
    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد ماتشات لها نتائج بعد', updated: 0 });
    }

    let totalUpdated = 0;

    for (const fixture of fixtures) {
      // جيب كل التوقعات على الماتش ده (حتى اللي نقاطها 0 عشان نعيد حسابها)
      const { data: predictions, error: predError } = await supabase
        .from('predictions')
        .select('*')
        .eq('fixture_id', fixture.api_fixture_id);

      if (predError || !predictions) continue;

      for (const pred of predictions) {
        let points = 0;
        const breakdown: string[] = [];

        const actualHome = fixture.actual_home_score;
        const actualAway = fixture.actual_away_score;
        const predHome = pred.predicted_home_score;
        const predAway = pred.predicted_away_score;

        // نتيجة كاملة = 10 نقاط
        if (predHome === actualHome && predAway === actualAway) {
          points += 10;
          breakdown.push('نتيجة كاملة +10');
        } else {
          // فايز صح (تعادل / فوز نفس الفريق) = 5 نقاط
          const actualResult = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
          const predResult = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
          if (actualResult === predResult) {
            points += 5;
            breakdown.push('فايز صح +5');
          }
        }

        // أول هدف = 3 نقاط
        if (
          fixture.first_scorer &&
          pred.predicted_first_scorer &&
          fixture.first_scorer.trim().toLowerCase() === pred.predicted_first_scorer.trim().toLowerCase()
        ) {
          points += 3;
          breakdown.push('أول هدف +3');
        }

        // وقت إضافي = 2 نقاط
        if (fixture.went_extra_time === pred.predicted_extra_time) {
          points += 2;
          breakdown.push('وقت إضافي +2');
        }

        // مفاجأة = 5 نقاط
        if (
          fixture.surprise_answer &&
          pred.surprise_answer &&
          fixture.surprise_answer.trim().toLowerCase() === pred.surprise_answer.trim().toLowerCase()
        ) {
          points += 5;
          breakdown.push('مفاجأة +5');
        }

        // حدّث التوقع
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            points,
            actual_home_score: actualHome,
            actual_away_score: actualAway,
          })
          .eq('id', pred.id);

        if (!updateError) totalUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${totalUpdated} توقع بنجاح`,
      updated: totalUpdated,
    });

  } catch (error: any) {
    console.error('update-results error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
