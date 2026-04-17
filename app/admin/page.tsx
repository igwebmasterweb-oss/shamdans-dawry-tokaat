'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [actualForm, setActualForm] = useState({ homeScore: 0, awayScore: 0 });
  const [actualFormExtra, setActualFormExtra] = useState({
    firstScorer: '',
    wentExtraTime: false,
    surpriseAnswer: '',
  });
  const [loading, setLoading] = useState(true);
  const [predictionCounts, setPredictionCounts] = useState<Record<number, number>>({});
  const [stats, setStats] = useState({ totalUsers: 0, totalPredictions: 0, totalPoints: 0, avgPoints: 0 });
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();
  const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';

  const computedStats = {
    totalMatches: matches.length,
    openMatches: matches.filter(m => m.is_open).length,
    closedMatches: matches.filter(m => !m.is_open).length,
    matchesWithResult: matches.filter(m =>
      m.actual_home_score !== null && m.actual_home_score !== undefined &&
      m.actual_away_score !== null && m.actual_away_score !== undefined
    ).length,
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || data.user.email !== ADMIN_EMAIL) {
        alert('❌ هذه الصفحة للأدمن فقط');
        router.push('/dashboard');
        return;
      }
      setUser(data.user);
      loadMatches();
      loadStats();
    });
  }, [router]);

  const loadMatches = async () => {
    try {
      const res = await fetch('/api/fixtures');
      const apiData = await res.json();
      const apiMatches = apiData.response || [];

      const { data: supabaseFixtures } = await supabase
        .from('fixtures')
        .select('id, api_fixture_id, is_open, actual_home_score, actual_away_score, first_scorer, went_extra_time, surprise_answer');

      const supabaseMap = new Map(supabaseFixtures?.map(f => [f.api_fixture_id, f]) || []);

      const merged = apiMatches.map((m: any) => {
        const supabaseData = supabaseMap.get(m.fixture.id);
        const homeScore = supabaseData?.actual_home_score;
        const awayScore = supabaseData?.actual_away_score;
        const hasResult =
          homeScore !== null && homeScore !== undefined &&
          awayScore !== null && awayScore !== undefined;
        const isOpen = hasResult ? false : (supabaseData ? supabaseData.is_open : false);
        return {
          ...m,
          is_open: isOpen,
          actual_home_score: hasResult ? homeScore : null,
          actual_away_score: hasResult ? awayScore : null,
          first_scorer: supabaseData?.first_scorer || null,
          went_extra_time: supabaseData?.went_extra_time || false,
          surprise_answer: supabaseData?.surprise_answer || null,
        };
      });

      setMatches(merged);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const { count: totalPredictions, data: predictionsData } = await supabase
      .from('predictions')
      .select('user_id, fixture_id, points', { count: 'exact' });

    const uniqueUsers = new Set(predictionsData?.map(p => p.user_id) || []);
    const totalPoints = predictionsData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    const avgPoints = uniqueUsers.size > 0 ? Math.round(totalPoints / uniqueUsers.size) : 0;

    const counts: Record<number, number> = {};
    predictionsData?.forEach(p => {
      counts[p.fixture_id] = (counts[p.fixture_id] || 0) + 1;
    });
    setPredictionCounts(counts);
    setStats({ totalUsers: uniqueUsers.size, totalPredictions: totalPredictions || 0, totalPoints, avgPoints });
  };

  const closeAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد إغلاق التوقعات لكل الماتشات؟')) return;
    const fixtureIds = matches.map(m => m.fixture.id);
    const res = await fetch('/api/admin-close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureIds, is_open: false }),
    });
    const data = await res.json();
    if (!data.success) alert('خطأ: ' + data.error);
    else {
      setMatches(prev => prev.map(m => ({ ...m, is_open: false })));
      alert('✅ تم إغلاق التوقعات لكل الماتشات');
    }
  };

  const openAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد فتح التوقعات لكل الماتشات؟')) return;
    const matchesWithoutResult = matches.filter(
      m => m.actual_home_score === null || m.actual_home_score === undefined
    );
    if (matchesWithoutResult.length === 0) {
      alert('⚠️ كل الماتشات عندها نتايج، امسح النتايج الأول');
      return;
    }
    const fixtureIds = matchesWithoutResult.map(m => m.fixture.id);
    const res = await fetch('/api/admin-close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureIds, is_open: true }),
    });
    const data = await res.json();
    if (!data.success) alert('خطأ: ' + data.error);
    else {
      setMatches(prev =>
        prev.map(m => {
          const hasResult = m.actual_home_score !== null && m.actual_home_score !== undefined;
          return hasResult ? m : { ...m, is_open: true };
        })
      );
      alert('✅ تم فتح التوقعات للماتشات بدون نتيجة');
    }
  };

  const syncNewFixtures = async () => {
    if (!confirm('مزامنة كل الماتشات من API وإضافة الجديد؟')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      if (data.success) {
        alert(`✅ تمت المزامنة! إجمالي: ${data.count} — جديد: ${data.added}`);
        await loadMatches();
      } else alert('خطأ: ' + data.error);
    } catch { alert('خطأ في الاتصال'); }
    setSyncing(false);
  };

  const toggleMatchStatus = async (match: any) => {
    const hasResult =
      match.actual_home_score !== null && match.actual_home_score !== undefined &&
      match.actual_away_score !== null && match.actual_away_score !== undefined;
    if (!match.is_open && hasResult) {
      alert('⚠️ لازم تمسح النتيجة الأول عشان تفتح التوقعات');
      return;
    }
    const newStatus = !match.is_open;
    const res = await fetch('/api/admin-close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureIds: [match.fixture.id], is_open: newStatus }),
    });
    const data = await res.json();
    if (!data.success) alert('خطأ: ' + data.error);
    else {
      setMatches(prev => prev.map(m => m.fixture.id === match.fixture.id ? { ...m, is_open: newStatus } : m));
      alert(newStatus ? '✅ التوقعات فُتحت' : '✅ التوقعات أُغلقت');
    }
  };

  const autoUpdateFromAPI = async () => {
    if (!confirm('هل تريد تحديث كل النتايج الفعلية تلقائيًا؟')) return;
    const res = await fetch('/api/update-results');
    const data = await res.json();
    if (data.success) { alert(data.message); await loadMatches(); }
    else alert('خطأ: ' + data.error);
  };

  const openEditModal = (match: any) => {
    setEditingMatch(match);
    setActualForm({
      homeScore: match.actual_home_score ?? 0,
      awayScore: match.actual_away_score ?? 0,
    });
    setActualFormExtra({
      firstScorer: match.first_scorer || '',
      wentExtraTime: match.went_extra_time || false,
      surpriseAnswer: match.surprise_answer || '',
    });
  };

  const closeEditModal = () => setEditingMatch(null);

  const saveActualResult = async () => {
    if (!editingMatch) return;

    // ✅ يستخدم service role عبر admin-close-all لفتح/إغلاق
    // لكن النتيجة تتحفظ عبر supabase مباشرة (upsert)
    const { createClient } = await import('@supabase/supabase-js');
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('fixtures')
      .upsert({
        api_fixture_id: editingMatch.fixture.id,
        actual_home_score: actualForm.homeScore,
        actual_away_score: actualForm.awayScore,
        first_scorer: actualFormExtra.firstScorer || null,
        went_extra_time: actualFormExtra.wentExtraTime,
        surprise_answer: actualFormExtra.surpriseAnswer || null,
        is_open: false,
      }, { onConflict: 'api_fixture_id' });

    if (error) alert('خطأ: ' + error.message);
    else {
      setMatches(prev =>
        prev.map(m =>
          m.fixture.id === editingMatch.fixture.id
            ? {
                ...m,
                actual_home_score: actualForm.homeScore,
                actual_away_score: actualForm.awayScore,
                first_scorer: actualFormExtra.firstScorer || null,
                went_extra_time: actualFormExtra.wentExtraTime,
                surprise_answer: actualFormExtra.surpriseAnswer || null,
                is_open: false,
              }
            : m
        )
      );
      alert('✅ النتيجة اتسجلت والماتش اتغلق');
      closeEditModal();
    }
  };

  const clearSingleResult = async (match: any) => {
    if (!confirm(`مسح نتيجة ${match.teams.home.name} vs ${match.teams.away.name}?`)) return;
    const { error } = await supabase
      .from('fixtures')
      .update({
        actual_home_score: null,
        actual_away_score: null,
        first_scorer: null,
        went_extra_time: false,
        surprise_answer: null,
      })
      .eq('api_fixture_id', match.fixture.id);
    if (error) alert('خطأ: ' + error.message);
    else {
      setMatches(prev =>
        prev.map(m =>
          m.fixture.id === match.fixture.id
            ? { ...m, actual_home_score: null, actual_away_score: null, first_scorer: null, went_extra_time: false, surprise_answer: null }
            : m
        )
      );
      alert('✅ تم مسح النتيجة');
    }
  };

  const clearTestResults = async () => {
    if (!confirm('هل أنت متأكد تريد مسح كل النتايج التجاربية؟')) return;
    const { error } = await supabase
      .from('fixtures')
      .update({
        actual_home_score: null,
        actual_away_score: null,
        first_scorer: null,
        went_extra_time: false,
        surprise_answer: null,
      })
      .not('api_fixture_id', 'is', null);
    if (error) alert('خطأ: ' + error.message);
    else {
      setMatches(prev => prev.map(m => ({
        ...m,
        actual_home_score: null,
        actual_away_score: null,
        first_scorer: null,
        went_extra_time: false,
        surprise_answer: null,
        is_open: true,
      })));
      alert('✅ تم مسح كل النتايج التجاربية');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-tajawal">
      جاري التحميل...
    </div>
  );

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="text-6xl">🔧</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">Admin Panel</h1>
            </div>
            <div className="flex gap-3 flex-wrap justify-end">
              <button onClick={openAllMatches} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">✅ فتح الكل</button>
              <button onClick={closeAllMatches} className="bg-red-600 hover:bg-red-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">🚫 إغلاق الكل</button>
              <button onClick={clearTestResults} className="bg-orange-600 hover:bg-orange-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">🗑️ مسح النتايج</button>
              <button
                onClick={syncNewFixtures}
                disabled={syncing}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold"
              >
                {syncing ? '⏳ جاري المزامنة...' : '🔄 مزامنة الماتشات الجديدة'}
              </button>
              <button onClick={() => router.push('/dashboard')} className="bg-zinc-700 hover:bg-zinc-600 px-6 py-4 rounded-3xl font-tajawal text-lg">رجوع للداشبورد</button>
            </div>
          </div>

          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-10">
            <div className="bg-zinc-900 p-5 rounded-3xl text-center">
              <p className="text-white/60 text-xs">إجمالي الماتشات</p>
              <p className="text-3xl font-bold text-white mt-1">{computedStats.totalMatches}</p>
            </div>
            <div className="bg-emerald-900/30 p-5 rounded-3xl text-center border border-emerald-500/30">
              <p className="text-emerald-400 text-xs">مفتوحة</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{computedStats.openMatches}</p>
            </div>
            <div className="bg-red-900/30 p-5 rounded-3xl text-center border border-red-500/30">
              <p className="text-red-400 text-xs">مغلقة</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{computedStats.closedMatches}</p>
            </div>
            <div className="bg-green-900/30 p-5 rounded-3xl text-center border border-green-500/30">
              <p className="text-green-400 text-xs">لها نتيجة</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{computedStats.matchesWithResult}</p>
            </div>
            <div className="bg-zinc-900 p-5 rounded-3xl text-center">
              <p className="text-white/60 text-xs">المستخدمين</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalUsers}</p>
            </div>
            <div className="bg-zinc-900 p-5 rounded-3xl text-center">
              <p className="text-white/60 text-xs">إجمالي التوقعات</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalPredictions}</p>
            </div>
            <div className="bg-blue-900/30 p-5 rounded-3xl text-center border border-blue-500/30">
              <p className="text-blue-400 text-xs">عدد المتوقعين</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{stats.totalUsers}</p>
              <p className="text-xs text-blue-400/70 mt-0.5">{stats.totalPredictions} توقع</p>
            </div>
            <div className="bg-amber-900/30 p-5 rounded-3xl text-center border border-amber-500/30">
              <p className="text-amber-400 text-xs">مجموع النقاط</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{stats.totalPoints}</p>
              <p className="text-xs text-amber-400/70 mt-0.5">متوسط: {stats.avgPoints}</p>
            </div>
          </div>

          <h2 className="text-3xl font-tajawal mb-8">إدارة الماتشات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {matches.map((match) => {
              const hasResult =
                match.actual_home_score !== null && match.actual_home_score !== undefined &&
                match.actual_away_score !== null && match.actual_away_score !== undefined;
              const matchPredictors = predictionCounts[match.fixture.id] || 0;
              return (
                <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 hover:border-red-600 transition-all relative pt-16">
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center gap-2">
                    <span className={`px-4 py-1.5 rounded-2xl text-sm font-bold whitespace-nowrap ${match.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {match.is_open ? '✅ مفتوح' : '❌ مغلق'}
                    </span>
                    <span className={`px-4 py-1.5 rounded-2xl text-sm font-bold whitespace-nowrap ${hasResult ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white'}`}>
                      {hasResult ? `📊 ${match.actual_home_score} - ${match.actual_away_score}` : '⏳ بدون نتيجة'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <div className="flex-1 text-center"><p className="font-tajawal text-2xl">{match.teams.home.name}</p></div>
                    <div className="px-8 text-xl font-light">VS</div>
                    <div className="flex-1 text-center"><p className="font-tajawal text-2xl">{match.teams.away.name}</p></div>
                  </div>

                  {/* ✅ تفاصيل النتيجة الإضافية */}
                  {hasResult && (
                    <div className="text-center mb-3 space-y-1">
                      {match.first_scorer && (
                        <p className="text-yellow-400 text-sm">⚽ أول هدف: {match.first_scorer}</p>
                      )}
                      <p className="text-blue-400 text-sm">
                        ⏱️ وقت إضافي: {match.went_extra_time ? 'نعم' : 'لا'}
                      </p>
                      {match.surprise_answer && (
                        <p className="text-purple-400 text-sm">🎯 المفاجأة: {match.surprise_answer}</p>
                      )}
                    </div>
                  )}

                  <div className="text-center mb-5">
                    <span className="text-sm text-blue-400 bg-blue-900/30 px-4 py-1 rounded-full border border-blue-500/30">
                      👥 {matchPredictors} متوقع
                    </span>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => toggleMatchStatus(match)}
                      disabled={!match.is_open && hasResult}
                      className={`flex-1 py-5 rounded-3xl font-tajawal text-lg font-bold transition-all
                        ${!match.is_open && hasResult
                          ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                          : match.is_open
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                      {match.is_open ? '🚫 إغلاق التوقعات' : hasResult ? '🔒 مغلق (فيه نتيجة)' : '✅ فتح التوقعات'}
                    </button>
                    <button
                      onClick={() => openEditModal(match)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-3xl text-lg font-tajawal"
                    >
                      تعديل النتيجة
                    </button>
                    {hasResult && (
                      <button
                        onClick={() => clearSingleResult(match)}
                        className="w-full py-3 rounded-3xl font-tajawal text-sm font-bold bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-600/30 transition-all"
                      >
                        🗑️ مسح النتيجة لفتح التوقعات
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              onClick={autoUpdateFromAPI}
              className="bg-emerald-600 hover:bg-emerald-700 px-10 py-5 rounded-3xl font-tajawal text-lg font-bold"
            >
              🔄 تحديث أوتوماتيك من API-Football
            </button>
          </div>

        </div>
      </main>

      {/* Modal النتيجة */}
      {editingMatch && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}
          onClick={closeEditModal}
        >
          <div
            className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 my-8 shadow-2xl border border-green-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-2 font-tajawal">
              {editingMatch.teams.home.name} × {editingMatch.teams.away.name}
            </h2>
            {editingMatch.actual_home_score !== null && editingMatch.actual_home_score !== undefined && (
              <p className="text-center text-green-400 mb-4 font-tajawal">
                النتيجة الحالية: {editingMatch.actual_home_score} - {editingMatch.actual_away_score}
              </p>
            )}

            <div className="space-y-6 mt-6">
              {/* النتيجة */}
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.home.name}</p>
                  <input type="number" min={0} value={actualForm.homeScore}
                    onChange={(e) => setActualForm({ ...actualForm, homeScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
                <div className="text-6xl font-light mt-14" style={{ color: '#22c55e' }}>–</div>
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.away.name}</p>
                  <input type="number" min={0} value={actualForm.awayScore}
                    onChange={(e) => setActualForm({ ...actualForm, awayScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
              </div>

              {/* ✅ أول هدف */}
              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">
                  ⚽ أول هدف (اسم اللاعب)
                </label>
                <input
                  type="text"
                  value={actualFormExtra.firstScorer}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, firstScorer: e.target.value })}
                  className="w-full bg-white text-black px-6 py-4 rounded-3xl text-lg font-tajawal"
                  style={{ color: '#111111', fontWeight: '600' }}
                  placeholder="مثال: صلاح"
                />
              </div>

              {/* ✅ وقت إضافي */}
              <div className="flex items-center gap-4 bg-zinc-800 px-6 py-4 rounded-3xl">
                <input
                  type="checkbox"
                  checked={actualFormExtra.wentExtraTime}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, wentExtraTime: e.target.checked })}
                  className="w-6 h-6 accent-green-500"
                />
                <label style={{ color: '#ffffff', fontWeight: '600' }} className="font-tajawal text-lg">
                  ⏱️ الماتش راح وقت إضافي؟
                </label>
              </div>

              {/* ✅ مفاجأة الجولة */}
              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">
                  🎯 الإجابة الصح لمفاجأة الجولة
                </label>
                <input
                  type="text"
                  value={actualFormExtra.surpriseAnswer}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, surpriseAnswer: e.target.value })}
                  className="w-full bg-white text-black px-6 py-4 rounded-3xl text-lg font-tajawal"
                  style={{ color: '#111111', fontWeight: '600' }}
                  placeholder="الإجابة الصح للمفاجأة"
                />
              </div>

              {/* نظام النقاط */}
              <div className="bg-zinc-800 rounded-2xl p-4 text-sm font-tajawal space-y-1">
                <p className="text-white/70 font-bold mb-2">نظام النقاط:</p>
                <p className="text-yellow-400">🏆 نتيجة كاملة صح = 10 نقاط</p>
                <p className="text-green-400">✅ فايز صح = 5 نقاط</p>
                <p className="text-blue-400">⚽ أول هدف صح = 3 نقاط</p>
                <p className="text-purple-400">⏱️ وقت إضافي صح = 2 نقاط</p>
                <p className="text-pink-400">🎯 مفاجأة صح = 5 نقاط</p>
                <p className="text-white/50 mt-2">أقصى نقاط = 25 نقطة</p>
              </div>

              <div className="flex gap-4">
                <button onClick={closeEditModal} className="flex-1 py-5 rounded-3xl font-tajawal text-xl" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#ffffff' }}>إلغاء</button>
                <button onClick={saveActualResult} className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#22c55e' }}>حفظ النتيجة ✅</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
