// app/api/snapshot-history/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function runSnapshot() {
  const isoDate = new Date().toISOString().slice(0, 10);

  const { data: existing, error: existingErr } = await supabase
    .from('historical_rankings')
    .select('id')
    .eq('week_start', isoDate)
    .limit(1);

  if (existingErr) {
    console.error('Error checking existing snapshot:', existingErr);
    return NextResponse.json({ error: 'check_failed' }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { status: 'already_exists', date: isoDate },
      { status: 200 }
    );
  }

  const { data: pointsRows, error: pointsErr } = await supabase
    .from('user_points')
    .select('user_id, total_points')
    .order('total_points', { ascending: false });

  if (pointsErr) {
    console.error('Error fetching user_points:', pointsErr);
    return NextResponse.json({ error: 'points_failed' }, { status: 500 });
  }

  if (!pointsRows || pointsRows.length === 0) {
    return NextResponse.json(
      { status: 'no_users', date: isoDate },
      { status: 200 }
    );
  }

  const rowsToInsert = pointsRows.map((row, index) => ({
    user_id: row.user_id,
    rank_week: index + 1,
    week_start: isoDate,
    total_points: row.total_points ?? 0,
  }));

  const { error: insertErr } = await supabase
    .from('historical_rankings')
    .insert(rowsToInsert);

  if (insertErr) {
    console.error('Error inserting snapshot:', insertErr);
    return NextResponse.json(
      {
        error: 'insert_failed',
        details: insertErr.message,
        code: insertErr.code,
        hint: insertErr.hint,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      date: isoDate,
      count: rowsToInsert.length,
    },
    { status: 200 }
  );
}

export async function GET() {
  return runSnapshot();
}

export async function POST() {
  return runSnapshot();
}
