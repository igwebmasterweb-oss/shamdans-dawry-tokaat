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
  const authHeader = request.headers.get('authorization');
  const internalKey = request.headers.get('x-internal-key');
  const secret = process.env.CRON_SECRET || '';

  const isAuthorized =
    authHeader === `Bearer ${secret}` || internalKey === secret;

 if (secret && !isAuthorized) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

  try {
    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON    || '2026';

    // ① جيب كل الفرق المشاركة في البطولة
    const teamsData = await apiFetch(`/teams?league=${LEAGUE_ID}&season=${SEASON}`);
    const teams: any[] = teamsData.response || [];

    if (teams.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد فرق — تحقق من LEAGUE_ID و SEASON' });
    }

    let totalInserted = 0;
    let totalSkipped  = 0;
    let apiCalls      = 1; // teams call

    for (const teamEntry of teams) {
      const teamId   = teamEntry.team.id;
      const teamName = teamEntry.team.name;

      // ② شوف لو السكواد موجود بالفعل → تخطّى
      const { count } = await supabaseAdmin
        .from('team_players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if ((count ?? 0) > 0) {
        totalSkipped++;
        continue;
      }

      await sleep(300); // rate limit
      const squadData = await apiFetch(`/players/squads?team=${teamId}`);
      apiCalls++;

      const squadResponse: any[] = squadData.response || [];
      if (squadResponse.length === 0) continue;

      const players: any[] = squadResponse[0]?.players || [];
      if (players.length === 0) continue;

      const rows = players.map((p: any) => ({
        team_id:     teamId,
        team_name:   teamName,
        player_id:   p.id,
        player_name: p.name,
        position:    p.position ?? null,
        number:      p.number   ?? null,
      }));

      const { error } = await supabaseAdmin
        .from('team_players')
        .upsert(rows, { onConflict: 'team_id,player_id' });

      if (!error) totalInserted += rows.length;
    }

    return NextResponse.json({
      success: true,
      teams:   teams.length,
      skipped: totalSkipped,
      players: totalInserted,
      apiCalls,
      message: `✅ تم حفظ ${totalInserted} لاعب من ${teams.length - totalSkipped} فريق جديد`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
