import { NextRequest, NextResponse } from 'next/server';

// نسبة فوز كل فريق في آخر 10 مواجهات مباشرة بينهما
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const home = searchParams.get('home');
    const away = searchParams.get('away');

    if (!home || !away) {
      return NextResponse.json(
        { home_wins: 0, away_wins: 0, draws: 0, total: 0, home_pct: 0, draw_pct: 0, away_pct: 0, error: 'missing team ids' },
        { status: 200 }
      );
    }

    const API_KEY = process.env.FOOTBALL_API_KEY || '';

    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${home}-${away}&last=10`,
      {
        headers: { 'x-apisports-key': API_KEY },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { home_wins: 0, away_wins: 0, draws: 0, total: 0, home_pct: 0, draw_pct: 0, away_pct: 0, error: 'API request failed' },
        { status: 200 }
      );
    }

    const data = await res.json();
    const matches: any[] = Array.isArray(data?.response) ? data.response : [];

    const homeId = Number(home);
    const awayId = Number(away);

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    for (const m of matches) {
      const gh = m?.goals?.home;
      const ga = m?.goals?.away;
      // نتجاهل المواجهات اللي لسه ما اتلعبتش
      if (gh === null || ga === null || gh === undefined || ga === undefined) continue;

      const fixtureHomeId = Number(m?.teams?.home?.id);
      const fixtureAwayId = Number(m?.teams?.away?.id);

      let winnerTeamId: number | null = null;
      if (gh > ga) winnerTeamId = fixtureHomeId;
      else if (ga > gh) winnerTeamId = fixtureAwayId;
      // مساواة => تعادل

      if (winnerTeamId === null) {
        draws++;
      } else if (winnerTeamId === homeId) {
        homeWins++;
      } else if (winnerTeamId === awayId) {
        awayWins++;
      } else {
        // احتياط: لو الـ ids مش متطابقة استخدم الـ winner boolean
        const hw = m?.teams?.home?.winner;
        const aw = m?.teams?.away?.winner;
        if (hw === true) { fixtureHomeId === homeId ? homeWins++ : awayWins++; }
        else if (aw === true) { fixtureAwayId === awayId ? awayWins++ : homeWins++; }
        else draws++;
      }
    }

    const total = homeWins + awayWins + draws;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return NextResponse.json({
      home_wins: homeWins,
      away_wins: awayWins,
      draws,
      total,
      home_pct: pct(homeWins),
      draw_pct: pct(draws),
      away_pct: pct(awayWins),
    });
  } catch (error: any) {
    return NextResponse.json(
      { home_wins: 0, away_wins: 0, draws: 0, total: 0, home_pct: 0, draw_pct: 0, away_pct: 0, error: error.message },
      { status: 200 }
    );
  }
}
