import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // حماية الـ cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in5Hours    = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const in5Hours10  = new Date(now.getTime() + 5 * 60 * 60 * 1000 + 10 * 60 * 1000);

  // جيب الماتشات اللي بعد 5 ساعات بالظبط (± 5 دقايق)
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_fixture_id, home_team_name, away_team_name, match_date')
    .gte('match_date', in5Hours.toISOString())
    .lte('match_date', in5Hours10.toISOString())
    .eq('is_open', true);

  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({ sent: 0, message: 'لا توجد مباريات خلال 5 ساعات' });
  }

  // نص الرسالة
  const matchList = fixtures
    .map((f: any) => `${f.home_team_name} 🆚 ${f.away_team_name}`)
    .join('\n');

  // جيب كل المشتركين
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'لا يوجد مشتركين' });
  }

  const payload = JSON.stringify({
    title: '⚽ تذكير بالتوقعات!',
    body:  `${matchList}\nبعد 5 ساعات — توقع الآن!`,
    url:   '/dashboard',
  });

  let sent = 0;
  const expired: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.endpoint);
        }
      }
    })
  );

  // احذف الـ subscriptions المنتهية تلقائياً
  if (expired.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expired);
  }

  return NextResponse.json({ sent, expired: expired.length, matches: fixtures.length });
}
