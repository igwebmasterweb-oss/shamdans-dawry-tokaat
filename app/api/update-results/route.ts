import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY || '' },
        next: { revalidate: 60 },
      }
    );

    const apiData = await res.json();
    if (!apiData.response || apiData.response.length === 0) {
      return NextResponse.json({ message: 'لا توجد ماتشات' });
    }

    let updatedFixtures = 0;
    let updatedPredictions = 0;

    for (const match of apiData.response) {
      if (match.fixture.status.short !== 'FT') continue;

      const homeScore = match.goals.home;
      const awayScore = match.goals.away;
      if (homeScore === null || awayScore === null) continue;

      const fixtureId = match.fixture.id;

      // ✅ جيب أول هدف من API
      const firstScorerFromAPI = match.events
        ?.filter((e: any) => e.type === 'Goal' && e.detail !== 'Own Goal')
        ?.sort((a: any, b: any) => a.time.elapsed - b.time.elapsed)?.[0]
        ?.player?.name || null;

      // ✅ وقت إضافي من API
      const wentExtraTime =
        match.fixture.status.short === 'AET' ||
        match.fixture.status.short === 'PEN' ||
        (match.score?.extratime?.home !== null);

      // ✅ 1. حدّث fixtures
      const { error: fixtureError } = await supabase
        .from('fixtures')
        .update({
          actual_home_score: homeScore,
          actual_away_score: awayScore,
          is_open: false,
          first_scorer: firstScorerFromAPI,
          went_extra_time: wentExtraTime,
        })
        .eq('api_fixture_id', fixtureId)
        .is('actual_home_score', null);

      if (!fixtureError) updatedFixtures++;

      // ✅ 2. جيب بيانات الـ fixture من Supabase (لو الأدمن ضيف مفاجأة يدوياً)
      const { data: fixtureData } = await supabase
        .from('fixtures')
        .select('first_scorer, went_extra_time, surprise_answer')
        .eq('api_fixture_id', fixtureId)
        .single();

      const actualFirstScorer = fixtureData?.first_scorer || firstScorerFromAPI;
      const actualExtraTime = fixtureData?.went_extra_time ?? wentExtraTime;
      const actualSurprise = fixtureData?.surprise_answer || null;

      // ✅ 3. جيب كل التوقعات على الماتش
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('fixture_id', fixtureId)
        .is('actual_home_score', null);

      if (!predictions || predictions.length === 0) continue;

      // ✅ 4. احسب نقاط كل متوقع
      for (const pred of predictions) {
        let points = 0;
        const breakdown: string[] = [];

        const predHome = pred.predicted_home_score;
        const predAway = pred.predicted_away_score;

        // النتيجة الكاملة = 10 نقاط
        if (predHome === homeScore && predAway === awayScore) {
          points += 10;
          breakdown.push('نتيجة كاملة +10');
        } else {
          // الفريق الفايز صح = 5 نقاط
          const actualWinner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
          const predWinner = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
          if (actualWinner === predWinner) {
            points += 5;
            breakdown.push('فايز صح +5');
          }
        }

        // أول هدف = 3 نقاط
        if (
          actualFirstScorer &&
          pred.predicted_first_scorer &&
          pred.predicted_first_scorer !== 'غير محدد' &&
          actualFirstScorer.toLowerCase().includes(pred.predicted_first_scorer.toLowerCase())
        ) {
          points += 3;
          breakdown.push('أول هدف +3');
        }

        // وقت إضافي = 2 نقاط
        if (pred.predicted_extra_time === actualExtraTime) {
          points += 2;
          breakdown.push('وقت إضافي +2');
        }

        // مفاجأة الجولة = 5 نقاط (مطابقة نصية بسيطة)
        if (
          actualSurprise &&
          pred.surprise_answer &&
          pred.surprise_answer !== 'لا توجد مفاجأة' &&
          actualSurprise.toLowerCase().includes(pred.surprise_answer.toLowerCase())
        ) {
          points += 5;
          breakdown.push('مفاجأة +5');
        }

        // ✅ 5. حدّث التوقع
        await supabase
          .from('predictions')
          .update({
            actual_home_score: homeScore,
            actual_away_score: awayScore,
            points,
          })
          .eq('id', pred.id);

        updatedPredictions++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${updatedFixtures} ماتش و${updatedPredictions} توقع`,
      updatedFixtures,
      updatedPredictions,
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
