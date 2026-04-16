import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      console.error('❌ API_FOOTBALL_KEY مش موجود في Environment Variables');
      return NextResponse.json({ response: [] });
    }

    const response = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        headers: {
          'x-apisports-key': apiKey,
        },
        next: { revalidate: 300 },   // كاش 5 دقايق
      }
    );

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      return NextResponse.json({ response: [] });
    }

    const data = await response.json();
    console.log('✅ API-Football returned:', data.response?.length || 0, 'matches');

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ API-Football Error:', error);
    return NextResponse.json({ response: [] });
  }
}
