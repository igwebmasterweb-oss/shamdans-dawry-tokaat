// app/api/snapshot-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function POST(req: NextRequest) {
  try {
    // 1) نحدد تاريخ اليوم بشكل YYYY-MM-DD
    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10); // مثال: 2026-06-13

    // 2) نتأكد مفيش Snapshot لنفس اليوم
    const { data: existing, error: existingErr } = await supabase
      .from('historical_rankings')
      .select('id')
      .eq('week_start', isoDate)
      .limit(1);

    if (existingErr) {
      console.error('Error checking existing snapshot:', existingErr);
      return NextResponse.json(
        { error: 'check_failed' },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      // بالفعل في Snapshot لهذا اليوم
      return NextResponse.json(
        { status: 'already_exists', date: isoDate },
        { status: 200 }
      );
    }

    // 3) نجيب ترتيب اللاعبين الحالي من user_points
    const { data: pointsRows, error: pointsErr } = await supabase
      .from('user_points')
      .select('user_id, total_points, referral_count')
      .order('total_points', { ascending: false });

    if (pointsErr) {
      console.error('Error fetching user_points:', pointsErr);
      return NextResponse.json(
        { error: 'points_failed' },
        { status: 500 }
      );
    }

    if (!pointsRows || pointsRows.length === 0) {
      return NextResponse.json(
        { status: 'no_users', date: isoDate },
        { status: 200 }
      );
    }

    // 4) نبني صفوف الـ snapshot مع rank
    const rowsToInsert = pointsRows.map((row, index) => ({
      user_id: row.user_id,
      total_points: row.total_points ?? 0,
      referral_count: row.referral_count ?? 0,
      // نستخدم week_start كأنه snapshot_date يومية
      week_start: isoDate,
      rank: index + 1,
    }));

    const { error: insertErr } = await supabase
      .from('historical_rankings')
      .insert(rowsToInsert);

    if (insertErr) {
      console.error('Error inserting snapshot:', insertErr);
      return NextResponse.json(
        { error: 'insert_failed' },
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
  } catch (err) {
    console.error('Unexpected snapshot error:', err);
    return NextResponse.json(
      { error: 'unexpected' },
      { status: 500 }
    );
  }
}
