'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [actualForm, setActualForm] = useState({ homeScore: 0, awayScore: 0, firstScorer: '', extraTime: false });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';

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

  // دمج البيانات من API + Supabase
  const loadMatches = async () => {
    try {
      // 1. جلب البيانات من API-Football
      const res = await fetch('/api/fixtures');
      const apiData = await res.json();
      const apiMatches = apiData.response || [];

      // 2. جلب حالة is_open من جدول fixtures في Supabase
      const { data: supabaseFixtures } = await supabase
        .from('fixtures')
        .select('id, is_open, actual_home_score, actual_away_score');

      const supabaseMap = new Map(supabaseFixtures?.map(f => [f.id, f]) || []);

      // 3. دمج البيانات
      const merged = apiMatches.map((m: any) => {
        const supabaseData = supabaseMap.get(m.fixture.id);
        return {
          ...m,
          is_open: supabaseData ? supabaseData.is_open : true,
          actual_home_score: supabaseData ? supabaseData.actual_home_score : null,
          actual_away_score: supabaseData ? supabaseData.actual_away_score : null
        };
      });

      setMatches(merged);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    // ... (نفس الكود السابق للإحصائيات)
    const { data: fixturesData } = await supabase.from('fixtures').select('is_open');
    const totalMatches = fixturesData?.length || 0;
    const openMatches = fixturesData?.filter(m => m.is_open).length || 0;

    const { count: totalPredictions, data: predictionsData } = await supabase
      .from('predictions')
      .select('user_id, points', { count: 'exact' });

    const uniqueUsers = new Set(predictionsData?.map(p => p.user_id) || []);
    const totalPoints = predictionsData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    const avgPoints = uniqueUsers.size > 0 ? Math.round(totalPoints / uniqueUsers.size) : 0;

    setStats({
      totalMatches,
      openMatches,
      closedMatches: totalMatches - openMatches,
      totalUsers: uniqueUsers.size,
      totalPredictions: totalPredictions || 0,
      totalPoints,
      avgPoints
    });
    setLoading(false);
  };

  // باقي الدوال (مُصححة)
  const openAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد فتح التوقعات لكل الماتشات؟')) return;
    const { error } = await supabase.from('fixtures').update({ is_open: true }).gt('id', 0);
    if (error) alert('خطأ: ' + error.message);
    else {
      alert('✅ تم فتح التوقعات لكل الماتشات');
      await loadMatches();
      await loadStats();
    }
  };

  const closeAllMatches = async () => {
    if (!confirm('هل أنت متأكد تريد إغلاق التوقعات لكل الماتشات؟')) return;
    const { error } = await supabase.from('fixtures').update({ is_open: false }).gt('id', 0);
    if (error) alert('خطأ: ' + error.message);
    else {
      alert('✅ تم إغلاق التوقعات لكل الماتشات');
      await loadMatches();
      await loadStats();
    }
  };

  const toggleMatchStatus = async (match: any) => {
    const newStatus = !match.is_open;
    const { error } = await supabase.from('fixtures').update({ is_open: newStatus }).eq('id', match.fixture.id);
    if (error) alert('خطأ: ' + error.message);
    else {
      alert(newStatus ? '✅ التوقعات فُتحت' : '✅ التوقعات أُغلقت');
      await loadMatches();
    }
  };

  const autoUpdateFromAPI = async () => {
    if (!confirm('هل تريد تحديث كل النتايج الفعلية تلقائيًا من API-Football؟')) return;
    const res = await fetch('/api/update-results');
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await loadMatches();
      await loadStats();
    } else alert('خطأ: ' + data.error);
  };

  const openEditModal = (match: any) => {
    setEditingMatch(match);
    setActualForm({ homeScore: 0, awayScore: 0, firstScorer: '', extraTime: false });
  };

  const closeEditModal = () => setEditingMatch(null);

  const saveActualResult = async () => {
    if (!editingMatch) return;
    const { error } = await supabase
      .from('predictions')
      .update({
        actual_home_score: actualForm.homeScore,
        actual_away_score: actualForm.awayScore,
      })
      .eq('fixture_id', editingMatch.fixture.id);

    if (error) alert('خطأ: ' + error.message);
    else {
      alert('✅ النتيجة الفعلية اتسجلت');
      closeEditModal();
      await loadMatches();
      await loadStats();
    }
  };

  const [stats, setStats] = useState({
    totalMatches: 0, openMatches: 0, closedMatches: 0,
    totalUsers: 0, totalPredictions: 0, totalPoints: 0, avgPoints: 0
  });

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-tajawal">جاري التحميل...</div>;

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <span className="text-6xl">🔧</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">Admin Panel</h1>
            </div>
            <div className="flex gap-3">
              <button onClick={openAllMatches} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">✅ فتح الكل</button>
              <button onClick={closeAllMatches} className="bg-red-600 hover:bg-red-700 px-6 py-4 rounded-3xl font-tajawal text-lg font-bold">🚫 إغلاق الكل</button>
              <button onClick={() => router.push('/dashboard')} className="bg-zinc-700 hover:bg-zinc-600 px-6 py-4 rounded-3xl font-tajawal text-lg">رجوع للداشبورد</button>
            </div>
          </div>

          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-10">
            <div className="bg-zinc-900 p-6 rounded-3xl text-center">
              <p className="text-white/60 text-sm">إجمالي الماتشات</p>
              <p className="text-4xl font-bold text-white mt-2">{stats.totalMatches}</p>
            </div>
            <div className="bg-emerald-900/30 p-6 rounded-3xl text-center border border-emerald-500/30">
              <p className="text-emerald-400 text-sm">مفتوحة</p>
              <p className="text-4xl font-bold text-emerald-400 mt-2">{stats.openMatches}</p>
            </div>
            <div className="bg-red-900/30 p-6 rounded-3xl text-center border border-red-500/30">
              <p className="text-red-400 text-sm">مغلقة</p>
              <p className="text-4xl font-bold text-red-400 mt-2">{stats.closedMatches}</p>
            </div>
            <div className="bg-zinc-900 p-6 rounded-3xl text-center">
              <p className="text-white/60 text-sm">المستخدمين</p>
              <p className="text-4xl font-bold text-white mt-2">{stats.totalUsers}</p>
            </div>
            <div className="bg-zinc-900 p-6 rounded-3xl text-center">
              <p className="text-white/60 text-sm">إجمالي التوقعات</p>
              <p className="text-4xl font-bold text-white mt-2">{stats.totalPredictions}</p>
            </div>
            <div className="bg-amber-900/30 p-6 rounded-3xl text-center border border-amber-500/30">
              <p className="text-amber-400 text-sm">مجموع النقاط</p>
              <p className="text-4xl font-bold text-amber-400 mt-2">{stats.totalPoints}</p>
              <p className="text-xs text-amber-400/70 mt-1">متوسط: {stats.avgPoints} نقطة</p>
            </div>
          </div>

          <h2 className="text-3xl font-tajawal mb-8">إدارة الماتشات</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {matches.map((match) => {
              const hasResult = match.actual_home_score !== null && match.actual_away_score !== null;
              return (
                <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 hover:border-red-600 transition-all relative">
                  {/* بادج الحالة */}
                  <div className={`absolute top-6 left-6 px-5 py-1.5 rounded-2xl text-sm font-bold ${match.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {match.is_open ? '✅ مفتوح' : '❌ مغلق'}
                  </div>

                  {/* بادج النتيجة */}
                  <div className={`absolute top-6 right-6 px-5 py-1.5 rounded-2xl text-sm font-bold ${hasResult ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white'}`}>
                    {hasResult ? '📊 نتيجة مسجلة' : '⏳ بدون نتيجة'}
                  </div>

                  <div className="flex justify-between items-center mb-6 pt-12">
                    <div className="flex-1 text-center"><p className="font-tajawal text-2xl">{match.teams.home.name}</p></div>
                    <div className="px-8 text-xl font-light">VS</div>
                    <div className="flex-1 text-center"><p className="font-tajawal text-2xl">{match.teams.away.name}</p></div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => toggleMatchStatus(match)} className={`flex-1 py-5 rounded-3xl font-tajawal text-lg font-bold transition-all ${match.is_open ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                      {match.is_open ? '🚫 إغلاق التوقعات' : '✅ فتح التوقعات'}
                    </button>
                    <button onClick={() => openEditModal(match)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-3xl text-lg font-tajawal">تعديل النتيجة</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <button onClick={autoUpdateFromAPI} className="bg-emerald-600 hover:bg-emerald-700 px-10 py-5 rounded-3xl font-tajawal text-lg font-bold flex items-center gap-3">🔄 تحديث أوتوماتيك من API-Football</button>
          </div>
        </div>
      </main>

      {/* Modal */}
      {editingMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeEditModal}>
          <div style={{ position: 'relative' }} className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 shadow-2xl border border-green-500/40" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-8 font-tajawal">{editingMatch.teams.home.name} × {editingMatch.teams.away.name}</h2>
            <div className="space-y-8">
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.home.name}</p>
                  <input type="number" min={0} value={actualForm.homeScore} onChange={(e) => setActualForm({ ...actualForm, homeScore: Number(e.target.value) })} className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-green-500/50 focus:border-green-500" style={{ color: '#111111', fontWeight: '700' }} />
                </div>
                <div className="text-6xl font-light mt-14" style={{ color: '#22c55e' }}>–</div>
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.away.name}</p>
                  <input type="number" min={0} value={actualForm.awayScore} onChange={(e) => setActualForm({ ...actualForm, awayScore: Number(e.target.value) })} className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-green-500/50 focus:border-green-500" style={{ color: '#111111', fontWeight: '700' }} />
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
