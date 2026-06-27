import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// دالة sleep بسيطة لتأخير بين طلبات الـ API (لتجنب الـ rate limit)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// دالة طلب من API Sports مع إمكانية إعادة المحاولة مرة واحدة
async function apiFetch(path: string, attempt: number = 1): Promise<any> {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY || '' },
  });

  // لو الرد مش 2xx
  if (!res.ok) {
    // محاولة ثانية أخيرة لو دي أول محاولة
    if (attempt === 1 && res.status >= 500) {
      await sleep(300);
      return apiFetch(path, 2);
    }
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// توحيد اسم الهداف (إزالة المسافات الزائدة فقط)
function normalizeScorerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// استدعاء update-results لمباراة واحدة محددة بالـ fixture id فقط، مع إعادة المحاولة.
// مهم: دايمًا موجّه بـ ?fixture=apiId ولا يمسّ القاعدة كلها إطلاقًا — الحِمل محصور بمباراة واحدة.
async function calcMatchPointsWithRetry(
  apiId: number,
  maxAttempts: number = 3
): Promise<{ ok: boolean; message?: string; error?: string; attempts: number }> {
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // فاصل تصاعدي بين المحاولات (1ث، 2ث، 3ث...) لتفادي ضغط لحظي
      await sleep(1000 * attempt);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/update-results?fixture=${apiId}`,
        {
          // الهيدر ده مش مطلوب حاليًا لـ update-results بعد فتحه،
          // بس مش مضر ونسيبه لو حبيت ترجّع حماية داخلية فيما بعد.
          headers: { 'x-internal-key': process.env.CRON_SECRET || '' },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        return {
          ok: true,
          message: data.message || `${data.updated ?? 0} توقع`,
          attempts: attempt,
        };
      }

      // فشل منطقي (رد غير ناجح) — نسجّل السبب ونعيد المحاولة لو فيه محاولات متبقية
      lastError = data?.error || res.statusText || `HTTP ${res.status}`;
    } catch (err: any) {
      // فشل شبكي/تايم آوت — نعيد المحاولة لنفس المباراة فقط
      lastError = err?.message || String(err);
    }
  }

  return { ok: false, error: lastError, attempts: maxAttempts };
}

export async function GET(request: Request) {
  // حماية الكرون: لازم Authorization: Bearer CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const log: string[] = [];

    // ملاحظة مهمة:
    // الـ cutoff هنا مجرد فلتر لتقليل عدد الماتشات المرشحة، مش هو اللي بيحدد إن الماتش خلص.
    // الحسم الحقيقي بيتم من status (FT / AET / PEN).
    //
    // هنا اخترنا match_date < now (أي ماتش وقته فات)،
    // ولو حابب نقلل أكتر ممكن نخليها now - 15 دقيقة مثلاً.
    const cutoff = now.toISOString();

    // نجيب الماتشات اللي لسه مفيش لها نتيجة محفوظة في DB
    // actual_home_score IS NULL = لم يتم مزامنة النتيجة بعد
    // match_date < cutoff       = وقت الماتش بدأ بالفعل
    const { data: pendingFixtures, error: pendingError } = await supabaseAdmin
      .from('fixtures')
      .select('api_fixture_id, home_team_name, away_team_name, match_date')
      .is('actual_home_score', null)
      .lt('match_date', cutoff);

    if (pendingError) throw pendingError;

    if (!pendingFixtures || pendingFixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد ماتشات تحتاج مزامنة',
        apiCalls: 0,
        synced: 0,
        log,
        timestamp: now.toISOString(),
      });
    }

    log.push(`🔍 وجدنا ${pendingFixtures.length} ماتش محتاج مزامنة`);

    let syncedCount = 0;
    let apiCalls = 0;
    const syncedFixtureIds: number[] = [];

    // نلف على كل ماتش بشكل مستقل
    for (const fixture of pendingFixtures) {
      const apiId = fixture.api_fixture_id;

      // نعزل أي خطأ في ماتش واحد داخل try/catch عشان ما يبوّظش الدورة كلها
      try {
        // نريح شوية قبل الطلب لتقليل ضغط الـ API
        await sleep(300);
        const fixtureData = await apiFetch(`/fixtures?id=${apiId}`);
        apiCalls++;

        const match = fixtureData.response?.[0];
        if (!match) {
          log.push(`⚠️ لم نجد بيانات API للمباراة ${apiId}`);
          continue;
        }

        const status = match.fixture?.status?.short as string | undefined;

        // الحسم الحقيقي: الماتش يعتبر منتهٍ فقط لو الحالة واحدة من دول
        const isFinished = status ? ['FT', 'AET', 'PEN'].includes(status) : false;

        if (!isFinished) {
          log.push(
            `⏳ ${fixture.home_team_name} × ${fixture.away_team_name} — لسه ما خلصش (status: ${status || 'unknown'})`
          );
          continue;
        }

        const goalsHome = match.goals?.home ?? null;
        const goalsAway = match.goals?.away ?? null;
        const wentExtraTime = status === 'AET' || status === 'PEN';
        const bothTeamsScored =
          goalsHome !== null && goalsAway !== null
            ? goalsHome > 0 && goalsAway > 0
            : false;

        let redCard = false;
        let penalty = false;
        let firstScorer: string | null = null;
        let firstScorerId: number | null = null;
        const allScorers: string[] = [];
        const scorersIdsJson: number[] = [];

        // نجيب أحداث الماتش (أهداف، كروت... إلخ) مع retry
        await sleep(300);
        const evData = await apiFetch(`/fixtures/events?fixture=${apiId}`);
        apiCalls++;

        for (const ev of evData.response || []) {
          if (ev.type === 'Card' && ev.detail === 'Red Card') {
            redCard = true;
          }

          // توحيد منطق اكتشاف الجزاء مع sync-fixtures:
          // يشمل الجزاء المُسجّل، الجزاء الضائع، وأحداث الـ VAR المتعلقة بالجزاء
          if (
            (ev.type === 'Goal' && (ev.detail === 'Penalty' || ev.detail === 'Missed Penalty')) ||
            (ev.type === 'Var' && typeof ev.detail === 'string' && ev.detail.toLowerCase().includes('penalty'))
          ) {
            penalty = true;
          }

          // ⚠️ ضربة الجزاء الضائعة بتيجي من الـ API كـ type='Goal' مع detail='Missed Penalty'
          //    — دي مش هدف فعلي، فلازم نستبعدها من أول هدّاف ومن قائمة الهدّافين.
          //    (نفس منطق sync-fixtures — لازم يفضلوا متطابقين.)
          const isMissedPenalty = ev.type === 'Goal' && ev.detail === 'Missed Penalty';

          if (ev.type === 'Goal' && ev.detail !== 'Own Goal' && !isMissedPenalty) {
            const scorerName = ev.player?.name
              ? normalizeScorerName(ev.player.name)
              : null;
            const scorerId = ev.player?.id !== null && ev.player?.id !== undefined
              ? Number(ev.player.id)
              : null;

            if (scorerName) {
              if (!firstScorer) firstScorer = scorerName;
              if (!allScorers.includes(scorerName)) {
                allScorers.push(scorerName);
              }
            }

            if (scorerId !== null && Number.isFinite(scorerId)) {
              if (firstScorerId === null) firstScorerId = scorerId;
              if (!scorersIdsJson.includes(scorerId)) {
                scorersIdsJson.push(scorerId);
              }
            }
          }
        }

        // نحدث الفيكستشر في قاعدة البيانات بالنتيجة النهائية
        const { error: updateFixtureError } = await supabaseAdmin
          .from('fixtures')
          .update({
            actual_home_score: goalsHome,
            actual_away_score: goalsAway,
            first_scorer: firstScorer,
            first_scorer_id: firstScorerId,
            scorers_json: allScorers,
            scorers_ids_json: scorersIdsJson,
            went_extra_time: wentExtraTime,
            both_teams_scored: bothTeamsScored,
            red_card_in_match: redCard,
            penalty_in_match: penalty,
          })
          .eq('api_fixture_id', apiId);

        if (updateFixtureError) throw updateFixtureError;

        log.push(
          `✅ ${fixture.home_team_name} ${goalsHome} - ${goalsAway} ${fixture.away_team_name} (status: ${status})`
        );
        syncedCount++;
        syncedFixtureIds.push(apiId);
      } catch (err: any) {
        // لو حصل خطأ في الماتش ده بس، نسجّله ونكمل باقي الماتشات
        log.push(
          `⚠️ خطأ أثناء مزامنة المباراة ${fixture.home_team_name} × ${fixture.away_team_name} (ID: ${apiId}): ${
            err?.message || String(err)
          }`
        );
        continue;
      }
    }

    // بعد ما نثبت نتائج الماتشات المنتهية، نحسب نقاط التوقعات لكل ماتش
    // كل مباراة موجّهة بالـ fixture id فقط، مع إعادة المحاولة عند الفشل (بدون أي نداء عام على القاعدة).
    const failedPointFixtures: number[] = [];
    if (syncedFixtureIds.length > 0) {
      for (const apiId of syncedFixtureIds) {
        const result = await calcMatchPointsWithRetry(apiId);

        if (result.ok) {
          log.push(`⚡ تحديث النقاط للمباراة ${apiId}: ${result.message}`);
        } else {
          // فشل بعد كل المحاولات — نسجّله بوضوح عشان يتعالج بنداء يدوي موجّه لنفس المباراة لاحقًا
          failedPointFixtures.push(apiId);
          log.push(
            `⚠️ فشل تحديث النقاط للمباراة ${apiId} بعد ${result.attempts} محاولات: ${result.error || 'سبب غير معروف'}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      apiCalls,
      pointsFailed: failedPointFixtures.length,
      pointsFailedFixtures: failedPointFixtures,
      log,
      timestamp: now.toISOString(),
    });
  } catch (err: any) {
    console.error('auto-sync error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
