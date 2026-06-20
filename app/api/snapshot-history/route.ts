import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const day = now.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - diffToMonday);
    const isoDate = monday.toISOString().slice(0, 10);

    const { data: pointsRows, error: pointsErr } = await supabase
      .from('historical_rankings_source_v1')
      .select('user_id, final_points, base_points, penalty_points')
      .order('final_points', { ascending: false })
      .order('base_points', { ascending: false })
      .limit(25);

    if (pointsErr) {
      console.error('Error fetching historical_rankings_source_v1:', pointsErr);
      return NextResponse.json({ error: 'points_failed' }, { status: 500 });
    }

    const { error: delErr } = await supabase
      .from('historical_rankings')
      .delete()
      .eq('week_start', isoDate);

    if (delErr) {
      console.error('Error clearing existing week rows:', delErr);
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }

    const rowsToInsert = (pointsRows || []).map((row, index) => ({
      user_id: row.user_id,
      rank_week: index + 1,
      week_start: isoDate,
      total_points: row.final_points ?? 0,
    }));

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('historical_rankings')
        .insert(rowsToInsert);

      if (insertErr) {
        console.error('Error inserting historical rankings:', insertErr);
        return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, week_start: isoDate, inserted: rowsToInsert.length });
  } catch (error) {
    console.error('snapshot-history route error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
