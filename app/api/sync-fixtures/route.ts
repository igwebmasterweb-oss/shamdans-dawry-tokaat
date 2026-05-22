import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const API_KEY = process.env.FOOTBALL_API_KEY || '';
const API_BASE = 'https://v3.football.api-sports.io';

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  return res.json();
}

export async function GET() {
  try {
    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON || '2026';

    // ① جيب كل الـ fixtures
    const data    = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
    const matches: any[] = data.response || [];

    let inserted = 0, updated = 0, skipped = 0;

    for (const match of matches) {
      const apiId: number    = match.fixture.id;
      const status: string   = match.fixture.status.short;
      const goalsHome        = match.goals?.home ?? null;
      const goalsAway        = match.goals?.away ?? null;
      const isFinished       = ['FT', 'AET', 'PEN'].includes(status);

      // ② احسب القيم البسيطة بدون API call إضافي
      const wentExtraTime   = status === 'AET' || status === 'PEN';
      const bothTeamsScored = goalsHome !== null && goalsAway !== null
        ? goalsHome > 0 && goalsAway > 0 : false;

      let redCard    = false;
      let penalty    = false;
      let firstScorer: string | null = null;

      // ③ للماتشات المنتهية: جيب events + lineups
      if (isFinished) {
        await sleep(250); // rate limit

        // — Events —
        const evData = await apiFetch(`/fixtures/events?fixture=${apiId}`);
        const events: any[] = evData.response || [];

        for (const ev of events) {
          if (ev.type === 'Card' && ev.detail === 'Red Card')     redCard = true;
          if (ev.type === 'Goal' && ev.detail === 'Penalty')      penalty = true;
          if (!firstScorer && ev.type === 'Goal' && ev.detail !== 'Own Goal') {
            firstScorer = ev.player?.name ?? null;
          }
        }

        await sleep(250); // rate limit

        // — Lineups: حفظ قائمة اللاعبين —
        const luData = await apiFetch(`/fixtures/lineups?fixture=${apiId}`);
        const lineups: any[] = luData.response || [];

        // احذف القديم وأضف الجديد (في حالة تغيّر التشكيلة)
        await supabaseAdmin
          .from('fixture_players')
          .delete()
          .eq('api_fixture_id', apiId);

        const playersToInsert: any[] = [];
        for (const lu of lineups) {
          const side = lu.team.id === match.teams.home.id ? 'home' : 'away';
          const allPlayers = [
            ...(lu.startXI || []).map((p: any) => p.player),
            ...(lu.substitutes || []).map((p: any) => p.player),
          ];
          for (const pl of allPlayers) {
            if (pl?.name) {
              playersToInsert.push({
                api_fixture_id: apiId,
                player_name:    pl.name,
                team_name:      lu.team.name,
                team_side:      side,
                position:       pl.pos ?? null,
              });
            }
          }
        }

        if (playersToInsert.length > 0) {
          // نجيب fixture.id من DB عشان الـ foreign key
          const { data: fx } = await supabaseAdmin
            .from('fixtures')
            .select('id')
            .eq('api_fixture_id', apiId)
            .maybeSingle();

          if (fx) {
            const withFxId = playersToInsert.map(p => ({
              ...p,
              fixture_id: fx.id,
            }));
            await supabaseAdmin
              .from('fixture_players')
              .upsert(withFxId, { onConflict: 'api_fixture_id,player_name,team_side' });
          }
        }
      }

      // ④ شوف هل موجود في DB
      const { data: existing } = await supabaseAdmin
        .from('fixtures')
        .select('id')
        .eq('api_fixture_id', apiId)
        .maybeSingle();

      const basePayload: any = {
        api_fixture_id:   apiId,
        home_team:        match.teams.home.name,
        away_team:        match.teams.away.name,
        match_date:       match.fixture.date,
        round:            match.league.round,
        went_extra_time:  wentExtraTime,
        both_teams_scored: bothTeamsScored,
        red_card_in_match: redCard,
        penalty_in_match:  penalty,
        ...(goalsHome  !== null ? { actual_home_score: goalsHome } : {}),
        ...(goalsAway  !== null ? { actual_away_score: goalsAway } : {}),
        ...(firstScorer        ? { first_scorer: firstScorer }    : {}),
      };

      if (!existing) {
        await supabaseAdmin.from('fixtures').insert({
          ...basePayload,
          is_open: false,
        });
        inserted++;
      } else if (isFinished) {
        await supabaseAdmin
          .from('fixtures')
          .update(basePayload)
          .eq('api_fixture_id', apiId);
        updated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ success: true, total: matches.length, inserted, updated, skipped });
  } catch (err: any) {
    console.error('sync-fixtures error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
