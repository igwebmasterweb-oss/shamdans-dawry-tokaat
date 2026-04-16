import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      console.error('❌ API_FOOTBALL_KEY غير موجود');
      return NextResponse.json({ response: [] });
    }

    const response = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        method: 'GET',                    // ← هذا السطر مهم جدًا
        headers: {
          'x-apisports-key': apiKey,
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.error('API Error:', response.status);
      return NextResponse.json({ response: [] });
    }

    const data = await response.json();
    console.log('✅ API returned', data.response?.length || 0, 'matches');

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Fetch error:', error);
    return NextResponse.json({ response: [] });
  }
}
