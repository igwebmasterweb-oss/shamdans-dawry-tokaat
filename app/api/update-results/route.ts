import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ نفس normalizeName الأصلي — لم يتغير
function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export async function GET(request: NextRequest) {
  // ✅ نفس security check الأصلي — لم يتغير
  const internalKey = request.headers.get('x-internal-key');
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET || '';

  const isAuthorized =
    internalKey === cronSecret ||
    authHeader  === `Bearer ${cronSecret}`;

  if (cronSecret && !isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: جلب كل fixtures عندها نتيجة — query واحدة
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const { data: fixtures, error: fixError } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id, actual_home_score, actual_away_score, first_scorer, went_extra_time, red_card_in_match, penalty_in_match, both_teams_scored')
      .not('actual_home_score', 'is', null);

    if (fixError) throw fixError;
    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد ماتشات بها نتائج بعد', updated: 0 });
    }

    // map سريع: api_fixture_id → fixture data (بحث O(1) بدل nested loop)
    const fixtureMap = new Map(fixtures.map(f => [f.api_fixture_id, f]));
    const fixtureIds = fixtures.map(f => f.api_fixture_id);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: جلب كل predictions غير المحسوبة — query واحدة بدل N queries
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const { data: preds, error: predError } = await supabaseAdmin
      .from('predictions')
      .select('id, user_id, fixture_id, predicted_home_score, predicted_away_score, predicted_first_scorer, predicted_extra_time, predicted_red_card, predicted_penalty, predicted_both_teams, home_team, away_team')
      .in('fixture_id', fixtureIds)
      .is('points', null);

    if (predError) throw predError;
    if (!preds || preds.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد توقعات تحتاج تحديث', updated: 0 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: حساب النقاط — نفس اللوجيك الأصلي بالضبط
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const predictionUpdates: {
      id: number;
      points: number;
      actual_home_score: number;
      actual_away_score: number;
    }[] = [];

    const socialFeedInserts: {
      user_id: string;
      type: string;
      data: object;
    }[] = [];

    const affectedUsers = new Set<string>();

    for (const pred of preds) {
      const fixture = fixtureMap.get(pred.fixture_id);
      if (!fixture) continue;

      let points = 0;
      const actualHome: number = fixture.actual_home_score;
      const actualAway: number = fixture.actual_away_score;
      const predHome: number   = pred.predicted_home_score;
      const predAway: number   = pred.predicted_away_score;

      // +10 نتيجة كاملة
      if (predHome === actualHome && predAway === actualAway) {
        points += 10;
      } else {
        // +5 فائز / تعادل
        const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
        const predWinner   = predHome   > predAway   ? 'home' : predAway   > predHome   ? 'away' : 'draw';
        if (actualWinner === predWinner) points += 5;
      }

      // +3 أول هداف — مطابقة مرنة مع normalizeName
      if (fixture.first_scorer && pred.predicted_first_scorer) {
        const actual    = normalizeName(fixture.first_scorer);
        const predicted = normalizeName(pred.predicted_first_scorer);
        if (actual === predicted || actual.includes(predicted) || predicted.includes(actual)) {
          points += 3;
        }
      }

      // +2 وقت إضافي
      if (fixture.went_extra_time === true && pred.predicted_extra_time === true) points += 2;
      // +2 بطاقة حمراء
      if (fixture.red_card_in_match === true && pred.predicted_red_card === true)  points += 2;
      // +2 ركلة جزاء
      if (fixture.penalty_in_match === true && pred.predicted_penalty === true)    points += 2;
      // +2 BTTS
      if (fixture.both_teams_scored === true && pred.predicted_both_teams === true) points += 2;

      // جمع للـ batch arrays
      predictionUpdates.push({
        id: pred.id,
        points,
        actual_home_score: actualHome,
        actual_away_score: actualAway,
      });

      if (points > 0) {
        socialFeedInserts.push({
          user_id: pred.user_id,
          type: 'points_earned',
          data: {
            points,
            fixture_id: pred.fixture_id,
            home_team: pred.home_team,
            away_team: pred.away_team,
          },
        });
      }

      affectedUsers.add(pred.user_id);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: Bulk upsert predictions — call واحد بدل N calls
    // onConflict: 'id' يضمن UPDATE لكل صف موجود
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (predictionUpdates.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('predictions')
        .upsert(predictionUpdates, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: Bulk insert social_feed — call واحد بدل N calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (socialFeedInserts.length > 0) {
      const { error: feedError } = await supabaseAdmin
        .from('social_feed')
        .insert(socialFeedInserts);
      if (feedError) throw feedError;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: Batch refresh user_points — RPC واحد بدل N calls
    // يستخدم الدالة الجديدة refresh_users_points_batch
    // Fallback تلقائي للدالة القديمة لو الـ migration لم يُنفَّذ بعد
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const affectedUsersArray = Array.from(affectedUsers);
    const { error: batchRefreshError } = await supabaseAdmin
      .rpc('refresh_users_points_batch', { p_user_ids: affectedUsersArray });

    if (batchRefreshError) {
      // Fallback: الدالة الجديدة مش موجودة بعد
      console.warn('refresh_users_points_batch not found — falling back to per-user refresh');
      for (const userId of affectedUsers) {
        await supabaseAdmin.rpc('refresh_user_points', { p_user_id: userId });
      }
    }

    // ✅ نفس response shape الأصلي تماماً — لا يتأثر auto-sync أو admin
    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${predictionUpdates.length} توقع لـ ${affectedUsers.size} مستخدم`,
      updated: predictionUpdates.length,
      users: affectedUsers.size,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
