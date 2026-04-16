import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    console.log('API Key exists?', !!apiKey);   // للتشخيص

    if (!apiKey) {
      console.error('❌ API_FOOTBALL_KEY غير موجود في Vercel');
      return NextResponse.json({ response: [] });
    }

    const response = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
        next: { revalidate: 300 },
      }
    );

    const data = await response.json();

    console.log('API-Football Response:', {
      results: data.results,
      errors: data.errors
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ response: [] });
  }
}
