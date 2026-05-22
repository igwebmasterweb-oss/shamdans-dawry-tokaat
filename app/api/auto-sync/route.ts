import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  // ✅ Vercel Cron Security — يمنع أي حد يستدعي الـ route يدوياً
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const log: string[] = [];

    // ① جيب الماتشات اللي:
    //    - مش عندها نتيجة في DB (actual_home_score IS NULL)
    //    - وقت انتهائها المتوقع فات (match_date + 115 دقيقة)
    const cutoff = new Date(now.getTime() - 115 * 60 * 1000).toISOString();

    const { data: pendingFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id, home_team, away_team')
      .is('actual_home_score', null)
      .lt('match_date', cutoff);

    if (!pendingFixtures || pendingFixtures.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد ماتشات تحتاج مزامنة', apiCalls: 0 });
    }

    log.push(`🔍 وجدنا ${pendingFixtures.length} ماتش محتاج مزامنة`);

    let syncedCount = 0;
    let apiCalls = 0;

    for (const fixture of pendingFixtures) {
      const apiId = fixture.api_fixture_id;

      // ② تحقق من حالة الماتش في API
      await sleep(300);
      const fixtureData = await apiFetch(`/fixtures?id=${apiId}`);
      apiCalls++;

      const match = fixtureData.response?.[0];
      if (!match) continue;

      const status = match.fixture.status.short;
      const isFinished = ['FT', 'AET', 'PEN'].includes(status);

      if (!isFinished) {
        log.push(`⏳ ${fixture.home_team} × ${fixture.away_team} — لسه ما خلصش (${status})`);
        continue;
      }

      // ③ الماتش خلص — جيب events + lineups
      const goalsHome = match.goals?.home ?? null;
      const goalsAway = match.goals?.away ?? null;
      const wentExtraTime   = status === 'AET' || status === 'PEN';
      const bothTeamsScored = goalsHome !== null && goalsAway !== null
        ? goalsHome > 0 && goalsAway > 0 : false;

      let redCard = false, penalty = false;
      let firstScorer: string | null = null;

      await sleep(300);
      const evData = await apiFetch(`/fixtures/events?fixture=${apiId}`);
      apiCalls++;

      for (const ev of evData.response || []) {
        if (ev.type === 'Card' && ev.detail === 'Red Card')   redCard   = true;
        if (ev.type === 'Goal' && ev.detail === 'Penalty')    penalty   = true;
        if (!firstScorer && ev.type === 'Goal' && ev.detail !== 'Own Goal') {
          firstScorer = ev.player?.name ?? null;
        }
      }

      // ④ احفظ في Supabase
      await supabaseAdmin.from('fixtures').update({
        actual_home_score: goalsHome,
        actual_away_score: goalsAway,
        first_scorer:      firstScorer,
        went_extra_time:   wentExtraTime,
        both_teams_scored: bothTeamsScored,
        red_card_in_match: redCard,
        penalty_in_match:  penalty,
      }).eq('api_fixture_id', apiId);

      log.push(`✅ ${fixture.home_team} ${goalsHome} - ${goalsAway} ${fixture.away_team}`);
      syncedCount++;
    }

    // ⑤ لو في ماتشات اتحفظت → شغّل update-results أوتو
    if (syncedCount > 0) {
      const updateRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/update-results`,
        { headers: { 'x-internal-key': process.env.CRON_SECRET || '' } }
      );
      const updateData = await updateRes.json();
      log.push(`⚡ تحديث النقاط: ${updateData.message || updateData.updated + ' توقع'}`);
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      apiCalls,
      log,
      timestamp: now.toISOString(),
    });

  } catch (err: any) {
    console.error('auto-sync error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
