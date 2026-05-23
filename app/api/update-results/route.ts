import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ normalize اسم اللاعب — يحل مشاكل الـ accents والإملاء
function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD')                      // Mbappé → Mbappe
    .replace(/[\u0300-\u036f]/g, '')       // شيل الـ diacritics
    .replace(/[^a-z0-9\s]/g, '')           // شيل special chars
    .replace(/\s+/g, ' ');                 // normalize spaces
}

export async function GET(request: NextRequest) {
  // ✅ Security: يقبل طلبات من Cron (x-internal-key) أو Vercel Cron (authorization)
  const internalKey = request.headers.get('x-internal-key');
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET || '';

  const isAuthorized =
    internalKey === cronSecret ||
    authHeader  === `Bearer ${cronSecret}`;

  if (cronSecret && !isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: fixtures, error: fixError } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .not('actual_home_score', 'is', null);

    if (fixError) throw fixError;

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد ماتشات بها نتائج بعد',
        updated: 0,
      });
    }

    let totalUpdated = 0;
    const affectedUsers = new Set<string>();

    for (const fixture of fixtures) {
      // ✅ فقط التوقعات اللي points = null
      const { data: preds } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('fixture_id', fixture.api_fixture_id)
        .is('points', null);

      if (!preds || preds.length === 0) continue;

      for (const pred of preds) {
        let points = 0;

        const actualHome: number = fixture.actual_home_score;
        const actualAway: number = fixture.actual_away_score;
        const predHome: number   = pred.predicted_home_score;
        const predAway: number   = pred.predicted_away_score;

        // +10 نتيجة كاملة
        if (predHome === actualHome && predAway === actualAway) {
          points += 10;
        } else {
          // +5 فائز / تعادل
          const actualWinner = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw';
          const predWinner   = predHome   > predAway   ? 'home' : predAway   > predHome   ? 'away' : 'draw';
          if (actualWinner === predWinner) points += 5;
        }

        // ✅ +3 أول هدف — مطابقة مرنة مع normalizeName
        if (fixture.first_scorer && pred.predicted_first_scorer) {
          const actual    = normalizeName(fixture.first_scorer);
          const predicted = normalizeName(pred.predicted_first_scorer);
          if (
            actual === predicted ||
            actual.includes(predicted) ||
            predicted.includes(actual)
          ) {
            points += 3;
          }
        }

        // +2 وقت إضافي — بس لو الاتنين true
        if (fixture.went_extra_time === true && pred.predicted_extra_time === true) {
          points += 2;
        }

        // +2 بطاقة حمراء — بس لو الاتنين true
        if (fixture.red_card_in_match === true && pred.predicted_red_card === true) {
          points += 2;
        }

        // +2 ركلة جزاء — بس لو الاتنين true
        if (fixture.penalty_in_match === true && pred.predicted_penalty === true) {
          points += 2;
        }

        // +2 BTTS — بس لو الاتنين true
        if (fixture.both_teams_scored === true && pred.predicted_both_teams === true) {
          points += 2;
        }

        await supabaseAdmin
          .from('predictions')
          .update({
            points,
            actual_home_score: actualHome,
            actual_away_score: actualAway,
          })
          .eq('id', pred.id);

        if (points > 0) {
          await supabaseAdmin.from('social_feed').insert({
            user_id: pred.user_id,
            type: 'points_earned',
            data: {
              points,
              fixture_id: fixture.api_fixture_id,
              home_team: pred.home_team,
              away_team: pred.away_team,
            },
          });
        }

        affectedUsers.add(pred.user_id);
        totalUpdated++;
      }
    }

    for (const userId of affectedUsers) {
      await supabaseAdmin.rpc('refresh_user_points', { p_user_id: userId });
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث ${totalUpdated} توقع لـ ${affectedUsers.size} مستخدم`,
      updated: totalUpdated,
      users: affectedUsers.size,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
