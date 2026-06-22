import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UPDATE_CHUNK_SIZE = 100;
const FEED_CHUNK_SIZE = 200;
const PROCESS_BATCH_SIZE = 1000;

function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getNameTokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return normalizeName(s).split(' ').filter(Boolean);
}

function expandCompactPlayerName(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '. ')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesReferToSamePlayer(a: string | null | undefined, b: string | null | undefined): boolean {
  const aa = normalizeName(a || '');
  const bb = normalizeName(b || '');
  if (!aa || !bb) return false;
  if (aa === bb) return true;

  const at = getNameTokens(expandCompactPlayerName(a));
  const bt = getNameTokens(expandCompactPlayerName(b));
  if (!at.length || !bt.length) return false;

  const aLast = at[at.length - 1];
  const bLast = bt[bt.length - 1];
  if (!aLast || !bLast) return false;

  const lastNamesCompatible =
    aLast === bLast ||
    aLast.startsWith(bLast) ||
    bLast.startsWith(aLast);

  if (!lastNamesCompatible) return false;

  const aFirst = at[0];
  const bFirst = bt[0];
  if (!aFirst || !bFirst) return false;

  const firstNamesCompatible =
    aFirst === bFirst ||
    aFirst[0] === bFirst[0] ||
    aFirst.startsWith(bFirst) ||
    bFirst.startsWith(aFirst);

  return firstNamesCompatible;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function cleanupPredictionFixtureLinks() {
  const { data: unresolvedPredictions, error } = await supabaseAdmin
    .from('predictions')
    .select('id, user_id, fixture_id, points')
    .is('points', null);

  if (error) throw error;

  if (!unresolvedPredictions || unresolvedPredictions.length === 0) {
    return { scanned: 0, fixed: 0, deleted: 0, skipped: 0 };
  }

  let fixed = 0;
  let deleted = 0;
  let skipped = 0;

  for (const pred of unresolvedPredictions) {
    const { data: alreadyValid, error: validError } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id')
      .eq('api_fixture_id', pred.fixture_id)
      .maybeSingle();

    if (validError) throw validError;
    if (alreadyValid) continue;

    const { data: localFixture, error: localError } = await supabaseAdmin
      .from('fixtures')
      .select('id, api_fixture_id')
      .eq('id', pred.fixture_id)
      .maybeSingle();

    if (localError) throw localError;

    if (!localFixture?.api_fixture_id) {
      skipped++;
      continue;
    }

    const { data: duplicateCorrectRow, error: duplicateError } = await supabaseAdmin
      .from('predictions')
      .select('id')
      .eq('user_id', pred.user_id)
      .eq('fixture_id', localFixture.api_fixture_id)
      .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicateCorrectRow?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from('predictions')
        .delete()
        .eq('id', pred.id);

      if (deleteError) throw deleteError;
      deleted++;
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('predictions')
      .update({ fixture_id: localFixture.api_fixture_id })
      .eq('id', pred.id);

    if (updateError) throw updateError;
    fixed++;
  }

  return {
    scanned: unresolvedPredictions.length,
    fixed,
    deleted,
    skipped,
  };
}

type FixtureResult = {
  api_fixture_id: number;
  actual_home_score: number;
  actual_away_score: number;
  first_scorer: string | null;
  first_scorer_id: number | null;
  scorers_json: any[] | null;
  scorers_ids_json: number[] | null;
  went_extra_time: boolean;
  red_card_in_match: boolean;
  penalty_in_match: boolean;
  both_teams_scored: boolean;
  round: string | null;
};

type PredictionRow = {
  id: number;
  user_id: string;
  fixture_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  predicted_first_scorer: string | null;
  predicted_first_scorer_id: number | null;
  predicted_extra_time: boolean;
  predicted_red_card: boolean;
  predicted_penalty: boolean;
  predicted_both_teams: boolean;
  home_team: string;
  away_team: string;
};

function calculatePredictionPoints(pred: PredictionRow, fixture: FixtureResult) {
  let points = 0;

  const actualHome = fixture.actual_home_score;
  const actualAway = fixture.actual_away_score;
  const predHome = pred.predicted_home_score;
  const predAway = pred.predicted_away_score;

  const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
  const predWinner = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';

  if (actualWinner === predWinner) {
    points += 5;
  }

  if (predHome === actualHome && predAway === actualAway) {
    points += 5;
  }

  const actualFirstScorer = fixture.first_scorer || null;
  const actualFirstScorerId =
    fixture.first_scorer_id !== null && fixture.first_scorer_id !== undefined
      ? Number(fixture.first_scorer_id)
      : null;

  const predictedScorer = pred.predicted_first_scorer || null;
  const predictedScorerId =
    pred.predicted_first_scorer_id !== null && pred.predicted_first_scorer_id !== undefined
      ? Number(pred.predicted_first_scorer_id)
      : null;

  const scorerIds = Array.isArray(fixture.scorers_ids_json)
    ? [...new Set(fixture.scorers_ids_json.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
    : [];

  const allScorerNames = Array.isArray(fixture.scorers_json)
    ? [
        ...new Set(
          fixture.scorers_json
            .map((item: any) => {
              if (typeof item === 'string') return item.trim();
              if (item && typeof item === 'object') {
                return String(
                  item.player_name ?? item.scorer_name ?? item.name ?? item.player?.name ?? ''
                ).trim();
              }
              return '';
            })
            .filter(Boolean)
        ),
      ]
    : [];

  if (predictedScorerId !== null) {
    const isFirstScorerById = actualFirstScorerId !== null && predictedScorerId === actualFirstScorerId;
    const scoredInMatchById = scorerIds.includes(predictedScorerId);

    if (isFirstScorerById) {
      points += 3;
    } else if (scoredInMatchById) {
      points += 1;
    } else if (predictedScorer) {
      const isFirstScorerByName =
        actualFirstScorer !== null && namesReferToSamePlayer(predictedScorer, actualFirstScorer);

      const scoredInMatchByName = allScorerNames.some((name) =>
        namesReferToSamePlayer(predictedScorer, name)
      );

      if (isFirstScorerByName) {
        points += 3;
      } else if (scoredInMatchByName) {
        points += 1;
      }
    }
  } else if (predictedScorer) {
    const isFirstScorerByName =
      actualFirstScorer !== null && namesReferToSamePlayer(predictedScorer, actualFirstScorer);

    const scoredInMatchByName = allScorerNames.some((name) =>
      namesReferToSamePlayer(predictedScorer, name)
    );

    if (isFirstScorerByName) {
      points += 3;
    } else if (scoredInMatchByName) {
      points += 1;
    }
  }

  if (fixture.red_card_in_match === true && pred.predicted_red_card === true) {
    points += 3;
  }
  if (fixture.red_card_in_match === false && pred.predicted_red_card === true) {
    points -= 1;
  }

  if (fixture.penalty_in_match === true && pred.predicted_penalty === true) {
    points += 3;
  }
  if (fixture.penalty_in_match === false && pred.predicted_penalty === true) {
    points -= 1;
  }

  return {
    points,
    actual_home_score: actualHome,
    actual_away_score: actualAway,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureParam = searchParams.get('fixture');
    const targetFixtureId = fixtureParam ? Number(fixtureParam) : null;
    const shouldCleanup = searchParams.get('cleanup') === 'true';

    if (fixtureParam && Number.isNaN(targetFixtureId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid fixture parameter' },
        { status: 400 }
      );
    }

    const cleanup = shouldCleanup
      ? await cleanupPredictionFixtureLinks()
      : { scanned: 0, fixed: 0, deleted: 0, skipped: 0 };

    if (shouldCleanup) {
      console.log('prediction cleanup summary:', cleanup);
    }

    let fixturesQuery = supabaseAdmin
      .from('fixtures')
      .select(
        'api_fixture_id, actual_home_score, actual_away_score, first_scorer, first_scorer_id, scorers_json, scorers_ids_json, went_extra_time, red_card_in_match, penalty_in_match, both_teams_scored, round'
      )
      .not('actual_home_score', 'is', null);

    if (targetFixtureId) {
      fixturesQuery = fixturesQuery.eq('api_fixture_id', targetFixtureId);
    }

    const { data: fixturesRaw, error: fixError } = await fixturesQuery;
    if (fixError) throw fixError;

    const fixtures = (fixturesRaw || []) as FixtureResult[];

    if (fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: targetFixtureId ? 'لا توجد نتيجة محفوظة لهذه المباراة بعد' : 'لا توجد ماتشات بها نتائج بعد',
        updated: 0,
        users: 0,
        cleanup,
      });
    }

    const fixtureMap = new Map<number, FixtureResult>(fixtures.map((f) => [f.api_fixture_id, f]));
    const fixtureIds = fixtures.map((f) => f.api_fixture_id);

    let totalUpdated = 0;
    const affectedUsers = new Set<string>();
    let totalPasses = 0;
    let lastId = 0;

    while (true) {
      totalPasses++;

      let predsQuery = supabaseAdmin
        .from('predictions')
        .select(
          'id, user_id, fixture_id, predicted_home_score, predicted_away_score, predicted_first_scorer, predicted_first_scorer_id, predicted_extra_time, predicted_red_card, predicted_penalty, predicted_both_teams, home_team, away_team'
        )
        .in('fixture_id', fixtureIds)
        .gt('id', lastId)
        .order('id', { ascending: true })
        .limit(PROCESS_BATCH_SIZE);

      if (!targetFixtureId) {
        predsQuery = predsQuery.or('points.is.null,points.eq.0');
      }

      const { data: predsRaw, error: predError } = await predsQuery;
      if (predError) throw predError;

      const preds = (predsRaw || []) as PredictionRow[];
      if (preds.length === 0) break;

      const predictionUpdates: {
        id: number;
        points: number;
        actual_home_score: number;
        actual_away_score: number;
      }[] = [];

      const socialFeedInserts: {
        user_id: string;
        type: string;
        data: {
          points: number;
          fixture_id: number;
          home_team: string;
          away_team: string;
        };
      }[] = [];

      for (const pred of preds) {
        const fixture = fixtureMap.get(pred.fixture_id);
        if (!fixture) continue;

        const calc = calculatePredictionPoints(pred, fixture);

        predictionUpdates.push({
          id: pred.id,
          points: calc.points,
          actual_home_score: calc.actual_home_score,
          actual_away_score: calc.actual_away_score,
        });

        affectedUsers.add(pred.user_id);

        if (calc.points !== 0) {
          socialFeedInserts.push({
            user_id: pred.user_id,
            type: calc.points > 0 ? 'points_earned' : 'points_lost',
            data: {
              points: calc.points,
              fixture_id: pred.fixture_id,
              home_team: pred.home_team,
              away_team: pred.away_team,
            },
          });
        }
      }

      for (const chunk of chunkArray(predictionUpdates, UPDATE_CHUNK_SIZE)) {
        const results = await Promise.all(
          chunk.map((update) =>
            supabaseAdmin
              .from('predictions')
              .update({
                points: update.points,
                actual_home_score: update.actual_home_score,
                actual_away_score: update.actual_away_score,
              })
              .eq('id', update.id)
          )
        );

        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }

      for (const chunk of chunkArray(socialFeedInserts, FEED_CHUNK_SIZE)) {
        if (chunk.length === 0) continue;

        const { error: feedError } = await supabaseAdmin.from('social_feed').insert(chunk);
        if (feedError) throw feedError;
      }

      totalUpdated += predictionUpdates.length;
      lastId = preds[preds.length - 1].id;

      if (preds.length < PROCESS_BATCH_SIZE) break;
    }

    const affectedUsersArray = Array.from(affectedUsers);

    if (affectedUsersArray.length > 0) {
      const { error: batchRefreshError } = await supabaseAdmin.rpc('refreshuserspointsbatch', {
        p_userids: affectedUsersArray,
      });

      if (batchRefreshError) {
        console.warn(
          'refreshuserspointsbatch failed — falling back to per-user refresh',
          batchRefreshError.message
        );

        for (const userId of affectedUsersArray) {
          const { error: singleRefreshError } = await supabaseAdmin.rpc('refreshuserpoints', {
            p_userid: userId,
          });

          if (singleRefreshError) {
            throw singleRefreshError;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${totalUpdated} توقع لـ ${affectedUsers.size} مستخدم`,
      updated: totalUpdated,
      users: affectedUsers.size,
      cleanup,
      fixture: targetFixtureId,
      passes: totalPasses,
    });
  } catch (error: any) {
    console.error('update-results error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
