import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function apiFetch(path: string) {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY || '' },
  });
  return res.json();
}

function normalizeScorerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

async function saveLineups(apiId: number, dbId: string, homeTeamId: number) {
  await sleep(250);
  const luData = await apiFetch(`/fixtures/lineups?fixture=${apiId}`);
  const lineups: any[] = luData.response || [];
  if (lineups.length === 0) return 0;

  await supabaseAdmin
    .from('fixture_players')
    .delete()
    .eq('api_fixture_id', apiId);

  const playersToInsert: any[] = [];

  for (const lu of lineups) {
    const side = lu.team.id === homeTeamId ? 'home' : 'away';
    const all = [
      ...(lu.startXI || []).map((p: any) => p.player),
      ...(lu.substitutes || []).map((p: any) => p.player),
    ];

    for (const pl of all) {
      if (pl?.name) {
        playersToInsert.push({
          fixture_id: dbId,
          api_fixture_id: apiId,
          player_name: pl.name,
          team_name: lu.team.name,
          team_side: side,
          position: pl.pos ?? null,
        });
      }
    }
  }

  if (playersToInsert.length > 0) {
    await supabaseAdmin
      .from('fixture_players')
      .upsert(playersToInsert, { onConflict: 'api_fixture_id,player_name,team_side' });
  }

  return playersToInsert.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceSync = searchParams.get('force') === 'true';

    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON = process.env.NEXT_PUBLIC_SEASON || '2026';

    const data = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
    const matches: any[] = data.response || [];

    let inserted = 0, updated = 0, skipped = 0, apiCalls = 1;

    for (const match of matches) {
      const apiId: number = match.fixture.id;
      const status: string = match.fixture.status.short;
      const goalsHome = match.goals?.home ?? null;
      const goalsAway = match.goals?.away ?? null;
      const isFinished = ['FT', 'AET', 'PEN'].includes(status);

      const wentExtraTime = status === 'AET' || status === 'PEN';
      const bothTeamsScored = goalsHome !== null && goalsAway !== null
        ? goalsHome > 0 && goalsAway > 0
        : false;

      const { data: existing } = await supabaseAdmin
        .from('fixtures')
        .select('id, actual_home_score, first_scorer, red_card_in_match, penalty_in_match, scorers_json')
        .eq('api_fixture_id', apiId)
        .maybeSingle();

      const alreadySynced = !forceSync &&
        existing?.actual_home_score !== null &&
        existing?.actual_home_score !== undefined;

      let redCard = existing?.red_card_in_match ?? false;
      let penalty = existing?.penalty_in_match ?? false;
      let firstScorer: string | null = existing?.first_scorer ?? null;
      let scorersJson: string[] = Array.isArray(existing?.scorers_json) ? existing.scorers_json : [];

      if (isFinished && !alreadySynced) {
        await sleep(250);
        const evData = await apiFetch(`/fixtures/events?fixture=${apiId}`);
        apiCalls++;
        const events: any[] = evData.response || [];

        redCard = false;
        penalty = false;
        firstScorer = null;
        scorersJson = [];

        for (const ev of events) {
          if (ev.type === 'Card' && ev.detail === 'Red Card') {
            redCard = true;
          }

          if (ev.type === 'Goal' && ev.detail === 'Penalty') {
            penalty = true;
          }

          if (ev.type === 'Goal' && ev.detail !== 'Own Goal') {
            const scorerName = ev.player?.name ? normalizeScorerName(ev.player.name) : null;

            if (scorerName) {
              if (!firstScorer) firstScorer = scorerName;
              if (!scorersJson.some(name => name === scorerName)) {
                scorersJson.push(scorerName);
              }
            }
          }
        }
      }

      if (!existing) {
        const basePayload = {
          api_fixture_id: apiId,
          home_team_name: match.teams.home.name,
          away_team_name: match.teams.away.name,
          home_team_id: match.teams.home.id,
          away_team_id: match.teams.away.id,
          home_team_logo: match.teams.home.logo,
          away_team_logo: match.teams.away.logo,
          match_date: match.fixture.date,
          round: match.league.round,
          is_open: false,
          went_extra_time: wentExtraTime,
          both_teams_scored: bothTeamsScored,
          scorers_json: scorersJson,
          ...(goalsHome !== null ? { actual_home_score: goalsHome } : {}),
          ...(goalsAway !== null ? { actual_away_score: goalsAway } : {}),
          ...(firstScorer ? { first_scorer: firstScorer } : {}),
          red_card_in_match: redCard,
          penalty_in_match: penalty,
        };

        const { data: newFixture } = await supabaseAdmin
          .from('fixtures')
          .insert(basePayload)
          .select('id')
          .single();

        if (newFixture && isFinished) {
          apiCalls++;
          await saveLineups(apiId, newFixture.id, match.teams.home.id);
        }

        inserted++;

      } else if (isFinished && !alreadySynced) {
        await supabaseAdmin
          .from('fixtures')
          .update({
            went_extra_time: wentExtraTime,
            both_teams_scored: bothTeamsScored,
            red_card_in_match: redCard,
            penalty_in_match: penalty,
            scorers_json: scorersJson,
            ...(goalsHome !== null ? { actual_home_score: goalsHome } : {}),
            ...(goalsAway !== null ? { actual_away_score: goalsAway } : {}),
            ...(firstScorer ? { first_scorer: firstScorer } : {}),
          })
          .eq('api_fixture_id', apiId);

        apiCalls++;
        await saveLineups(apiId, existing.id, match.teams.home.id);

        updated++;

      } else if (isFinished && alreadySynced) {
        await supabaseAdmin
          .from('fixtures')
          .update({
            went_extra_time: wentExtraTime,
            both_teams_scored: bothTeamsScored,
            scorers_json: scorersJson,
          })
          .eq('api_fixture_id', apiId);

        skipped++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      total: matches.length,
      inserted,
      updated,
      skipped,
      apiCalls,
      note: forceSync
        ? '⚠️ Force sync — كل الـ API calls اتشغلت'
        : `✅ Guard فعّال — ${apiCalls} API call بس`,
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
