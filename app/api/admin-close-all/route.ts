import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { fixtureIds, is_open } = await request.json();
  
  const { error } = await supabase
    .from('fixtures')
    .update({ is_open })
    .in('api_fixture_id', fixtureIds);

  if (error) return NextResponse.json({ success: false, error: error.message });
  return NextResponse.json({ success: true });
}
