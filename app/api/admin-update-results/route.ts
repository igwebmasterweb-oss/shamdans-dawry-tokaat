import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';

export async function POST(request: NextRequest) {
  try {
    // تحقق من Authorization header — Bearer token من الـ client
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // تحقق من الـ token مع Supabase باستخدام service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // استدعاء update-results من server-side بالـ CRON_SECRET
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const res = await fetch(`${baseUrl}/api/update-results`, {
      method: 'GET',
      headers: {
        'x-internal-key': process.env.CRON_SECRET || '',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
