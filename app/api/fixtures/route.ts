import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1';
    const SEASON    = process.env.NEXT_PUBLIC_SEASON    || '2026';
    const API_KEY   = process.env.FOOTBALL_API_KEY      || '';

    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}`,
      {
        headers: { 'x-apisports-key': API_KEY },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ response: [], error: 'API request failed' }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ response: [], error: error.message }, { status: 200 });
  }
}
