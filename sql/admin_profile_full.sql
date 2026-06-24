-- ════════════════════════════════════════════════════════════════
-- دالة آمنة: ترجع بيانات بروفايل عضو كاملة للأدمن فقط
-- السبب: الإيميل الحقيقي موجود في auth.users (8870 عضو) وليس في
--        user_points (790 فقط). التليفون/الفيسبوك في جدول profiles.
-- الأمان: SECURITY DEFINER + تحقق أن المستدعي أدمن عبر إيميل الـ JWT.
-- ════════════════════════════════════════════════════════════════

create or replace function public.admin_profile_full(p_user_id uuid)
returns table (
  user_id        uuid,
  email          text,
  full_name      text,
  phone          text,
  facebook_url   text,
  facebook_id    text,
  football_team  text,
  date_of_birth  date,
  referral_code  text,
  avatar_url     text,
  created_at     timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_email text;
begin
  -- إيميل المستدعي من توكن الجلسة
  v_caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  -- تحقق أن المستدعي أدمن (نفس قائمة ADMIN_EMAILS في الواجهة)
  if v_caller_email <> 'i.g.webmaster.web@gmail.com' then
    raise exception 'غير مصرح: للأدمن فقط';
  end if;

  return query
  select
    p.id                                   as user_id,
    coalesce(au.email, up.user_email)::text as email,       -- الإيميل من auth أولاً (cast لأن auth.users.email نوعه varchar)
    coalesce(p.full_name, up.full_name)    as full_name,
    p.phone                                as phone,
    p.facebook_url                         as facebook_url,
    p.facebook_id                          as facebook_id,
    p.football_team                        as football_team,
    p.date_of_birth                        as date_of_birth,
    p.referral_code                        as referral_code,
    p.avatar_url                           as avatar_url,
    p.created_at                           as created_at
  from profiles p
  left join auth.users  au on au.id = p.id
  left join user_points up on up.user_id = p.id
  where p.id = p_user_id;
end;
$$;

-- صلاحية التنفيذ للمستخدمين المسجّلين (التحقق من الأدمن داخل الدالة)
grant execute on function public.admin_profile_full(uuid) to authenticated;
