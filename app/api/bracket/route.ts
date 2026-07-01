import { NextResponse } from 'next/server';

/**
 * /api/bracket
 * يجيب أدوار الإقصاء (Round of 32 → النهائي) لحظيًا من API-Football
 * ويرجّع بنية منظّمة: لكل دور قائمة مباريات فيها الفريقين + الشعارات + النتيجة + الفائز.
 * الواجهة بتبني شجرة ثابتة (يمين/شمال/نص) وتملّي الخانات بالفرق المتأهلة،
 * والأدوار اللي لسه ماتلعبتش تظهر TBD (؟).
 */

const KO_ROUNDS = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final',
  '3rd Place Final',
] as const;

type Team = {
  id: number | null;
  name: string | null;
  logo: string | null;
};

type BracketMatch = {
  fixtureId: number;
  date: string;
  status: string;      // FT / AET / PEN / NS ...
  finished: boolean;
  home: Team;
  away: Team;
  homeScore: number | null;
  awayScore: number | null;
  wentPenalty: boolean;
  winner: 'home' | 'away' | null;
};

function isFinished(short: string): boolean {
  return short === 'FT' || short === 'AET' || short === 'PEN';
}

export async function GET() {
  try {
    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON    || '2026';
    const API_KEY   = process.env.FOOTBALL_API_KEY      || '';

    if (!API_KEY) {
      return NextResponse.json({ rounds: {}, error: 'missing api key' }, { status: 200 });
    }

    // نجيب كل الأدوار بالتوازي
    const results = await Promise.all(
      KO_ROUNDS.map(async (round) => {
        try {
          const res = await fetch(
            `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=${encodeURIComponent(round)}`,
            {
              headers: { 'x-apisports-key': API_KEY },
              next: { revalidate: 120 },
            }
          );
          if (!res.ok) return { round, matches: [] as BracketMatch[] };
          const data = await res.json();
          const list = Array.isArray(data?.response) ? data.response : [];

          const matches: BracketMatch[] = list
            .map((f: any): BracketMatch => {
              const short: string = f?.fixture?.status?.short || 'NS';
              const finished = isFinished(short);
              const hg = f?.goals?.home;
              const ag = f?.goals?.away;
              const wentPenalty = short === 'PEN';

              // تحديد الفائز: لو فيه winner من الـAPI نستخدمه، غير كده من النتيجة
              let winner: 'home' | 'away' | null = null;
              if (f?.teams?.home?.winner === true) winner = 'home';
              else if (f?.teams?.away?.winner === true) winner = 'away';
              else if (finished && typeof hg === 'number' && typeof ag === 'number') {
                if (hg > ag) winner = 'home';
                else if (ag > hg) winner = 'away';
                // التعادل بدون winner (ضربات جزاء) نسيبه null لو الـAPI ماحددش
              }

              return {
                fixtureId: f?.fixture?.id,
                date: f?.fixture?.date || '',
                status: short,
                finished,
                home: {
                  id: f?.teams?.home?.id ?? null,
                  name: f?.teams?.home?.name ?? null,
                  logo: f?.teams?.home?.logo ?? null,
                },
                away: {
                  id: f?.teams?.away?.id ?? null,
                  name: f?.teams?.away?.name ?? null,
                  logo: f?.teams?.away?.logo ?? null,
                },
                homeScore: typeof hg === 'number' ? hg : null,
                awayScore: typeof ag === 'number' ? ag : null,
                wentPenalty,
                winner,
              };
            })
            .sort((a: BracketMatch, b: BracketMatch) => a.date.localeCompare(b.date));

          return { round, matches };
        } catch {
          return { round, matches: [] as BracketMatch[] };
        }
      })
    );

    const rounds: Record<string, BracketMatch[]> = {};
    for (const r of results) rounds[r.round] = r.matches;

    return NextResponse.json({ rounds }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ rounds: {}, error: error?.message || 'error' }, { status: 200 });
  }
}
