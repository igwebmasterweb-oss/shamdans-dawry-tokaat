-- ════════════════════════════════════════════════════════════════
-- حماية إدخال التوقعات بعد بدء الماتش (RLS Time Guard)
-- ════════════════════════════════════════════════════════════════
-- المشكلة: قفل الماتش (is_open=false) يتم عبر cron auto-close-matches
--          كل 15 دقيقة، فتوجد نافذة تصل لـ ~15 دقيقة بعد بداية الماتش
--          يبقى فيها is_open=true ويُسمح بالكتابة عبر استدعاء مباشر.
-- الحل:   إضافة فحص توقيت مباشر داخل الـ RLS (مستقل عن الـ cron):
--          now() < match_date - interval '1 minute'
--          → قاعدة البيانات نفسها ترفض أي كتابة قبل البداية بأقل من دقيقة.
-- هامش الأمان: دقيقة واحدة (متسق مع سياسة العرض predictions_select_resolved_or_10m).
-- ملاحظة: الأدمن يستخدم service-role الذي يتجاوز RLS، فلا يتأثر.
-- ════════════════════════════════════════════════════════════════

-- ① INSERT: لا توقع جديد إلا لماتش مفتوح + لم تُسجَّل نتيجته + لم يبدأ بعد
drop policy if exists predictions_insert_own_open_fixture on public.predictions;
create policy predictions_insert_own_open_fixture
  on public.predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fixtures f
      where f.api_fixture_id::bigint = predictions.fixture_id
        and coalesce(f.is_open, false) = true
        and f.actual_home_score is null
        and f.actual_away_score is null
        and now() < f.match_date - interval '1 minute'   -- فحص التوقيت المباشر
    )
  );

-- ② UPDATE: لا تعديل لتوقع بعد بداية الماتش (USING + WITH CHECK)
drop policy if exists predictions_update_own_open_fixture on public.predictions;
create policy predictions_update_own_open_fixture
  on public.predictions for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from fixtures f
      where f.api_fixture_id::bigint = predictions.fixture_id
        and coalesce(f.is_open, false) = true
        and f.actual_home_score is null
        and f.actual_away_score is null
        and now() < f.match_date - interval '1 minute'   -- فحص التوقيت المباشر
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fixtures f
      where f.api_fixture_id::bigint = predictions.fixture_id
        and coalesce(f.is_open, false) = true
        and f.actual_home_score is null
        and f.actual_away_score is null
        and now() < f.match_date - interval '1 minute'   -- فحص التوقيت المباشر
    )
  );

-- ③ DELETE: لا حذف لتوقع بعد بداية الماتش (للاتساق)
drop policy if exists predictions_delete_own_open_fixture on public.predictions;
create policy predictions_delete_own_open_fixture
  on public.predictions for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from fixtures f
      where f.api_fixture_id::bigint = predictions.fixture_id
        and coalesce(f.is_open, false) = true
        and f.actual_home_score is null
        and f.actual_away_score is null
        and now() < f.match_date - interval '1 minute'   -- فحص التوقيت المباشر
    )
  );
