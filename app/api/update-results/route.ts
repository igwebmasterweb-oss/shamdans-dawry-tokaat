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
  try {
    const { data: fixturesRaw, error: fixError } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id, actual_home_score, actual_away_score, first_scorer, scorers_json, went_extra_time, red_card_in_match, penalty_in_match, both_teams_scored, round')
      .not('actual_home_score', 'is', null);

    if (fixError) throw fixError;

    const fixtures = fixturesRaw as Array<{
      api_fixture_id: number;
      actual_home_score: number;
      actual_away_score: number;
      first_scorer: string | null;
      scorers_json: string[] | null;
      went_extra_time: boolean;
      red_card_in_match: boolean;
      penalty_in_match: boolean;
      both_teams_scored: boolean;
      round: string | null;
    }>;

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد ماتشات بها نتائج بعد',
        updated: 0,
      });
    }

    const fixtureMap = new Map(fixtures.map(f => [f.api_fixture_id, f]));
    const fixtureIds = fixtures.map(f => f.api_fixture_id);

    const { data: predsRaw, error: predError } = await supabaseAdmin
      .from('predictions')
      .select('id, user_id, fixture_id, predicted_home_score, predicted_away_score, predicted_first_scorer, predicted_extra_time, predicted_red_card, predicted_penalty, predicted_both_teams, home_team, away_team')
      .in('fixture_id', fixtureIds)
      .is('points', null);

    if (predError) throw predError;

    const preds = predsRaw as Array<{
      id: number;
      user_id: string;
      fixture_id: number;
      predicted_home_score: number;
      predicted_away_score: number;
      predicted_first_scorer: string | null;
      predicted_extra_time: boolean;
      predicted_red_card: boolean;
      predicted_penalty: boolean;
      predicted_both_teams: boolean;
      home_team: string;
      away_team: string;
    }>;

    if (!preds || preds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد توقعات تحتاج تحديث',
        updated: 0,
      });
    }

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
      const actualHome = fixture.actual_home_score;
      const actualAway = fixture.actual_away_score;
      const predHome   = pred.predicted_home_score;
      const predAway   = pred.predicted_away_score;

      // ① النتيجة الأساسية
      if (predHome === actualHome && predAway === actualAway) {
        points += 10;
      } else {
        const actualWinner =
          actualHome > actualAway ? 'home' :
          actualAway > actualHome ? 'away' : 'draw';

        const predWinner =
          predHome > predAway ? 'home' :
          predAway > predHome ? 'away' : 'draw';

        if (actualWinner === predWinner) points += 5;
      }

      // ② الهداف
const actualFirstScorer = fixture.first_scorer
  ? normalizeName(fixture.first_scorer)
  : null;

const predictedScorer = pred.predicted_first_scorer
  ? normalizeName(pred.predicted_first_scorer)
  : null;

const allScorers = Array.isArray(fixture.scorers_json)
  ? [...new Set(
      fixture.scorers_json
        .map(name => normalizeName(String(name)))
        .filter(Boolean)
    )]
  : [];

if (predictedScorer) {
  const isFirstScorer =
    actualFirstScorer !== null &&
    predictedScorer === actualFirstScorer;

  const scoredInMatch =
    allScorers.includes(predictedScorer);

  if (isFirstScorer) {
    points += 3;
  } else if (scoredInMatch) {
    points += 1;
  }
}
      // ③ التوقعات الإضافية
      const isGroupStage = fixture.round
        ? String(fixture.round).startsWith('Group Stage')
        : false;

      // وقت إضافي — كما هو
      if (!isGroupStage) {
        if (fixture.went_extra_time === true && pred.predicted_extra_time === true) {
          points += 2;
        }
        if (fixture.went_extra_time === false && pred.predicted_extra_time === true) {
          points -= 1;
        }
      }

      // بطاقة حمراء — +3 / -1
      if (fixture.red_card_in_match === true && pred.predicted_red_card === true) {
        points += 3;
      }
      if (fixture.red_card_in_match === false && pred.predicted_red_card === true) {
        points -= 1;
      }

      // ركلة جزاء — +3 / -1
      if (fixture.penalty_in_match === true && pred.predicted_penalty === true) {
        points += 3;
      }
      if (fixture.penalty_in_match === false && pred.predicted_penalty === true) {
        points -= 1;
      }

      // الفريقان يسجلان — كما هو للسجلات القديمة
      if (fixture.both_teams_scored === true && pred.predicted_both_teams === true) {
        points += 2;
      }

      if (points < 0) points = 0;

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

    // STEP 4: UPDATE predictions
    for (const update of predictionUpdates) {
      const { error: updateError } = await supabaseAdmin
        .from('predictions')
        .update({
          points: update.points,
          actual_home_score: update.actual_home_score,
          actual_away_score: update.actual_away_score,
        })
        .eq('id', update.id);

      if (updateError) throw updateError;
    }

    // STEP 5: Bulk insert social_feed
    if (socialFeedInserts.length > 0) {
      const { error: feedError } = await supabaseAdmin
        .from('social_feed')
        .insert(socialFeedInserts);

      if (feedError) throw feedError;
    }

    // STEP 6: Batch refresh user_points
    const affectedUsersArray = Array.from(affectedUsers);

    if (affectedUsersArray.length > 0) {
      const { error: batchRefreshError } = await supabaseAdmin
        .rpc('refreshuserspointsbatch', { p_userids: affectedUsersArray });

      if (batchRefreshError) {
        console.warn(
          'refreshuserspointsbatch failed — falling back to per-user refresh',
          batchRefreshError.message
        );

        for (const userId of affectedUsers) {
          await supabaseAdmin.rpc('refreshuserpoints', { p_userid: userId });
        }
      }
    }

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
