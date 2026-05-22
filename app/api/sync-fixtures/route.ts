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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceSync = searchParams.get('force') === 'true';

    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON || '2026';

    const data     = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
    const matches: any[] = data.response || [];

    let inserted = 0, updated = 0, skipped = 0, apiCalls = 1;

    for (const match of matches) {
      const apiId: number  = match.fixture.id;
      const status: string = match.fixture.status.short;
      const goalsHome      = match.goals?.home ?? null;
      const goalsAway      = match.goals?.away ?? null;
      const isFinished     = ['FT', 'AET', 'PEN'].includes(status);

      const wentExtraTime   = status === 'AET' || status === 'PEN';
      const bothTeamsScored = goalsHome !== null && goalsAway !== null
        ? goalsHome > 0 && goalsAway > 0 : false;

      // ✅ اقرأ الـ record الحالي من DB
      const { data: existing } = await supabaseAdmin
        .from('fixtures')
        .select('id, actual_home_score, first_scorer')
        .eq('api_fixture_id', apiId)
        .maybeSingle();

      // ✅ Guard: لو النتيجة + الهداف موجودين → تخطّى الـ API calls
      const alreadySynced = !forceSync &&
        existing?.actual_home_score !== null &&
        existing?.actual_home_score !== undefined &&
        existing?.first_scorer !== null &&
        existing?.first_scorer !== undefined;

      let redCard    = existing ? false : false;
      let penalty    = false;
      let firstScorer: string | null = null;

      if (isFinished && !alreadySynced) {
        await sleep(250);
        const evData = await apiFetch(`/fixtures/events?fixture=${apiId}`);
        apiCalls++;
        const events: any[] = evData.response || [];

        for (const ev of events) {
          if (ev.type === 'Card' && ev.detail === 'Red Card')    redCard   = true;
          if (ev.type === 'Goal' && ev.detail === 'Penalty')     penalty   = true;
          if (!firstScorer && ev.type === 'Goal' && ev.detail !== 'Own Goal') {
            firstScorer = ev.player?.name ?? null;
          }
        }

        await sleep(250);
        const luData = await apiFetch(`/fixtures/lineups?fixture=${apiId}`);
        apiCalls++;
        const lineups: any[] = luData.response || [];

        if (existing && lineups.length > 0) {
          await supabaseAdmin.from('fixture_players').delete().eq('api_fixture_id', apiId);
          const playersToInsert: any[] = [];
          for (const lu of lineups) {
            const side = lu.team.id === match.teams.home.id ? 'home' : 'away';
            const all  = [
              ...(lu.startXI     || []).map((p: any) => p.player),
              ...(lu.substitutes || []).map((p: any) => p.player),
            ];
            for (const pl of all) {
              if (pl?.name) playersToInsert.push({
                fixture_id: existing.id, api_fixture_id: apiId,
                player_name: pl.name, team_name: lu.team.name,
                team_side: side, position: pl.pos ?? null,
              });
            }
          }
          if (playersToInsert.length > 0) {
            await supabaseAdmin.from('fixture_players')
              .upsert(playersToInsert, { onConflict: 'api_fixture_id,player_name,team_side' });
          }
        }
      }

      const updatePayload: any = {
        went_extra_time:  wentExtraTime,
        both_teams_scored: bothTeamsScored,
        ...(goalsHome  !== null ? { actual_home_score: goalsHome } : {}),
        ...(goalsAway  !== null ? { actual_away_score: goalsAway } : {}),
        ...(!alreadySynced && firstScorer ? { first_scorer: firstScorer } : {}),
        ...(!alreadySynced ? { red_card_in_match: redCard, penalty_in_match: penalty } : {}),
      };

      if (!existing) {
        await supabaseAdmin.from('fixtures').insert({
          ...updatePayload,
          api_fixture_id: apiId,
          home_team: match.teams.home.name,
          away_team: match.teams.away.name,
          match_date: match.fixture.date,
          round: match.league.round,
          is_open: false,
        });
        inserted++;
      } else if (isFinished && !alreadySynced) {
        await supabaseAdmin.from('fixtures').update(updatePayload).eq('api_fixture_id', apiId);
        updated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true, total: matches.length,
      inserted, updated, skipped, apiCalls,
      note: forceSync ? '⚠️ Force sync — كل الـ API calls اتشغلت' : `✅ Guard فعّال — ${apiCalls} API call بس`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
