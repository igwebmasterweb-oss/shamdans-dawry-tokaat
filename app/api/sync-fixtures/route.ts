import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON    || '2026';
    const API_KEY   = process.env.FOOTBALL_API_KEY      || '';

    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}`,
      { headers: { 'x-apisports-key': API_KEY } }
    );

    const data = await res.json();
    const matches = data.response || [];

    for (const match of matches) {
      const { data: existing } = await supabaseAdmin
        .from('fixtures')
        .select('id')
        .eq('api_fixture_id', match.fixture.id)
        .single();

      if (!existing) {
        await supabaseAdmin.from('fixtures').insert({
          api_fixture_id: match.fixture.id,
          home_team:      match.teams.home.name,
          away_team:      match.teams.away.name,
          match_date:     match.fixture.date,
          round:          match.league.round,
          is_open:        false,
        });
      }
    }

    return NextResponse.json({ success: true, count: matches.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
