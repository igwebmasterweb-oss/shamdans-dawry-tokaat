'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['i.g.webmaster.web@gmail.com'];

export default function AdminPage() {
  const [user, setUser]               = useState<any>(null);
  const [matches, setMatches]         = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'matches' | 'predictions' | 'leaderboard'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [updating, setUpdating]       = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [message, setMessage]         = useState('');

  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedMatch, setSelectedMatch]     = useState<any>(null);
  const [actualForm, setActualForm] = useState({
    homeScore:       0,
    awayScore:       0,
    firstScorer:     '',
    wentExtraTime:   false,
    surpriseAnswer:  '',
    surpriseQuestion: '',
  });
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

      const { data: sbFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id, is_open, actual_home_score, actual_away_score, first_scorer, went_extra_time, surprise_answer, surprise_question');

      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);

      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open:           sb?.is_open           ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer:      sb?.first_scorer      ?? '',
          went_extra_time:   sb?.went_extra_time   ?? false,
          surprise_answer:   sb?.surprise_answer   ?? '',
          surprise_question: sb?.surprise_question ?? '',
        };
      });

      setMatches(merged);
    } catch (err) { console.error(err); }
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
        grouped[row.user_id] = { user_id: row.user_id, user_email: row.user_email, totalPoints: 0, predictionCount: 0, bestPoints: 0 };
      }
      grouped[row.user_id].totalPoints     += row.points || 0;
      grouped[row.user_id].predictionCount += 1;
      if ((row.points || 0) > grouped[row.user_id].bestPoints) {
        grouped[row.user_id].bestPoints = row.points || 0;
      }
    });
    setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.totalPoints - a.totalPoints));
  };

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open;
    const fixtureId = match.fixture.id;
    const { data: existing } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fixtureId).single();
    if (existing) {
      await supabase.from('fixtures').update({ is_open: newStatus }).eq('api_fixture_id', fixtureId);
    } else {
      await supabase.from('fixtures').insert({
        api_fixture_id: fixtureId,
        is_open:   newStatus,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        match_date: match.fixture.date,
        round:     match.league.round,
      });
    }
    await loadMatches();
    showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setActualForm({
      homeScore:        match.actual_home_score   ?? 0,
      awayScore:        match.actual_away_score   ?? 0,
      firstScorer:      match.first_scorer        ?? '',
      wentExtraTime:    match.went_extra_time      ?? false,
      surpriseAnswer:   match.surprise_answer     ?? '',
      surpriseQuestion: match.surprise_question   ?? '',
    });
    setShowResultModal(true);
  };

  const saveActualResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fixtureId = selectedMatch.fixture.id;
    const { data: existing } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fixtureId).single();
    const payload = {
      actual_home_score: actualForm.homeScore,
      actual_away_score: actualForm.awayScore,
      first_scorer:      actualForm.firstScorer      || null,
      went_extra_time:   actualForm.wentExtraTime,
      surprise_answer:   actualForm.surpriseAnswer   || null,
      surprise_question: actualForm.surpriseQuestion || null,
    };
    if (existing) {
      await supabase.from('fixtures').update(payload).eq('api_fixture_id', fixtureId);
    } else {
      await supabase.from('fixtures').insert({
        api_fixture_id: fixtureId,
        is_open:   false,
        home_team: selectedMatch.teams.home.name,
        away_team: selectedMatch.teams.away.name,
        match_date: selectedMatch.fixture.date,
        round:     selectedMatch.league.round,
        ...payload,
      });
    }
    setShowResultModal(false);
    await loadMatches();
    setSavingResult(false);
    showMsg('✅ تم حفظ النتيجة بنجاح');
  };

  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/update-results');
      const data = await res.json();
      showMsg(data.success ? data.message : '❌ خطأ: ' + data.error);
      if (data.success) { await loadAllPredictions(); await loadLeaderboard(); }
    } catch { showMsg('❌ خطأ في الاتصال'); }
    setUpdating(false);
  };

  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count || ''} ماتش` : '❌ ' + data.error);
      await loadMatches();
    } catch { showMsg('❌ خطأ في المزامنة'); }
    setSyncing(false);
  };

  const openAllMatches = async () => {
    setUpdating(true);
    const filtered = matches.filter((m) => m.league.round === activeRound);
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
    } catch { showMsg('❌ خطأ في الغلق'); }
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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white text-2xl">جاري التحميل...</p>
    </div>
  );

  const filteredMatches    = matches.filter((m) => m.league.round === activeRound);
  const totalPredictions   = predictions.length;
  const gradedPredictions  = predictions.filter((p) => p.actual_home_score !== null).length;
  const openMatches        = matches.filter((m) => m.is_open).length;

  return (
    <>
      <main className="min-h-screen bg-black text-white" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-8 space-y-6">

          {/* Header */}
          <header className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl sm:text-5xl">⚙️</span>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-bold text-red-600">لوحة التحكم</h1>
                  <p className="text-white/50 text-sm">كأس العالم 2026 — الشمعدان</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
                <button onClick={syncFixtures} disabled={syncing}
                  className="min-h-[46px] bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                  {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الماتشات'}
                </button>
                <button onClick={updateAllPoints} disabled={updating}
                  className="min-h-[46px] bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                  {updating ? '⏳ تحديث...' : '⚡ تحديث النقاط'}
                </button>
                <button onClick={handleLogout}
                  className="min-h-[46px] col-span-2 sm:col-span-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                  خروج
                </button>
              </div>
            </div>
          </header>

          {/* Message */}
          {message && (
            <div className="bg-zinc-800 border border-zinc-600 px-5 py-4 rounded-2xl text-center text-sm sm:text-lg">
              {message}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'إجمالي التوقعات', value: totalPredictions,  color: 'text-blue-400'   },
              { label: 'توقعات محسوبة',   value: gradedPredictions, color: 'text-green-400'  },
              { label: 'ماتشات مفتوحة',   value: openMatches,       color: 'text-yellow-400' },
              { label: 'عدد المتسابقين',  value: leaderboard.length, color: 'text-red-400'   },
            ].map((card) => (
              <div key={card.label} className="bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-800 p-4 sm:p-5 text-center">
                <p className="text-white/50 text-xs sm:text-sm">{card.label}</p>
                <p className={`mt-2 text-3xl sm:text-4xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {(['matches', 'predictions', 'leaderboard'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`shrink-0 min-h-[46px] px-5 py-2 rounded-2xl text-sm sm:text-base font-bold transition-colors ${
                  activeTab === tab ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                }`}>
                {tab === 'matches'     ? `🏟️ الماتشات (${matches.length})`        :
                 tab === 'predictions' ? `📋 التوقعات (${totalPredictions})`       :
                 `🏆 الصدارة (${leaderboard.length})`}
              </button>
            ))}
          </div>

          {/* ===== MATCHES TAB ===== */}
          {activeTab === 'matches' && (
            <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {rounds.map((round) => (
                    <button key={round} onClick={() => setActiveRound(round)}
                      className={`shrink-0 min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
                        activeRound === round ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                      }`}>
                      {round === 'Group Stage - 1' ? 'الجولة الأولى' :
                       round === 'Group Stage - 2' ? 'الجولة الثانية' : 'الجولة الثالثة'}
                      <span className="mr-1 text-xs opacity-50">({matches.filter((m) => m.league.round === round).length})</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <button onClick={openAllMatches} disabled={updating}
                    className="min-h-[44px] bg-green-800 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                    🟢 فتح الكل
                  </button>
                  <button onClick={closeAllMatches} disabled={updating}
                    className="min-h-[44px] bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                    🔒 غلق الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredMatches.map((match) => {
                  const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
                  const matchPreds = predictions.filter((p) => p.fixture_id === match.fixture.id);
                  return (
                    <article key={match.fixture.id}
                      className={`bg-zinc-950 rounded-2xl sm:rounded-3xl border p-4 sm:p-5 ${
                        match.is_open ? 'border-green-500/35' : 'border-zinc-700/60'
                      }`}>
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-base sm:text-xl font-bold truncate">
                            {match.teams.home.name} <span className="text-white/25">×</span> {match.teams.away.name}
                          </p>
                          <p className="text-white/40 text-xs mt-1">
                            {new Date(match.fixture.date).toLocaleDateString('ar-EG', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                          match.is_open ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-white/40'
                        }`}>
                          {match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}
                        </span>
                      </div>

                      {hasResult && (
                        <div className="bg-green-900/20 border border-green-500/20 rounded-2xl px-4 py-3 mb-3 space-y-1">
                          <p className="text-green-400 font-bold text-base sm:text-lg text-center">
                            النتيجة: {match.actual_home_score} - {match.actual_away_score}
                          </p>
                          {match.first_scorer && (
                            <p className="text-yellow-400 text-xs text-center">⚽ أول هدف: {match.first_scorer}</p>
                          )}
                          <p className="text-blue-400 text-xs text-center">
                            ⏱️ وقت إضافي: {match.went_extra_time ? 'نعم' : 'لا'}
                          </p>
                          {match.surprise_question && (
                            <p className="text-purple-300 text-xs text-center">❓ {match.surprise_question}</p>
                          )}
                          {match.surprise_answer && (
                            <p className="text-purple-400 text-xs text-center">🎯 الإجابة: {match.surprise_answer}</p>
                          )}
                        </div>
                      )}

                      {matchPreds.length > 0 && (
                        <p className="text-white/40 text-xs mb-3">👥 {matchPreds.length} توقع مسجّل</p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => toggleMatchOpen(match)}
                          className={`min-h-[46px] rounded-2xl font-bold text-xs sm:text-sm transition-colors ${
                            match.is_open
                              ? 'bg-zinc-700 hover:bg-zinc-600 text-white/70'
                              : 'bg-green-700 hover:bg-green-600 text-white'
                          }`}>
                          {match.is_open ? '🔒 غلق التوقعات' : '🟢 فتح التوقعات'}
                        </button>
                        <button onClick={() => openResultModal(match)}
                          className="min-h-[46px] rounded-2xl font-bold text-xs sm:text-sm bg-red-700 hover:bg-red-600 transition-colors">
                          {hasResult ? '✏️ تعديل النتيجة' : '⚽ إدخال النتيجة'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===== PREDICTIONS TAB ===== */}
          {activeTab === 'predictions' && (
            <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-700 text-white/45">
                      <th className="text-right py-3 px-3">المستخدم</th>
                      <th className="text-right py-3 px-3">الماتش</th>
                      <th className="text-center py-3 px-3">توقعي</th>
                      <th className="text-center py-3 px-3">الفعلية</th>
                      <th className="text-center py-3 px-3">أول هدف</th>
                      <th className="text-center py-3 px-3">إضافي</th>
                      <th className="text-center py-3 px-3">مفاجأة</th>
                      <th className="text-center py-3 px-3">النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="py-3 px-3 text-white/65">{p.user_email?.split('@')[0]}</td>
                        <td className="py-3 px-3 max-w-[160px] truncate">{p.home_team} × {p.away_team}</td>
                        <td className="py-3 px-3 text-center font-bold">{p.predicted_home_score} - {p.predicted_away_score}</td>
                        <td className="py-3 px-3 text-center text-green-400">
                          {p.actual_home_score !== null ? `${p.actual_home_score} - ${p.actual_away_score}` : '⏳'}
                        </td>
                        <td className="py-3 px-3 text-center text-yellow-400">{p.predicted_first_scorer || '-'}</td>
                        <td className="py-3 px-3 text-center text-blue-400">{p.predicted_extra_time ? 'نعم' : 'لا'}</td>
                        <td className="py-3 px-3 text-center text-purple-400 max-w-[100px] truncate">{p.surprise_answer || '-'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded-full font-bold text-xs ${
                            p.points >= 10 ? 'bg-yellow-500/20 text-yellow-400' :
                            p.points >= 5  ? 'bg-green-500/20 text-green-400'  :
                            p.actual_home_score !== null ? 'bg-zinc-700 text-white/45' :
                            'bg-zinc-800 text-white/25'
                          }`}>
                            {p.actual_home_score !== null ? p.points || 0 : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {predictions.length === 0 && (
                  <div className="py-16 text-center text-white/40 text-lg">لا توجد توقعات بعد</div>
                )}
              </div>
            </section>
          )}

          {/* ===== LEADERBOARD TAB ===== */}
          {activeTab === 'leaderboard' && (
            <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6 space-y-3">
              {leaderboard.length === 0 ? (
                <div className="py-16 text-center text-white/40 text-lg">لا توجد بيانات بعد</div>
              ) : leaderboard.map((player: any, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={player.user_id}
                    className={`flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-4 rounded-2xl sm:rounded-3xl border ${
                      index < 3 ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-800'
                    }`}>
                    <div className="w-9 sm:w-10 text-center shrink-0">
                      {index < 3
                        ? <span className="text-2xl sm:text-3xl">{medals[index]}</span>
                        : <span className="text-sm sm:text-lg font-bold text-white/40">#{index + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-lg truncate">{player.user_email?.split('@')[0]}</p>
                      <p className="text-white/40 text-xs">{player.predictionCount} توقع · أفضل: {player.bestPoints} نقطة</p>
                    </div>
                    <div className="shrink-0">
                      <p className={`text-xl sm:text-2xl font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-zinc-300'   :
                        index === 2 ? 'text-amber-600'  : 'text-white'
                      }`}>{player.totalPoints}</p>
                      <p className="text-white/40 text-xs">نقطة</p>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

        </div>
      </main>

      {/* ===== RESULT MODAL ===== */}
      {showResultModal && selectedMatch && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/92"
          onClick={() => setShowResultModal(false)}
        >
          <div
            className="w-full max-w-lg mx-0 sm:mx-4 rounded-t-[28px] sm:rounded-[28px] border border-red-500/30 bg-zinc-800 shadow-2xl max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-800 px-5 pt-5 pb-4 border-b border-zinc-700/60">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold break-words">
                  ⚽ {selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}
                </h2>
                <button
                  onClick={() => setShowResultModal(false)}
                  className="shrink-0 min-h-[44px] min-w-[44px] rounded-full bg-white/10 text-xl text-white/70 hover:bg-white/20 flex items-center justify-center"
                >×</button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Score */}
              <div>
                <label className="block text-white/60 mb-3 text-sm">النتيجة الفعلية</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'homeScore', team: selectedMatch.teams.home.name },
                    { key: 'awayScore', team: selectedMatch.teams.away.name },
                  ].map(({ key, team }) => (
                    <div key={key} className="text-center">
                      <p className="text-white/50 text-xs mb-2 truncate">{team}</p>
                      <input
                        type="number" min={0}
                        value={(actualForm as any)[key]}
                        onChange={(e) => setActualForm({ ...actualForm, [key]: Number(e.target.value) })}
                        className="h-20 w-full rounded-2xl bg-white text-black text-4xl font-bold text-center outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* First scorer */}
              <div>
                <label className="block text-white/60 mb-2 text-sm">⚽ أول هدف</label>
                <input type="text"
                  value={actualForm.firstScorer}
                  onChange={(e) => setActualForm({ ...actualForm, firstScorer: e.target.value })}
                  className="w-full min-h-[52px] bg-zinc-700 text-white px-4 py-3 rounded-2xl border border-zinc-600 focus:border-red-500 outline-none"
                  placeholder="مثال: محمد صلاح"
                />
              </div>

              {/* Extra time */}
              <label className="flex items-center gap-3 min-h-[52px] bg-zinc-700/50 px-4 py-3 rounded-2xl border border-zinc-600 cursor-pointer">
                <input type="checkbox"
                  checked={actualForm.wentExtraTime}
                  onChange={(e) => setActualForm({ ...actualForm, wentExtraTime: e.target.checked })}
                  className="w-5 h-5 accent-red-600 shrink-0"
                />
                <span className="text-white/80 text-sm sm:text-base">⏱️ الماتش راح لوقت إضافي؟</span>
              </label>

              {/* Surprise question */}
              <div>
                <label className="block text-white/60 mb-2 text-sm">
                  ❓ سؤال المفاجأة <span className="text-white/30">(يظهر للمستخدمين)</span>
                </label>
                <input type="text"
                  value={actualForm.surpriseQuestion}
                  onChange={(e) => setActualForm({ ...actualForm, surpriseQuestion: e.target.value })}
                  className="w-full min-h-[52px] bg-zinc-700 text-white px-4 py-3 rounded-2xl border border-zinc-600 focus:border-purple-500 outline-none"
                  placeholder="مثال: من هيكون أفضل لاعب؟"
                />
              </div>

              {/* Surprise answer */}
              <div>
                <label className="block text-white/60 mb-2 text-sm">
                  🎯 الإجابة الصحيحة <span className="text-white/30">(+5 نقاط)</span>
                </label>
                <input type="text"
                  value={actualForm.surpriseAnswer}
                  onChange={(e) => setActualForm({ ...actualForm, surpriseAnswer: e.target.value })}
                  className="w-full min-h-[52px] bg-zinc-700 text-white px-4 py-3 rounded-2xl border border-zinc-600 focus:border-purple-500 outline-none"
                  placeholder="الإجابة الصحيحة"
                />
              </div>

              {/* Points ref */}
              <div className="bg-zinc-900 rounded-2xl p-4 text-xs space-y-1 border border-zinc-700/60">
                <p className="text-white/50 font-bold mb-1">نظام النقاط:</p>
                <p className="text-yellow-400">🏆 نتيجة كاملة = 10 نقاط</p>
                <p className="text-green-400">✅ فايز صح = 5 نقاط</p>
                <p className="text-blue-400">⚽ أول هدف = 3 نقاط</p>
                <p className="text-cyan-400">⏱️ وقت إضافي = 2 نقاط</p>
                <p className="text-purple-400">🎯 مفاجأة = 5 نقاط</p>
                <p className="text-white/30 mt-1">الحد الأقصى = 25 نقطة</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2">
                <button onClick={saveActualResult} disabled={savingResult}
                  className="min-h-[52px] rounded-2xl font-bold text-sm sm:text-base bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors">
                  {savingResult ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة'}
                </button>
                <button onClick={() => setShowResultModal(false)}
                  className="min-h-[52px] rounded-2xl font-bold text-sm sm:text-base bg-zinc-600 hover:bg-zinc-500 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
