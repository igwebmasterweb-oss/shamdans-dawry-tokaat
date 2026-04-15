import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    // 1. نجيب كل الماتشات من API-Football
    const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY || '',
      },
      next: { revalidate: 60 }, // cache 60 ثانية
    });

    const apiData = await res.json();

    if (!apiData.response || apiData.response.length === 0) {
      return NextResponse.json({ message: 'لا توجد ماتشات' });
    }

    let updatedCount = 0;

    // 2. نلف على كل ماتش خلص
    for (const match of apiData.response) {
      if (match.fixture.status.short !== 'FT') continue; // فقط الماتشات المنتهية

      const homeScore = match.goals.home;
      const awayScore = match.goals.away;

      if (homeScore === null || awayScore === null) continue;

      // 3. نحدث كل التوقعات الخاصة بالماتش ده
      const { error } = await supabase
        .from('predictions')
        .update({
          actual_home_score: homeScore,
          actual_away_score: awayScore,
        })
        .eq('fixture_id', match.fixture.id)
        // مهم: لو النتيجة موجودة يدويًا، هنسيبها (مش هنمسحها)
        .is('actual_home_score', null);   // فقط لو لسة فاضية

      if (!error) updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `تم تحديث ${updatedCount} ماتش بنجاح من API-Football`,
      updated: updatedCount
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}