import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
      headers: {
        'x-apisports-key': process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || '',
      },
      next: { revalidate: 3600 },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API-Football Error:', error);
    return NextResponse.json({ response: [] });
  }
}