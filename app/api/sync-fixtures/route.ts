import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ service role يتجاوز RLS
);

export async function GET() {
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! } }
    );
    const data = await res.json();
    const allMatches = data.response || [];

    // جيب الموجود عشان نعرف كام جديد
    const { data: existing } = await supabase
      .from('fixtures')
      .select('api_fixture_id');

    const existingIds = new Set(existing?.map(f => f.api_fixture_id) || []);

    const newMatches = allMatches.filter((m: any) => !existingIds.has(m.fixture.id));

    if (newMatches.length === 0) {
      return NextResponse.json({ success: true, count: allMatches.length, added: 0 });
    }

    const upsertData = newMatches.map((m: any) => ({
      api_fixture_id: m.fixture.id,
      is_open: false,
    }));

    const { error } = await supabase
      .from('fixtures')
      .insert(upsertData); // insert فقط للجديد

    if (error) return NextResponse.json({ success: false, error: error.message });

    return NextResponse.json({ success: true, count: allMatches.length, added: newMatches.length });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  }
}
