import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — اشتراك جديد
export async function POST(req: Request) {
  const body = await req.json();
  const { user_id, subscription } = body;

  if (!user_id || !subscription) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id,
    endpoint: subscription.endpoint,
    p256dh:   subscription.keys.p256dh,
    auth:     subscription.keys.auth,
  }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — إلغاء الاشتراك
export async function DELETE(req: Request) {
  const { user_id, endpoint } = await req.json();

  if (!user_id || !endpoint) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', user_id)
    .eq('endpoint', endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}