'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['igwebmaster@gmail.com'];

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'predictions' | 'leaderboard'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  // Modal النتيجة
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [actualFormExtra, setActualFormExtra] = useState({
    homeScore: 0,
    awayScore: 0,
    firstScorer: '',
    wentExtraTime: false,
    surpriseAnswer: '',
    surpriseQuestion: '',
  });

  // Modal فتح/غلق التوقعات
  const [savingResult, setSavingResult] = useState(false);

  const router = useRouter();
  const rounds = ['Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3'];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || '')) {
        router.push('/dashboard');
      } else {
        setUser(data.user);
        loadMatches();
        loadAllPredictions();
        loadLeaderboard();
      }
    });
  }, [router]);

  const loadMatches = async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];

      const { data: supabaseFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id, is_open, actual_home_score, actual_away_score, first_scorer, went_extra_time, surprise_answer, surprise_question');

      const supabaseMap = new Map(
        supabaseFixtures?.map((f: any) => [f.api_fixture_id, f]) || []
      );

      const merged = apiMatches.map((m: any) => {
        const sb = supabaseMap.get(m.fixture.id);
        return {
          ...m,
          is_open: sb?.is_open ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer: sb?.first_scorer ?? '',
          went_extra_time: sb?.went_extra_time ?? false,
          surprise_answer: sb?.surprise_answer ?? '',
          surprise_question: sb?.surprise_question ?? '',
        };
      });

      setMatches(merged);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadAllPredictions = async () => {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .order('submitted_at', { ascending: false });
    setPredictions(data || []);
  };

  const loadLeaderboard = async () => {
    const { data } = await supabase
      .from('predictions')
      .select('user_id, user_email, points, fixture_id');

    const grouped: any = {};
    data?.forEach((row: any) => {
      if (!grouped[row.user_id]) {
        grouped[row.user_id] = {
          user_id: row.user_id,
          user_email: row.user_email,
          totalPoints: 0,
          predictionCount: 0,
          bestPoints: 0,
        };
      }
      grouped[row.user_id].totalPoints += (row.points || 0);
      grouped[row.user_id].predictionCount += 1;
      if ((row.points || 0) > grouped[row.user_id].bestPoints) {
        grouped[row.user_id].bestPoints = row.points || 0;
      }
    });

    const sorted = Object.values(grouped)
      .sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    setLeaderboard(sorted);
  };

  // فتح/غلق التوقعات على ماتش
  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open;
    const fixtureId = match.fixture.id;

    const { data: existing } = await supabase
      .from('fixtures')
      .select('id')
      .eq('api_fixture_id', fixtureId)
      .single();

    if (existing) {
      await supabase.from('fixtures').update({ is_open: newStatus }).eq('api_fixture_id', fixtureId);
    } else {
      await supabase.from('fixtures').insert({
        api_fixture_id: fixtureId,
        is_open: newStatus,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        match_date: match.fixture.date,
        round: match.league.round,
      });
    }
    await loadMatches();
    showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
  };

  // فتح modal النتيجة
  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setActualFormExtra({
      homeScore: match.actual_home_score ?? 0,
      awayScore: match.actual_away_score ?? 0,
      firstScorer: match.first_scorer ?? '',
      wentExtraTime: match.went_extra_time ?? false,
      surpriseAnswer: match.surprise_answer ?? '',
      surpriseQuestion: match.surprise_question ?? '',
    });
    setShowResultModal(true);
  };

  // حفظ النتيجة اليدوية
  const saveActualResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fixtureId = selectedMatch.fixture.id;

    const { data: existing } = await supabase
      .from('fixtures')
      .select('id')
      .eq('api_fixture_id', fixtureId)
      .single();

    const payload = {
      actual_home_score: actualFormExtra.homeScore,
      actual_away_score: actualFormExtra.awayScore,
      first_scorer: actualFormExtra.firstScorer || null,
      went_extra_time: actualFormExtra.wentExtraTime,
      surprise_answer: actualFormExtra.surpriseAnswer || null,
      surprise_question: actualFormExtra.surpriseQuestion || null,
    };

    if (existing) {
      await supabase.from('fixtures').update(payload).eq('api_fixture_id', fixtureId);
    } else {
      await supabase.from('fixtures').insert({
        api_fixture_id: fixtureId,
        is_open: false,
        home_team: selectedMatch.teams.home.name,
        away_team: selectedMatch.teams.away.name,
        match_date: selectedMatch.fixture.date,
        round: selectedMatch.league.round,
        ...payload,
      });
    }

    setShowResultModal(false);
    await loadMatches();
    setSavingResult(false);
    showMsg('✅ تم حفظ النتيجة بنجاح');
  };

  // تحديث كل النقاط
  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/update-results');
      const data = await res.json();
      showMsg(data.success ? data.message : '❌ خطأ: ' + data.error);
      if (data.success) {
        await loadAllPredictions();
        await loadLeaderboard();
      }
    } catch {
      showMsg('❌ خطأ في الاتصال');
    }
    setUpdating(false);
  };

  // مزامنة الماتشات من API
  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count || ''} ماتش` : '❌ ' + data.error);
      await loadMatches();
    } catch {
      showMsg('❌ خطأ في المزامنة');
    }
    setSyncing(false);
  };

  // فتح/غلق كل الماتشات
  const openAllMatches = async () => {
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound);
    for (const match of filtered) {
      const fixtureId = match.fixture.id;
      const { data: existing } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fixtureId).single();
      if (existing) {
        await supabase.from('fixtures').update({ is_open: true }).eq('api_fixture_id', fixtureId);
      } else {
        await supabase.from('fixtures').insert({
          api_fixture_id: fixtureId, is_open: true,
          home_team: match.teams.home.name, away_team: match.teams.away.name,
          match_date: match.fixture.date, round: match.league.round,
        });
      }
    }
    await loadMatches();
    setUpdating(false);
    showMsg('✅ تم فتح كل الماتشات');
  };

  const closeAllMatches = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/admin-close-all');
      const data = await res.json();
      showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ ' + data.error);
      await loadMatches();
    } catch {
      showMsg('❌ خطأ في الغلق');
    }
    setUpdating(false);
  };

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-tajawal">
      جاري التحميل...
    </div>
  );

  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const totalPredictions = predictions.length;
  const gradedPredictions = predictions.filter(p => p.actual_home_score !== null).length;
  const openMatches = matches.filter(m => m.is_open).length;

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">⚙️</span>
              <div>
                <h1 className="text-4xl font-bold text-red-600 font-tajawal">لوحة التحكم</h1>
                <p className="text-white/50 font-tajawal">كأس العالم 2026 — الشمعدان</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={syncFixtures} disabled={syncing}
                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-5 py-3 rounded-2xl font-tajawal text-sm font-bold">
                {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الماتشات'}
              </button>
              <button onClick={updateAllPoints} disabled={updating}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-5 py-3 rounded-2xl font-tajawal text-sm font-bold">
                {updating ? '⏳ تحديث...' : '⚡ تحديث النقاط'}
              </button>
              <button onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-2xl font-tajawal text-sm">
                خروج
              </button>
            </div>
          </div>

          {/* رسالة الحالة */}
          {message && (
            <div className="bg-zinc-800 border border-zinc-600 text-white px-6 py-4 rounded-2xl mb-6 font-tajawal text-center text-lg">
              {message}
            </div>
          )}

          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">إجمالي التوقعات</p>
              <p className="text-4xl font-bold text-blue-400 mt-1">{totalPredictions}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">توقعات محسوبة</p>
              <p className="text-4xl font-bold text-green-400 mt-1">{gradedPredictions}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">ماتشات مفتوحة</p>
              <p className="text-4xl font-bold text-yellow-400 mt-1">{openMatches}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">عدد المتسابقين</p>
              <p className="text-4xl font-bold text-red-400 mt-1">{leaderboard.length}</p>
            </div>
          </div>

          {/* التابز الرئيسية */}
          <div className="flex gap-3 mb-8 flex-wrap">
            {(['matches', 'predictions', 'leaderboard'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-2xl font-tajawal text-lg font-bold transition-all ${
                  activeTab === tab ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                }`}>
                {tab === 'matches' ? `🏟️ الماتشات (${matches.length})` :
                 tab === 'predictions' ? `📋 التوقعات (${totalPredictions})` :
                 `🏆 الصدارة (${leaderboard.length})`}
              </button>
            ))}
          </div>

          {/* ========== تاب الماتشات ========== */}
          {activeTab === 'matches' && (
            <>
              {/* فلاتر الجولات */}
              <div className="flex gap-3 mb-6 flex-wrap items-center">
                {rounds.map(round => (
                  <button key={round} onClick={() => setActiveRound(round)}
                    className={`px-5 py-2 rounded-2xl font-tajawal font-bold transition-all ${
                      activeRound === round ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                    }`}>
                    {round === 'Group Stage - 1' ? 'الجولة الأولى' :
                     round === 'Group Stage - 2' ? 'الجولة الثانية' : 'الجولة الثالثة'}
                    <span className="mr-2 text-sm opacity-60">
                      ({matches.filter(m => m.league.round === round).length})
                    </span>
                  </button>
                ))}
                <div className="mr-auto flex gap-2">
                  <button onClick={openAllMatches} disabled={updating}
                    className="bg-green-800 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-2xl font-tajawal text-sm font-bold">
                    🟢 فتح الكل
                  </button>
                  <button onClick={closeAllMatches} disabled={updating}
                    className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded-2xl font-tajawal text-sm font-bold">
                    🔒 غلق الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMatches.map((match) => {
                  const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
                  const matchPredictions = predictions.filter(p => p.fixture_id === match.fixture.id);
                  return (
                    <div key={match.fixture.id}
                      className={`bg-zinc-900 p-6 rounded-3xl border transition-all ${
                        match.is_open ? 'border-green-500/40' : 'border-zinc-700'
                      }`}>

                      {/* اسم الماتش */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <p className="font-tajawal text-xl font-bold">
                            {match.teams.home.name} <span className="text-white/30">×</span> {match.teams.away.name}
                          </p>
                          <p className="text-white/40 text-sm mt-1">
                            {new Date(match.fixture.date).toLocaleDateString('ar-EG', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold font-tajawal ${
                          match.is_open ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-white/40'
                        }`}>
                          {match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}
                        </span>
                      </div>

                      {/* النتيجة الفعلية */}
                      {hasResult && (
                        <div className="bg-green-900/20 border border-green-500/20 rounded-2xl px-4 py-3 mb-3 space-y-1">
                          <p className="text-green-400 font-bold text-lg text-center">
                            النتيجة: {match.actual_home_score} - {match.actual_away_score}
                          </p>
                          {match.first_scorer && <p className="text-yellow-400 text-sm text-center">⚽ أول هدف: {match.first_scorer}</p>}
                          <p className="text-blue-400 text-sm text-center">⏱️ وقت إضافي: {match.went_extra_time ? 'نعم' : 'لا'}</p>
                          {match.surprise_question && <p className="text-purple-300 text-sm text-center">❓ السؤال: {match.surprise_question}</p>}
                          {match.surprise_answer && <p className="text-purple-400 text-sm text-center">🎯 الإجابة: {match.surprise_answer}</p>}
                        </div>
                      )}

                      {/* التوقعات */}
                      {matchPredictions.length > 0 && (
                        <p className="text-white/40 text-sm mb-3 font-tajawal">
                          👥 {matchPredictions.length} توقع مسجّل
                        </p>
                      )}

                      {/* الأزرار */}
                      <div className="flex gap-2">
                        <button onClick={() => toggleMatchOpen(match)}
                          className={`flex-1 py-3 rounded-2xl font-bold font-tajawal text-sm transition-all ${
                            match.is_open
                              ? 'bg-zinc-700 hover:bg-zinc-600 text-white/70'
                              : 'bg-green-700 hover:bg-green-600 text-white'
                          }`}>
                          {match.is_open ? '🔒 غلق التوقعات' : '🟢 فتح التوقعات'}
                        </button>
                        <button onClick={() => openResultModal(match)}
                          className="flex-1 py-3 rounded-2xl font-bold font-tajawal text-sm bg-red-700 hover:bg-red-600 transition-all">
                          {hasResult ? '✏️ تعديل النتيجة' : '⚽ إدخال النتيجة'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ========== تاب التوقعات ========== */}
          {activeTab === 'predictions' && (
            <div className="bg-zinc-900 rounded-3xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-tajawal">
                  <thead>
                    <tr className="border-b border-zinc-700 text-white/50">
                      <th className="text-right py-3 px-4">المستخدم</th>
                      <th className="text-right py-3 px-4">الماتش</th>
                      <th className="text-center py-3 px-4">توقعي</th>
                      <th className="text-center py-3 px-4">الفعلية</th>
                      <th className="text-center py-3 px-4">أول هدف</th>
                      <th className="text-center py-3 px-4">وقت إضافي</th>
                      <th className="text-center py-3 px-4">المفاجأة</th>
                      <th className="text-center py-3 px-4">النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="py-3 px-4 text-white/70">{p.user_email?.split('@')[0]}</td>
                        <td className="py-3 px-4">{p.home_team} × {p.away_team}</td>
                        <td className="py-3 px-4 text-center font-bold">{p.predicted_home_score} - {p.predicted_away_score}</td>
                        <td className="py-3 px-4 text-center text-green-400">
                          {p.actual_home_score !== null ? `${p.actual_home_score} - ${p.actual_away_score}` : '⏳'}
                        </td>
                        <td className="py-3 px-4 text-center text-yellow-400 text-xs">{p.predicted_first_scorer || '-'}</td>
                        <td className="py-3 px-4 text-center text-blue-400">{p.predicted_extra_time ? 'نعم' : 'لا'}</td>
                        <td className="py-3 px-4 text-center text-purple-400 text-xs">{p.surprise_answer || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                            p.points >= 10 ? 'bg-yellow-500/20 text-yellow-400' :
                            p.points >= 5 ? 'bg-green-500/20 text-green-400' :
                            p.actual_home_score !== null ? 'bg-zinc-700 text-white/50' :
                            'bg-zinc-800 text-white/30'
                          }`}>
                            {p.actual_home_score !== null ? p.points || 0 : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {predictions.length === 0 && (
                  <div className="text-center py-16 text-white/40 font-tajawal text-xl">
                    لا توجد توقعات بعد
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== تاب الصدارة ========== */}
          {activeTab === 'leaderboard' && (
            <div className="bg-zinc-900 rounded-3xl p-6 space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-center py-16 text-white/40 font-tajawal text-xl">لا توجد بيانات بعد</div>
              ) : leaderboard.map((player: any, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const name = player.user_email?.split('@')[0] || 'مجهول';
                return (
                  <div key={player.user_id}
                    className={`flex items-center gap-5 px-6 py-4 rounded-2xl border ${
                      index < 3 ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-800'
                    }`}>
                    <div className="w-10 text-center">
                      {index < 3 ? <span className="text-3xl">{medals[index]}</span> :
                        <span className="text-xl font-bold text-white/40">#{index + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className="font-tajawal font-bold text-lg">{name}</p>
                      <p className="text-white/40 text-sm font-tajawal">
                        {player.predictionCount} توقع · أفضل نتيجة: {player.bestPoints} نقطة
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-amber-600' : 'text-white'
                      }`}>{player.totalPoints}</p>
                      <p className="text-white/40 text-xs font-tajawal">نقطة</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* ========== Modal النتيجة ========== */}
      {showResultModal && selectedMatch && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}
          onClick={() => setShowResultModal(false)}
        >
          <div
            className="bg-zinc-800 rounded-3xl p-8 w-full max-w-lg mx-4 my-8 border border-red-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-center mb-6 font-tajawal">
              ⚽ {selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}
            </h2>

            <div className="space-y-5">

              {/* النتيجة */}
              <div>
                <label className="block text-white/60 mb-2 font-tajawal text-sm">النتيجة الفعلية</label>
                <div className="flex gap-4 items-center justify-center">
                  <div className="text-center">
                    <p className="text-white/50 text-xs mb-1 font-tajawal">{selectedMatch.teams.home.name}</p>
                    <input
                      type="number" min={0}
                      value={actualFormExtra.homeScore}
                      onChange={(e) => setActualFormExtra({ ...actualFormExtra, homeScore: Number(e.target.value) })}
                      className="w-20 text-center bg-white text-black text-4xl font-bold p-4 rounded-2xl"
                    />
                  </div>
                  <span className="text-3xl text-red-400 font-light">–</span>
                  <div className="text-center">
                    <p className="text-white/50 text-xs mb-1 font-tajawal">{selectedMatch.teams.away.name}</p>
                    <input
                      type="number" min={0}
                      value={actualFormExtra.awayScore}
                      onChange={(e) => setActualFormExtra({ ...actualFormExtra, awayScore: Number(e.target.value) })}
                      className="w-20 text-center bg-white text-black text-4xl font-bold p-4 rounded-2xl"
                    />
                  </div>
                </div>
              </div>

              {/* أول هدف */}
              <div>
                <label className="block text-white/60 mb-2 font-tajawal text-sm">⚽ أول هدف (اسم اللاعب)</label>
                <input
                  type="text"
                  value={actualFormExtra.firstScorer}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, firstScorer: e.target.value })}
                  className="w-full bg-zinc-700 text-white px-4 py-3 rounded-2xl font-tajawal border border-zinc-600 focus:border-red-500 outline-none"
                  placeholder="مثال: محمد صلاح"
                />
              </div>

              {/* وقت إضافي */}
              <div className="flex items-center gap-3 bg-zinc-700/50 px-4 py-3 rounded-2xl border border-zinc-600">
                <input
                  type="checkbox"
                  checked={actualFormExtra.wentExtraTime}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, wentExtraTime: e.target.checked })}
                  className="w-5 h-5 accent-red-600"
                />
                <label className="font-tajawal text-white/80">⏱️ الماتش راح لوقت إضافي؟</label>
              </div>

              {/* سؤال المفاجأة */}
              <div>
                <label className="block text-white/60 mb-2 font-tajawal text-sm">
                  ❓ سؤال المفاجأة <span className="text-white/30">(يظهر للمستخدمين عند التوقع)</span>
                </label>
                <input
                  type="text"
                  value={actualFormExtra.surpriseQuestion}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, surpriseQuestion: e.target.value })}
                  className="w-full bg-zinc-700 text-white px-4 py-3 rounded-2xl font-tajawal border border-zinc-600 focus:border-purple-500 outline-none"
                  placeholder="مثال: من هيكون أفضل لاعب في الماتش؟"
                />
              </div>

              {/* إجابة المفاجأة الصح */}
              <div>
                <label className="block text-white/60 mb-2 font-tajawal text-sm">
                  🎯 الإجابة الصحيحة للمفاجأة <span className="text-white/30">(+5 نقاط)</span>
                </label>
                <input
                  type="text"
                  value={actualFormExtra.surpriseAnswer}
                  onChange={(e) => setActualFormExtra({ ...actualFormExtra, surpriseAnswer: e.target.value })}
                  className="w-full bg-zinc-700 text-white px-4 py-3 rounded-2xl font-tajawal border border-zinc-600 focus:border-purple-500 outline-none"
                  placeholder="الإجابة الصحيحة"
                />
              </div>

              {/* نظام النقاط */}
              <div className="bg-zinc-900 rounded-2xl p-4 text-xs font-tajawal space-y-1 border border-zinc-700">
                <p className="text-white/50 mb-1 font-bold">نظام النقاط:</p>
                <p className="text-yellow-400">🏆 نتيجة كاملة = 10 نقاط</p>
                <p className="text-green-400">✅ فايز صح = 5 نقاط</p>
                <p className="text-blue-400">⚽ أول هدف = 3 نقاط</p>
                <p className="text-cyan-400">⏱️ وقت إضافي = 2 نقاط</p>
                <p className="text-purple-400">🎯 مفاجأة = 5 نقاط</p>
                <p className="text-white/30 mt-1">الحد الأقصى = 25 نقطة</p>
              </div>

              {/* أزرار */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 py-4 rounded-2xl font-tajawal font-bold bg-zinc-600 hover:bg-zinc-500 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={saveActualResult}
                  disabled={savingResult}
                  className="flex-1 py-4 rounded-2xl font-tajawal font-bold bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-all"
                >
                  {savingResult ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
