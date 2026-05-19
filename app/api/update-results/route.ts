import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: fixtures, error: fixError } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .not('actual_home_score', 'is', null);

    if (fixError) throw fixError;

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد ماتشات بها نتائج بعد',
        updated: 0,
      });
    }

    let totalUpdated = 0;
    const affectedUsers = new Set<string>();

    for (const fixture of fixtures) {
      // ✅ جيب فقط التوقعات اللي points = null — منعاً لإعادة الحساب
      const { data: preds } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('fixture_id', fixture.api_fixture_id)
        .is('points', null);

      if (!preds || preds.length === 0) continue;

      for (const pred of preds) {
        let points = 0;

        const actualHome = fixture.actual_home_score;
        const actualAway = fixture.actual_away_score;
        const predHome   = pred.predicted_home_score;
        const predAway   = pred.predicted_away_score;

        // +10 نتيجة كاملة
        if (predHome === actualHome && predAway === actualAway) {
          points += 10;
        } else {
          // +5 الفايز صح
          const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
          const predWinner   = predHome   > predAway   ? 'home' : predAway   > predHome   ? 'away' : 'draw';
          if (actualWinner === predWinner) points += 5;
        }

        // +3 أول هدف
        if (fixture.first_scorer && pred.predicted_first_scorer) {
          const actual    = fixture.first_scorer.trim().toLowerCase();
          const predicted = pred.predicted_first_scorer.trim().toLowerCase();
          if (actual === predicted || actual.includes(predicted) || predicted.includes(actual)) {
            points += 3;
          }
        }

        // +2 وقت إضافي
        if (fixture.went_extra_time === pred.predicted_extra_time) points += 2;

        // +5 سؤال المفاجأة
        if (fixture.surprise_answer && pred.surprise_answer) {
          const actual    = fixture.surprise_answer.trim().toLowerCase();
          const predicted = pred.surprise_answer.trim().toLowerCase();
          if (actual === predicted || actual.includes(predicted) || predicted.includes(actual)) {
            points += 5;
          }
        }

        await supabaseAdmin
          .from('predictions')
          .update({
            points,
            actual_home_score: actualHome,
            actual_away_score: actualAway,
          })
          .eq('id', pred.id);

        // ✅ social_feed insert عند كسب نقاط > 0
        if (points > 0) {
          await supabaseAdmin.from('social_feed').insert({
            user_id: pred.user_id,
            type: 'points_earned',
            data: {
              points,
              fixture_id: fixture.api_fixture_id,
              home_team: pred.home_team,
              away_team: pred.away_team,
            },
          });
        }

        affectedUsers.add(pred.user_id);
        totalUpdated++;
      }
    }

    // refresh user_points لكل المتأثرين
    for (const userId of affectedUsers) {
      await supabaseAdmin.rpc('refresh_user_points', { p_user_id: userId });
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${totalUpdated} توقع لـ ${affectedUsers.size} مستخدم`,
      updated: totalUpdated,
      users: affectedUsers.size,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
