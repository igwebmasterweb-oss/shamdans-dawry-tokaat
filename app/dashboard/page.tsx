'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [formData, setFormData] = useState({ homeScore: 0, awayScore: 0, firstScorer: '', extraTime: false, surprise: '' });
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [activeTab, setActiveTab] = useState<'predictions' | 'leaderboard'>('predictions');
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const rounds = ['Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3'];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadPredictions(data.user.id);
      } else router.push('/login');
    });
    loadMatches();
    loadLeaderboard();
  }, [router]);

  // ✅ إصلاح 1 — يجيب كل الحقول من fixtures
  const loadMatches = async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];

      const { data: supabaseFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id, is_open, actual_home_score, actual_away_score, first_scorer, went_extra_time, surprise_answer');

      const supabaseMap = new Map(
        supabaseFixtures?.map((f: any) => [f.api_fixture_id, f]) || []
      );

      const merged = apiMatches.map((m: any) => {
        const sb = supabaseMap.get(m.fixture.id);
        return {
          ...m,
          is_open: sb ? sb.is_open : false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer: sb?.first_scorer ?? null,
          went_extra_time: sb?.went_extra_time ?? false,
          surprise_answer: sb?.surprise_answer ?? null,
        };
      });

      setMatches(merged);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadPredictions = async (userId: string) => {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });
    setPredictions(data || []);
    const sum = (data || []).reduce((acc: number, p: any) => acc + (p.points || 0), 0);
    setTotalPoints(sum);
  };

  // ✅ ليدربورد محسّن — يجيب اسم المستخدم كامل + عدد التوقعات + أفضل نتيجة
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
      .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
      .slice(0, 20);

    setLeaderboard(sorted);
  };

  const openPredictionModal = (match: any) => {
    setCurrentMatch(match);
    setFormData({ homeScore: 0, awayScore: 0, firstScorer: '', extraTime: false, surprise: '' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentMatch(null);
  };

  const submitPrediction = async () => {
    if (!currentMatch) return;
    const alreadyPredicted = predictions.find(p => p.fixture_id === currentMatch.fixture.id);
    if (alreadyPredicted) {
      alert('⚠️ سبق وتوقعت هذا الماتش!');
      closeModal();
      return;
    }
    const { error } = await supabase.from('predictions').insert({
      user_id: user.id,
      user_email: user.email,
      fixture_id: currentMatch.fixture.id,
      home_team: currentMatch.teams.home.name,
      away_team: currentMatch.teams.away.name,
      predicted_home_score: formData.homeScore,
      predicted_away_score: formData.awayScore,
      predicted_first_scorer: formData.firstScorer || 'غير محدد',
      predicted_extra_time: formData.extraTime,
      surprise_answer: formData.surprise || 'لا توجد مفاجأة',
      points: 0,
    });
    if (error) alert('خطأ: ' + error.message);
    else {
      alert('✅ التوقع اتسجل بنجاح!');
      closeModal();
      if (user) loadPredictions(user.id);
      loadLeaderboard();
    }
  };

  // ✅ إصلاح 2 — زرار التحديث يكال update-results فعلاً
  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/update-results');
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        if (user) await loadPredictions(user.id);
        await loadLeaderboard();
        await loadMatches();
      } else {
        alert('خطأ: ' + (data.error || 'حاول تاني'));
      }
    } catch {
      alert('خطأ في الاتصال بالسيرفر');
    }
    setUpdating(false);
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

  const displayName = user?.email ? user.email.split('@')[0] : 'مستخدم';
  const filteredMatches = matches.filter(m => m.league.round === activeRound);

  // حساب إحصائيات المستخدم
  const myCorrectResults = predictions.filter(p =>
    p.actual_home_score !== null &&
    p.predicted_home_score === p.actual_home_score &&
    p.predicted_away_score === p.actual_away_score
  ).length;
  const myRank = leaderboard.findIndex((p: any) => p.user_email === user?.email) + 1;

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-6xl">🏆</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">الشمعدان</h1>
              <span className="text-5xl font-bold text-white">×</span>
              <h1 className="text-5xl font-bold text-white font-tajawal">كأس العالم 2026</h1>
            </div>
            <div className="flex items-center gap-6">
              {user && (
                <div className="text-right">
                  <p className="text-white/70 text-lg">👤 {displayName}</p>
                  <p className="text-green-400 font-bold text-2xl">نقاطي: {totalPoints}</p>
                  {myRank > 0 && <p className="text-yellow-400 text-sm">المركز: #{myRank}</p>}
                </div>
              )}
              <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-3xl font-tajawal text-lg">
                تسجيل خروج
              </button>
            </div>
          </div>

          {/* إحصائيات سريعة للمستخدم */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">نقاطي الكلية</p>
              <p className="text-4xl font-bold text-green-400 mt-1">{totalPoints}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">عدد توقعاتي</p>
              <p className="text-4xl font-bold text-blue-400 mt-1">{predictions.length}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">نتائج صح</p>
              <p className="text-4xl font-bold text-yellow-400 mt-1">{myCorrectResults}</p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-5 text-center border border-zinc-700">
              <p className="text-white/50 text-sm font-tajawal">مركزي</p>
              <p className="text-4xl font-bold text-red-400 mt-1">{myRank > 0 ? `#${myRank}` : '-'}</p>
            </div>
          </div>

          {/* تبويبات الجولات */}
          <div className="flex gap-3 mb-8 flex-wrap">
            {rounds.map(round => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={`px-6 py-3 rounded-3xl font-tajawal text-lg font-bold transition-all ${
                  activeRound === round
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                }`}
              >
                {round === 'Group Stage - 1' ? 'الجولة الأولى' :
                 round === 'Group Stage - 2' ? 'الجولة الثانية' : 'الجولة الثالثة'}
                <span className="mr-2 text-sm opacity-70">
                  ({matches.filter(m => m.league.round === round).length})
                </span>
              </button>
            ))}
          </div>

          <h2 className="text-3xl font-tajawal mb-8">
            ماتشات {activeRound === 'Group Stage - 1' ? 'الجولة الأولى' :
            activeRound === 'Group Stage - 2' ? 'الجولة الثانية' : 'الجولة الثالثة'}
            <span className="text-white/50 text-xl mr-3">({filteredMatches.length} ماتش)</span>
          </h2>

          {/* الماتشات */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredMatches.map((match) => {
              const alreadyPredicted = predictions.find(p => p.fixture_id === match.fixture.id);
              const hasResult =
                match.actual_home_score !== null && match.actual_home_score !== undefined &&
                match.actual_away_score !== null && match.actual_away_score !== undefined;

              // ✅ حساب نقاط التوقع على الماتش ده
              let predPoints = null;
              if (alreadyPredicted && hasResult) {
                predPoints = alreadyPredicted.points || 0;
              }

              return (
                <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 hover:border-red-600 transition-all">
                  <div className="flex justify-between items-center text-center mb-2">
                    <div className="flex-1"><p className="font-tajawal text-2xl">{match.teams.home.name}</p></div>
                    <div className="px-10"><span className="text-sm text-white/50">VS</span></div>
                    <div className="flex-1"><p className="font-tajawal text-2xl">{match.teams.away.name}</p></div>
                  </div>

                  <p className="text-center text-white/40 text-sm mb-3">
                    {new Date(match.fixture.date).toLocaleDateString('ar-EG', {
                      weekday: 'long', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>

                  {/* ✅ النتيجة الفعلية مع تفاصيل */}
                  {hasResult && (
                    <div className="bg-green-900/30 border border-green-500/30 rounded-2xl p-4 mb-4 text-center space-y-1">
                      <p className="text-green-400 font-bold text-2xl">
                        النتيجة: {match.actual_home_score} - {match.actual_away_score}
                      </p>
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

                  {/* ✅ النقاط لو توقّع وعنده نتيجة */}
                  {predPoints !== null && (
                    <div className={`text-center mb-3 px-4 py-2 rounded-2xl text-lg font-bold font-tajawal
                      ${predPoints >= 10 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        predPoints >= 5 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        'bg-zinc-700 text-white/60 border border-zinc-600'}`}>
                      {predPoints >= 10 ? '🏆' : predPoints >= 5 ? '✅' : '❌'} كسبت {predPoints} نقطة
                    </div>
                  )}

                  {/* زرار التوقع */}
                  {!match.is_open ? (
                    <div className="mt-2 w-full bg-zinc-800 text-white/40 font-bold py-5 rounded-3xl text-xl font-tajawal text-center border border-zinc-700">
                      🔒 التوقعات مغلقة
                    </div>
                  ) : alreadyPredicted ? (
                    <div className="mt-2 w-full bg-zinc-700 text-white/70 font-bold py-5 rounded-3xl text-xl font-tajawal text-center">
                      ✅ توقعت: {alreadyPredicted.predicted_home_score} - {alreadyPredicted.predicted_away_score}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPredictionModal(match)}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-3xl text-2xl font-tajawal transition-all"
                    >
                      توقع نتيجة الماتش 🔥
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* تابز: توقعاتي / لوحة الصدارة */}
          <div className="flex gap-3 mt-16 mb-6">
            <button
              onClick={() => setActiveTab('predictions')}
              className={`px-8 py-4 rounded-3xl font-tajawal text-xl font-bold transition-all ${
                activeTab === 'predictions' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
              }`}
            >
              📋 توقعاتي ({predictions.length})
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-8 py-4 rounded-3xl font-tajawal text-xl font-bold transition-all ${
                activeTab === 'leaderboard' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
              }`}
            >
              🏆 لوحة الصدارة ({leaderboard.length})
            </button>
            <button
              onClick={updateAllPoints}
              disabled={updating}
              className="mr-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 rounded-3xl font-tajawal text-lg font-bold flex items-center gap-2"
            >
              {updating ? '⏳ جاري التحديث...' : '🔄 تحديث النتائج والنقاط'}
            </button>
          </div>

          {/* توقعاتي */}
          {activeTab === 'predictions' && (
            <div className="bg-zinc-900 rounded-3xl p-8 space-y-6">
              {predictions.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-6xl mb-4">⚽</p>
                  <p className="text-white/60 font-tajawal text-xl">لم تقم بأي توقع بعد</p>
                  <p className="text-white/40 font-tajawal mt-2">افتح أي ماتش وتوقع النتيجة!</p>
                </div>
              ) : (
                predictions.map((p) => {
                  const hasActual = p.actual_home_score !== null && p.actual_home_score !== undefined;
                  const isExactResult = hasActual &&
                    p.predicted_home_score === p.actual_home_score &&
                    p.predicted_away_score === p.actual_away_score;
                  return (
                    <div key={p.id} className={`p-6 rounded-3xl border transition-all ${
                      isExactResult ? 'border-yellow-500/40 bg-yellow-900/10' :
                      hasActual && p.points > 0 ? 'border-green-500/30 bg-green-900/10' :
                      hasActual ? 'border-red-500/20 bg-red-900/5' :
                      'border-white/10'
                    }`}>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <p className="font-tajawal text-2xl font-bold">{p.home_team} × {p.away_team}</p>
                          <div className="flex gap-4 mt-2 flex-wrap text-sm text-white/60">
                            <span>⚽ {p.predicted_first_scorer}</span>
                            <span>⏱️ {p.predicted_extra_time ? 'وقت إضافي' : 'بدون وقت إضافي'}</span>
                            <span>🎯 {p.surprise_answer}</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-white/50 text-xs font-tajawal mb-1">توقعي</p>
                          <span className="text-4xl font-bold">
                            {p.predicted_home_score} - {p.predicted_away_score}
                          </span>
                        </div>

                        {hasActual && (
                          <div className="text-center">
                            <p className="text-white/50 text-xs font-tajawal mb-1">النتيجة الفعلية</p>
                            <span className="text-4xl font-bold text-green-400">
                              {p.actual_home_score} - {p.actual_away_score}
                            </span>
                          </div>
                        )}

                        <div className="text-center">
                          <span className={`px-5 py-3 rounded-3xl font-bold text-xl ${
                            isExactResult ? 'bg-yellow-500 text-black' :
                            p.points > 0 ? 'bg-green-600 text-white' :
                            hasActual ? 'bg-zinc-700 text-white/60' :
                            'bg-zinc-800 text-white/40'
                          }`}>
                            {hasActual ? `${p.points || 0} نقطة` : '⏳ انتظار'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ✅ لوحة الصدارة المحسّنة */}
          {activeTab === 'leaderboard' && (
            <div className="bg-zinc-900 rounded-3xl p-8">
              {leaderboard.length === 0 ? (
                <p className="text-white/60 text-center py-12 font-tajawal text-xl">لا توجد بيانات بعد</p>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((player: any, index) => {
                    const playerName = player.user_email ? player.user_email.split('@')[0] : 'مجهول';
                    const isMe = player.user_email === user?.email;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div
                        key={player.user_id}
                        className={`flex items-center gap-6 py-5 px-6 rounded-3xl border transition-all ${
                          isMe
                            ? 'bg-red-900/20 border-red-500/50'
                            : index < 3
                            ? 'bg-zinc-800 border-zinc-600'
                            : 'border-white/5'
                        }`}
                      >
                        {/* المركز */}
                        <div className="text-center w-12">
                          {index < 3 ? (
                            <span className="text-4xl">{medals[index]}</span>
                          ) : (
                            <span className="text-2xl font-bold text-white/50">#{index + 1}</span>
                          )}
                        </div>

                        {/* الاسم */}
                        <div className="flex-1">
                          <p className={`font-tajawal text-xl font-bold ${isMe ? 'text-red-400' : 'text-white'}`}>
                            {playerName} {isMe && '(أنت)'}
                          </p>
                          <p className="text-white/40 text-sm font-tajawal">
                            {player.predictionCount} توقع — أفضل نتيجة: {player.bestPoints} نقطة
                          </p>
                        </div>

                        {/* النقاط */}
                        <div className="text-right">
                          <span className={`text-3xl font-bold ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-zinc-300' :
                            index === 2 ? 'text-amber-600' :
                            'text-white'
                          }`}>
                            {player.totalPoints}
                          </span>
                          <p className="text-white/40 text-sm font-tajawal">نقطة</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Modal التوقع */}
      {showModal && currentMatch && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}
          onClick={closeModal}
        >
          <div
            className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 my-8 shadow-2xl border border-red-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-6 font-tajawal">
              {currentMatch.teams.home.name} × {currentMatch.teams.away.name}
            </h2>

            {/* نظام النقاط */}
            <div className="bg-zinc-800 rounded-2xl p-4 mb-6 text-sm font-tajawal space-y-1">
              <p className="text-white/60 font-bold mb-1">نظام النقاط:</p>
              <p className="text-yellow-400">🏆 نتيجة كاملة = 10 نقاط</p>
              <p className="text-green-400">✅ فايز صح = 5 نقاط</p>
              <p className="text-blue-400">⚽ أول هدف صح = 3 نقاط</p>
              <p className="text-purple-400">⏱️ وقت إضافي صح = 2 نقاط</p>
              <p className="text-pink-400">🎯 مفاجأة صح = 5 نقاط</p>
              <p className="text-white/30 mt-1">أقصى نقاط = 25 نقطة</p>
            </div>

            <div className="space-y-6">
              {/* النتيجة */}
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{currentMatch.teams.home.name}</p>
                  <input
                    type="number" min={0}
                    value={formData.homeScore}
                    onChange={(e) => setFormData({ ...formData, homeScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
                <div className="text-6xl font-light mt-14" style={{ color: '#f87171' }}>–</div>
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{currentMatch.teams.away.name}</p>
                  <input
                    type="number" min={0}
                    value={formData.awayScore}
                    onChange={(e) => setFormData({ ...formData, awayScore: Number(e.target.value) })}
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl"
                    style={{ color: '#111111', fontWeight: '700' }}
                  />
                </div>
              </div>

              {/* أول هدف */}
              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">
                  ⚽ من هيسجل أول هدف؟ (+3 نقاط)
                </label>
                <input
                  type="text"
                  value={formData.firstScorer}
                  onChange={(e) => setFormData({ ...formData, firstScorer: e.target.value })}
                  className="w-full bg-white text-black px-6 py-5 rounded-3xl text-lg font-tajawal"
                  style={{ color: '#111111', fontWeight: '600' }}
                  placeholder="مثال: صلاح"
                />
              </div>

              {/* وقت إضافي */}
              <div className="flex items-center gap-4 bg-zinc-800 px-6 py-4 rounded-3xl">
                <input
                  type="checkbox"
                  checked={formData.extraTime}
                  onChange={(e) => setFormData({ ...formData, extraTime: e.target.checked })}
                  className="w-6 h-6 accent-red-600"
                />
                <label style={{ color: '#ffffff', fontWeight: '600' }} className="font-tajawal text-lg">
                  ⏱️ هيروح وقت إضافي؟ (+2 نقاط)
                </label>
              </div>

              {/* ✅ إصلاح 3 — سؤال المفاجأة من الـ fixture */}
              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">
                  🎯 {currentMatch.surprise_answer
                    ? `مفاجأة الجولة: ${currentMatch.surprise_answer}`
                    : 'مفاجأة الجولة (+5 نقاط)'}
                </label>
                <input
                  type="text"
                  value={formData.surprise}
                  onChange={(e) => setFormData({ ...formData, surprise: e.target.value })}
                  className="w-full bg-white text-black px-6 py-5 rounded-3xl text-lg font-tajawal"
                  style={{ color: '#111111', fontWeight: '600' }}
                  placeholder="اكتب إجابتك"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-5 rounded-3xl font-tajawal text-xl"
                  style={{ color: '#111111', fontWeight: '700', backgroundColor: '#ffffff' }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitPrediction}
                  className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal"
                  style={{ color: '#111111', fontWeight: '700', backgroundColor: '#f87171' }}
                >
                  حفظ التوقع 🔥
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
