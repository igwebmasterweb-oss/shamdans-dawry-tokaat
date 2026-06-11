import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date().toISOString();

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('api_fixture_id, match_date, home_team_name, away_team_name')
    .eq('is_open', true)
    .lte('match_date', cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({ closed: 0, message: 'لا توجد ماتشات للغلق' });
  }

  const ids = fixtures.map((f: any) => f.api_fixture_id);

  const { error: updateError } = await supabase
    .from('fixtures')
    .update({ is_open: false })
    .in('api_fixture_id', ids);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    closed: ids.length,
    matches: fixtures.map((f: any) => `${f.home_team_name} × ${f.away_team_name}`),
    message: `✅ تم غلق ${ids.length} ماتش تلقائياً مع بداية وقت المباراة`,
  });
}
