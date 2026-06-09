import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export async function GET(request: NextRequest) {
  const internalKey = request.headers.get('x-internal-key');
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET || '';
  const isAuthorized =
    internalKey === cronSecret || authHeader === `Bearer ${cronSecret}`;

  try {
    // STEP 1: جلب fixtures عندها نتيجة
    const { data: fixtures, error: fixError } = await supabaseAdmin
      .from('fixtures')
      .select(
        'api_fixture_id, actual_home_score, actual_away_score, first_scorer, went_extra_time, red_card_in_match, penalty_in_match, both_teams_scored, round'
      )
      .not('actual_home_score', 'is', null);

    if (fixError) throw fixError;
    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد ماتشات بها نتائج بعد', updated: 0 });
    }

    const fixtureMap = new Map(fixtures.map(f => [f.api_fixture_id, f]));
    const fixtureIds = fixtures.map(f => f.api_fixture_id);

    // STEP 2: جلب predictions غير المحسوبة
    const { data: preds, error: predError } = await supabaseAdmin
      .from('predictions')
      .select(
        'id, user_id, fixture_id,' +
        'predicted_home_score, predicted_away_score, predicted_first_scorer,' +
        'predicted_extra_time, predicted_red_card, predicted_penalty, predicted_both_teams,' +
        'home_team, away_team'
      )
      .in('fixture_id', fixtureIds)
      .is('points', null);

    if (predError) throw predError;
    if (!preds || preds.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد توقعات تحتاج تحديث', updated: 0 });
    }

    // STEP 3: حساب النقاط
    // ────────────────────────────────────────────────────────
    // نظام النقاط:
    //   النتيجة الصحيحة تماماً          → +10
    //   الفائز/التعادل صح بس             → +5
    //   أول هداف صح                     → +3
    //   توقع إضافي صح (red/pen/extra)   → +2 لكل واحد
    //   توقع إضافي غلط                  → -1 لكل واحد   ← جديد
    //   ملاحظة: both_teams_scored شيل من الـ UI
    //           لكن لو موجود في الداتابيز نحسبه زي الأول
    //           (مش بنخصم عليه لأن اليوزر مش قادر يختاره)
    //   ملاحظة: extraTime مش بيظهر في Group Stage
    //           لو القيمة false بالديفولت مش نخصم
    //           (نخصم بس لو كان الـ checkbox متاح = round مش Group Stage)
    // ────────────────────────────────────────────────────────

    const predictionUpdates: { id: number; points: number; actual_home_score: number; actual_away_score: number }[] = [];
    const socialFeedInserts: { user_id: string; type: string; data: object }[] = [];
    const affectedUsers = new Set<string>();

    for (const pred of preds) {
      const fixture = fixtureMap.get(pred.fixture_id);
      if (!fixture) continue;

      let points = 0;
      const actualHome: number = fixture.actual_home_score;
      const actualAway: number = fixture.actual_away_score;
      const predHome:   number = pred.predicted_home_score;
      const predAway:   number = pred.predicted_away_score;

      // ① النتيجة الأساسية
      if (predHome === actualHome && predAway === actualAway) {
        points += 10;
      } else {
        const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
        const predWinner   = predHome  > predAway   ? 'home' : predAway  > predHome   ? 'away' : 'draw';
        if (actualWinner === predWinner) points += 5;
      }

      // ② أول هداف
      if (fixture.first_scorer && pred.predicted_first_scorer) {
        const actual    = normalizeName(fixture.first_scorer);
        const predicted = normalizeName(pred.predicted_first_scorer);
        if (actual === predicted || actual.includes(predicted) || predicted.includes(actual)) {
          points += 3;
        }
      }

      // ③ التوقعات الإضافية — +2 للصح، -1 للغلط
      // الوقت الإضافي: يُحسب فقط في الأدوار الإقصائية (ليس Group Stage)
      const isGroupStage = fixture.round
        ? String(fixture.round).startsWith('Group Stage')
        : false;

      // — وقت إضافي (إقصائي فقط)
      if (!isGroupStage) {
        if (fixture.went_extra_time === true  && pred.predicted_extra_time === true)  points += 2;
        if (fixture.went_extra_time === false && pred.predicted_extra_time === true)  points -= 1;
        // لو predicted_extra_time = false لا نضيف ولا نخصم
      }

      // — بطاقة حمراء
      if (fixture.red_card_in_match === true  && pred.predicted_red_card === true)  points += 2;
      if (fixture.red_card_in_match === false && pred.predicted_red_card === true)  points -= 1;

      // — ركلة جزاء
      if (fixture.penalty_in_match === true  && pred.predicted_penalty === true)  points += 2;
      if (fixture.penalty_in_match === false && pred.predicted_penalty === true)  points -= 1;

      // — الفريقان يسجّلان (both_teams) — مُزال من الـ UI لكن نحسبه للسجلات القديمة
      // لا نطبق -1 هنا لأن اليوزر مش قادر يختاره من الـ UI الجديد
      if (fixture.both_teams_scored === true && pred.predicted_both_teams === true) points += 2;

      // ضمان ألا تقل النقاط الإضافية بشكل يأثر على الـ base score (النتيجة + الهداف)
      // مثال: لو حد عنده 10 من النتيجة و-3 من توقعات غلط = 7 — ده مقبول
      // لكن مش هنخلي المجموع الكلي أقل من 0
      if (points < 0) points = 0;

      predictionUpdates.push({ id: pred.id, points, actual_home_score: actualHome, actual_away_score: actualAway });

      if (points > 0) {
        socialFeedInserts.push({
          user_id: pred.user_id,
          type: 'points_earned',
          data: { points, fixture_id: pred.fixture_id, home_team: pred.home_team, away_team: pred.away_team },
        });
      }
      affectedUsers.add(pred.user_id);
    }

    // STEP 4: UPDATE predictions
    for (const update of predictionUpdates) {
      const { error: updateError } = await supabaseAdmin
        .from('predictions')
        .update({ points: update.points, actual_home_score: update.actual_home_score, actual_away_score: update.actual_away_score })
        .eq('id', update.id);
      if (updateError) throw updateError;
    }

    // STEP 5: Bulk insert social_feed
    if (socialFeedInserts.length > 0) {
      const { error: feedError } = await supabaseAdmin.from('social_feed').insert(socialFeedInserts);
      if (feedError) throw feedError;
    }

    // STEP 6: Batch refresh user_points
    const affectedUsersArray = Array.from(affectedUsers);
    if (affectedUsersArray.length > 0) {
      const { error: batchRefreshError } = await supabaseAdmin
        .rpc('refreshuserspointsbatch', { p_userids: affectedUsersArray });
      if (batchRefreshError) {
        console.warn('refreshuserspointsbatch failed — falling back to per-user refresh', batchRefreshError.message);
        for (const userId of affectedUsers) {
          await supabaseAdmin.rpc('refreshuserpoints', { p_userid: userId });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${predictionUpdates.length} توقع لـ ${affectedUsers.size} مستخدم`,
      updated: predictionUpdates.length,
      users:   affectedUsers.size,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
