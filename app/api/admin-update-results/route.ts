import { NextResponse, NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';

export async function POST(request: NextRequest) {
  try {
    // ✅ تحقق من Supabase session — نفس الطريقة المستخدمة في admin/page.tsx
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    // لو مفيش session أو الإيميل مش الأدمن → ارفض
    if (!session || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ استدعاء update-results من server-side بالـ CRON_SECRET
    // الـ secret يبقى في server فقط، مش بيوصل للـ client أبداً
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/update-results`, {
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
