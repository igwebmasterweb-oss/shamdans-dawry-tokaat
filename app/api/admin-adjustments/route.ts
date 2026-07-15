import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// تحقق من أن المستدعي أدمن فعلاً (server-side) — عبر توكن جلسة الأدمن
async function assertAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('غير مصرح: token مفقود');
  const { data, error } = await supabaseAdmin.rpc('verify_admin_token', { p_token: token });
  if (error || !data) throw new Error('غير مصرح: جلسة الأدمن غير صالحة');
}

// ── إدارة البونص والخصومات من لوحة الادمن ──
// كل العمليات بـ service-role (تتخطى RLS) + إعادة حساب نقاط العضو بعد كل تعديل.
// bonus_grants هو مصدر الحقيقة للبونص. user_penalty_notices جدول الخصومات.

async function refresh(userId: string) {
  const { error } = await supabaseAdmin.rpc('refreshuserpoints', { p_userid: userId });
  if (error) throw new Error('refresh فشل: ' + error.message);
}

// يجيب user_id من الإيميل عبر جدول profiles (الإيميل مخزّن lowercase)
async function lookupUserId(email: string): Promise<{ user_id: string; full_name: string | null; phone: string | null }> {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) throw new Error('الإيميل مطلوب');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone')
    .eq('email', clean)
    .maybeSingle();
  if (error) throw new Error('بحث الإيميل فشل: ' + error.message);
  if (!data) throw new Error('مفيش عضو بالإيميل ده: ' + clean);
  return { user_id: data.id, full_name: data.full_name ?? null, phone: data.phone ?? null };
}

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req);
    const body = await req.json();
    const action = String(body?.action || '');

    switch (action) {
      // ─────────── البونص ───────────
      case 'bonus_add': {
        const points = Number(body?.bonus_points);
        const source = String(body?.source || '').trim();
        if (!Number.isFinite(points) || points === 0) throw new Error('عدد نقاط البونص لازم يكون رقم غير صفر');
        if (!source) throw new Error('سبب/مصدر البونص مطلوب');

        let userId: string | null = body?.user_id ? String(body.user_id) : null;
        let email = String(body?.email || '').trim().toLowerCase();
        let fullName = body?.full_name ?? null;
        let phone = body?.phone ?? null;

        // لو مفيش user_id، دوّر بالإيميل
        if (!userId) {
          const info = await lookupUserId(email);
          userId = info.user_id;
          fullName = fullName ?? info.full_name;
          phone = phone ?? info.phone;
        }
        // لو عندنا user_id بس مفيش إيميل، هاته من البروفايل (email NOT NULL في bonus_grants)
        if (!email) {
          const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name, phone').eq('id', userId).maybeSingle();
          email = String(prof?.email || '').trim().toLowerCase();
          fullName = fullName ?? prof?.full_name ?? null;
          phone = phone ?? prof?.phone ?? null;
        }
        if (!email) throw new Error('مقدرناش نجيب إيميل العضو');

        const { data, error } = await supabaseAdmin
          .from('bonus_grants')
          .insert({ user_id: userId, email, full_name: fullName, phone, bonus_points: points, source, notes: body?.notes ?? null })
          .select()
          .single();
        if (error) throw new Error('إضافة البونص فشلت: ' + error.message);
        await refresh(userId!);
        return NextResponse.json({ success: true, grant: data });
      }

      case 'bonus_edit': {
        const id = body?.id;
        const points = Number(body?.bonus_points);
        if (!id) throw new Error('id المنحة مطلوب');
        if (!Number.isFinite(points)) throw new Error('عدد النقاط لازم يكون رقم');

        const patch: Record<string, any> = { bonus_points: points };
        if (typeof body?.source === 'string' && body.source.trim()) patch.source = body.source.trim();
        if (body?.notes !== undefined) patch.notes = body.notes;

        const { data, error } = await supabaseAdmin
          .from('bonus_grants').update(patch).eq('id', id).select().single();
        if (error) throw new Error('تعديل البونص فشل: ' + error.message);
        if (data?.user_id) await refresh(data.user_id);
        return NextResponse.json({ success: true, grant: data });
      }

      case 'bonus_delete': {
        const id = body?.id;
        if (!id) throw new Error('id المنحة مطلوب');
        // نجيب user_id الأول عشان نعمل refresh بعد الحذف
        const { data: row } = await supabaseAdmin.from('bonus_grants').select('user_id').eq('id', id).maybeSingle();
        const { error } = await supabaseAdmin.from('bonus_grants').delete().eq('id', id);
        if (error) throw new Error('حذف البونص فشل: ' + error.message);
        if (row?.user_id) await refresh(row.user_id);
        return NextResponse.json({ success: true });
      }

      // ─────────── الخصومات ───────────
      case 'penalty_add': {
        const points = Number(body?.penalty_points);
        const message = String(body?.message || '').trim();
        if (!Number.isFinite(points) || points <= 0) throw new Error('عدد نقاط الخصم لازم يكون رقم موجب');
        if (!message) throw new Error('سبب/رسالة الخصم مطلوبة');

        let userId: string | null = body?.user_id ? String(body.user_id) : null;
        if (!userId) {
          const info = await lookupUserId(String(body?.email || ''));
          userId = info.user_id;
        }

        const { data, error } = await supabaseAdmin
          .from('user_penalty_notices')
          .insert({
            user_id: userId,
            penalty_points: points,
            message,
            status: body?.status ? String(body.status) : 'confirmed',
            is_active: body?.is_active === undefined ? true : !!body.is_active,
            source: body?.source ?? 'admin_manual',
          })
          .select().single();
        if (error) throw new Error('إضافة الخصم فشلت: ' + error.message);
        await refresh(userId!);
        return NextResponse.json({ success: true, penalty: data });
      }

      case 'penalty_edit': {
        const id = body?.id;
        if (!id) throw new Error('id الخصم مطلوب');
        const patch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body?.penalty_points !== undefined) {
          const p = Number(body.penalty_points);
          if (!Number.isFinite(p) || p < 0) throw new Error('عدد نقاط الخصم لازم يكون رقم غير سالب');
          patch.penalty_points = p;
        }
        if (typeof body?.message === 'string' && body.message.trim()) patch.message = body.message.trim();
        if (typeof body?.status === 'string' && body.status.trim()) patch.status = body.status.trim();
        if (body?.is_active !== undefined) patch.is_active = !!body.is_active;

        const { data, error } = await supabaseAdmin
          .from('user_penalty_notices').update(patch).eq('id', id).select().single();
        if (error) throw new Error('تعديل الخصم فشل: ' + error.message);
        if (data?.user_id) await refresh(data.user_id);
        return NextResponse.json({ success: true, penalty: data });
      }

      case 'penalty_delete': {
        const id = body?.id;
        if (!id) throw new Error('id الخصم مطلوب');
        const { data: row } = await supabaseAdmin.from('user_penalty_notices').select('user_id').eq('id', id).maybeSingle();
        const { error } = await supabaseAdmin.from('user_penalty_notices').delete().eq('id', id);
        if (error) throw new Error('حذف الخصم فشل: ' + error.message);
        if (row?.user_id) await refresh(row.user_id);
        return NextResponse.json({ success: true });
      }

      // ─────────── الليجات ───────────
      case 'league_delete': {
        const leagueId = String(body?.league_id || '');
        if (!leagueId) throw new Error('id الليج مطلوب');
        await supabaseAdmin.from('mini_league_invitations').delete().eq('league_id', leagueId);
        await supabaseAdmin.from('mini_league_members').delete().eq('league_id', leagueId);
        const { error } = await supabaseAdmin.from('mini_leagues').delete().eq('id', leagueId);
        if (error) throw new Error('حذف الليج فشل: ' + error.message);
        return NextResponse.json({ success: true });
      }

      case 'league_member_remove': {
        const leagueId = String(body?.league_id || '');
        const userId = String(body?.user_id || '');
        if (!leagueId || !userId) throw new Error('id الليج والعضو مطلوبين');
        const { error } = await supabaseAdmin.from('mini_league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
        if (error) throw new Error('إزالة العضو فشلت: ' + error.message);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'action غير معروف: ' + action }, { status: 400 });
    }
  } catch (error: any) {
    const msg = error?.message || String(error);
    const status = msg.startsWith('غير مصرح') ? 401 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
