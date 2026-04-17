'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [actualForm, setActualForm] = useState({ homeScore: 0, awayScore: 0 });
  const [loading, setLoading] = useState(true);
  const [predictionCounts, setPredictionCounts] = useState<Record<number, number>>({});
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
        // ✅ إضافة api_fixture_id للـ select
        .select('id, api_fixture_id, is_open, actual_home_score, actual_away_score');

      // ✅ البحث بـ api_fixture_id (نفس رقم API-Football) مش id الداخلي
      const supabaseMap = new Map(supabaseFixtures?.map(f => [f.api_fixture_id, f]) || []);

      const merged = apiMatches.map((m: any) => {
        const supabaseData = supabaseMap.get(m.fixture.id);
        const homeScore = supabaseData?.actual_home_score;
        const awayScore = supabaseData?.actual_away_score;

        const hasResult =
          homeScore !== null && homeScore !== undefined &&
          awayScore !== null && awayScore !== undefined;

        const isOpen = hasResult ? false : (supabaseData ? supabaseData.is_open : true);

        return {
          ...m,
          is_open: isOpen,
          actual_home_score: hasResult ? homeScore : null,
          actual_away_score: hasResult ? awayScore : null,
          // ✅ نحفظ الـ id الداخلي عشان نستخدمه في الـ update
          _supabase_id: supabaseData?.id ?? null,
        };
      });

      setMatches(merged);
    } catch (err) {
      console.error(err);
    }
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

    setStats({
      totalUsers: uniqueUsers.size,
      totalPredictions: totalPredictions || 0,
      totalPoints,
      avgPoints,
    });
    setLoading(false);
  };

  const clearTestResults = async () => {
    if (!confirm('هل أنت متأكد تريد مسح كل النتايج التجاربية؟')) return;
    const { error } = await supabase
      .from('fixtures')
      .update({ actual_home_score: null, actual_away_score: null });

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev =>
        prev.map(m => ({ ...m, actual_home_score: null, actual_away_score: null, is_open: true }))
      );
      alert('✅ تم مسح كل النتايج التجاربية');
    }
  };

  const openAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد فتح التوقعات لكل الماتشات؟')) return;

    const matchesWithoutResult = matches
      .filter(m => m.actual_home_score === null || m.actual_home_score === undefined)
      .map(m => m.fixture.id); // api_fixture_id

    if (matchesWithoutResult.length === 0) {
      alert('⚠️ كل الماتشات عندها نتايج، امسح النتايج الأول');
      return;
    }

    // ✅ استخدام api_fixture_id في الـ filter
    const { error } = await supabase
      .from('fixtures')
      .update({ is_open: true })
      .in('api_fixture_id', matchesWithoutResult);

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev =>
        prev.map(m => {
          const hasResult = m.actual_home_score !== null && m.actual_home_score !== undefined;
          return hasResult ? m : { ...m, is_open: true };
        })
      );
      alert('✅ تم فتح التوقعات للماتشات بدون نتيجة');
    }
  };

  const closeAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد إغلاق التوقعات لكل الماتشات؟')) return;
    const { error } = await supabase.from('fixtures').update({ is_open: false }).gt('id', 0);
    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev => prev.map(m => ({ ...m, is_open: false })));
      alert('✅ تم إغلاق التوقعات لكل الماتشات');
    }
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
    // ✅ استخدام api_fixture_id
    const { error } = await supabase
      .from('fixtures')
      .update({ is_open: newStatus })
      .eq('api_fixture_id', match.fixture.id);

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev =>
        prev.map(m => m.fixture.id === match.fixture.id ? { ...m, is_open: newStatus } : m)
      );
      alert(newStatus ? '✅ التوقعات فُتحت' : '✅ التوقعات أُغلقت');
    }
  };

  const autoUpdateFromAPI = async () => {
    if (!confirm('هل تريد تحديث كل النتايج الفعلية تلقائيًا؟')) return;
    const res = await fetch('/api/update-results');
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await loadMatches();
    } else alert('خطأ: ' + data.error);
  };

  const openEditModal = (match: any) => {
    setEditingMatch(match);
    setActualForm({
      homeScore: match.actual_home_score ?? 0,
      awayScore: match.actual_away_score ?? 0,
    });
  };

  const closeEditModal = () => setEditingMatch(null);

  const saveActualResult = async () => {
    if (!editingMatch) return;
    // ✅ استخدام api_fixture_id
    const { error } = await supabase
      .from('fixtures')
      .update({
        actual_home_score: actualForm.homeScore,
        actual_away_score: actualForm.awayScore,
        is_open: false,
      })
      .eq('api_fixture_id', editingMatch.fixture.id);

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev =>
        prev.map(m =>
          m.fixture.id === editingMatch.fixture.id
            ? { ...m, actual_home_score: actualForm.homeScore, actual_away_score: actualForm.awayScore, is_open: false }
            : m
        )
      );
      alert('✅ النتيجة الفعلية اتسجلت والماتش اتغلق');
      closeEditModal();
    }
  };

  const clearSingleResult = async (match: any) => {
    if (!confirm(`مسح نتيجة ${match.teams.home.name} vs ${match.teams.away.name}?`)) return;
    // ✅ استخدام api_fixture_id
    const { error } = await supabase
      .from('fixtures')
      .update({ actual_home_score: null, actual_away_score: null })
      .eq('api_fixture_id', match.fixture.id);

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      setMatches(prev =>
        prev.map(m =>
          m.fixture.id === match.fixture.id
            ? { ...m, actual_home_score: null, actual_away_score: null }
            : m
        )
      );
      alert('✅ تم مسح النتيجة');
    }
  };

  const [stats, setStats] = useState({
    totalUsers: 0, totalPredictions: 0, totalPoints: 0, avgPoints: 0,
  });

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-tajawal">
      جاري التحميل...
    </div>
  );

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="text-6xl">🔧</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">Admin Panel</h1>
            </div>
            <div className="flex gap-3 flex-wrap justify-end">
              <button onClick={openAllMatches} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">✅ فتح الكل</button>
              <button onClick={closeAllMatches} className="bg-red-600 hover:bg-red-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">🚫 إغلاق الكل</button>
              <button onClick={clearTestResults} className="bg-orange-600 hover:bg-orange-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">🗑️ مسح النتايج</button>
              <button onClick={() => router.push('/dashboard')} className="bg-zinc-700 hover:bg-zinc-600 px-6 py-4 rounded-3xl font-tajawal text-lg">رجوع للداشبورد</button>
            </div>
          </div>

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
                    <div className="flex-1 text-center">
                      <p className="font-tajawal text-2xl">{match.teams.home.name}</p>
                    </div>
                    <div className="px-8 text-xl font-light">VS</div>
                    <div className="flex-1 text-center">
                      <p className="font-tajawal text-2xl">{match.teams.away.name}</p>
                    </div>
                  </div>

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
              className="bg-emerald-600 hover:bg-emerald-700 px-10 py-5 rounded-3xl font-tajawal text-lg font-bold flex items-center gap-3"
            >
              🔄 تحديث أوتوماتيك من API-Football
            </button>
          </div>
        </div>
      </main>

      {editingMatch && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={closeEditModal}
        >
          <div
            style={{ position: 'relative' }}
            className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 shadow-2xl border border-green-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-2 font-tajawal">
              {editingMatch.teams.home.name} × {editingMatch.teams.away.name}
            </h2>
            {editingMatch.actual_home_score !== null && editingMatch.actual_home_score !== undefined && (
              <p className="text-center text-green-400 mb-6 font-tajawal">
                النتيجة الحالية: {editingMatch.actual_home_score} - {editingMatch.actual_away_score}
              </p>
            )}
            <div className="space-y-8 mt-6">
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.home.name}</p>
                  <input
                    type="number" min={0}
                    value={actualForm.homeScore}
                    onChange={(e) => setActualForm({ ...actualForm, homeScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-green-500/50 focus:border-green-500"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
                <div className="text-6xl font-light mt-14" style={{ color: '#22c55e' }}>–</div>
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.away.name}</p>
                  <input
                    type="number" min={0}
                    value={actualForm.awayScore}
                    onChange={(e) => setActualForm({ ...actualForm, awayScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-green-500/50 focus:border-green-500"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={closeEditModal} className="flex-1 py-5 border border-zinc-400 rounded-3xl font-tajawal text-xl" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#ffffff' }}>إلغاء</button>
                <button type="button" onClick={saveActualResult} className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#22c55e' }}>حفظ النتيجة</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
