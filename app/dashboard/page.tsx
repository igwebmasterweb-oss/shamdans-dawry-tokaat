'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser]               = useState<any>(null);
  const [matches, setMatches]         = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'predict' | 'my' | 'leaders'>('predict');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [predForms, setPredForms]     = useState<Record<number, any>>({});
  const [submitting, setSubmitting]   = useState<number | null>(null);
  const [messages, setMessages]       = useState<Record<number, string>>({});

  const router = useRouter();
  const rounds = ['Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3'];
  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      loadData(data.user.id);
    });
  }, [router]);

  const loadData = async (userId: string) => {
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
          is_open:            sb?.is_open            ?? false,
          actual_home_score:  sb?.actual_home_score  ?? null,
          actual_away_score:  sb?.actual_away_score  ?? null,
          first_scorer:       sb?.first_scorer       ?? '',
          went_extra_time:    sb?.went_extra_time     ?? false,
          surprise_answer:    sb?.surprise_answer    ?? '',
          surprise_question:  sb?.surprise_question  ?? '',
        };
      });

      setMatches(merged);

      const { data: userPreds } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId);
      setPredictions(userPreds || []);

      const { data: allPreds } = await supabase
        .from('predictions')
        .select('user_id, user_email, points');

      const grouped: any = {};
      allPreds?.forEach((row: any) => {
        if (!grouped[row.user_id]) {
          grouped[row.user_id] = { user_id: row.user_id, user_email: row.user_email, totalPoints: 0, count: 0 };
        }
        grouped[row.user_id].totalPoints += row.points || 0;
        grouped[row.user_id].count += 1;
      });
      setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.totalPoints - a.totalPoints));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const existing = predictions.find((p) => p.fixture_id === match.fixture.id);
    return {
      homeScore:      existing?.predicted_home_score  ?? 0,
      awayScore:      existing?.predicted_away_score  ?? 0,
      firstScorer:    existing?.predicted_first_scorer ?? '',
      extraTime:      existing?.predicted_extra_time  ?? false,
      surpriseAnswer: existing?.surprise_answer       ?? '',
    };
  };

  const setForm = (fixtureId: number, patch: any) => {
    setPredForms((prev) => ({
      ...prev,
      [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch },
    }));
  };

  const submitPrediction = async (match: any) => {
    if (!user) return;
    setSubmitting(match.fixture.id);
    const form = getForm(match);
    try {
      const existing = predictions.find((p) => p.fixture_id === match.fixture.id);
      const payload = {
        user_id:                 user.id,
        user_email:              user.email,
        fixture_id:              match.fixture.id,
        home_team:               match.teams.home.name,
        away_team:               match.teams.away.name,
        predicted_home_score:    form.homeScore,
        predicted_away_score:    form.awayScore,
        predicted_first_scorer:  form.firstScorer || null,
        predicted_extra_time:    form.extraTime,
        surprise_answer:         form.surpriseAnswer || null,
        submitted_at:            new Date().toISOString(),
        points:                  existing?.points ?? 0,
        actual_home_score:       null,
        actual_away_score:       null,
      };

      if (existing) {
        await supabase.from('predictions').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('predictions').insert(payload);
      }

      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      setPredictions(data || []);
      setMessages((m) => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages((m) => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch {
      setMessages((m) => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' }));
    }
    setSubmitting(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white text-2xl">جاري التحميل...</p>
    </div>
  );

  const myPoints = predictions.reduce((s, p) => s + (p.points || 0), 0);
  const myRank   = leaderboard.findIndex((p) => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter((m) => m.league.round === activeRound);

  return (
    <main className="min-h-screen bg-black text-white" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6 sm:py-8 space-y-6">

        {/* Header */}
        <header className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl">🏆</span>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-red-600 leading-tight">
                  الشمعدان × كأس العالم
                </h1>
                <p className="text-white/50 text-xs sm:text-sm mt-0.5">
                  أهلاً {user?.email?.split('@')[0]}! 👋
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex gap-3 bg-zinc-800 rounded-2xl px-4 py-2">
                <div className="text-center">
                  <p className="text-yellow-400 font-bold text-lg sm:text-2xl">{myPoints}</p>
                  <p className="text-white/40 text-xs">نقطة</p>
                </div>
                {myRank > 0 && (
                  <>
                    <div className="w-px bg-zinc-700" />
                    <div className="text-center">
                      <p className="text-green-400 font-bold text-lg sm:text-2xl">#{myRank}</p>
                      <p className="text-white/40 text-xs">ترتيب</p>
                    </div>
                  </>
                )}
              </div>
              <button onClick={handleLogout}
                className="min-h-[46px] bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-colors">
                خروج
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(['predict', 'my', 'leaders'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`shrink-0 min-h-[46px] px-5 py-2 rounded-2xl text-sm sm:text-base font-bold transition-colors ${
                activeTab === tab ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
              }`}>
              {tab === 'predict' ? '⚽ التوقعات' : tab === 'my' ? '📋 توقعاتي' : '🏆 الصدارة'}
            </button>
          ))}
        </div>

        {/* ===== PREDICT TAB ===== */}
        {activeTab === 'predict' && (
          <section className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {rounds.map((round) => (
                <button key={round} onClick={() => setActiveRound(round)}
                  className={`shrink-0 min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
                    activeRound === round ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'
                  }`}>
                  {roundLabels[round]}
                  <span className="mr-1 text-xs opacity-50">
                    ({matches.filter((m) => m.league.round === round).length})
                  </span>
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <div className="py-16 text-center text-white/40 bg-zinc-900 rounded-3xl border border-zinc-800">
                لا توجد ماتشات في هذه الجولة
              </div>
            ) : filteredMatches.map((match) => {
              const existing = predictions.find((p) => p.fixture_id === match.fixture.id);
              const form     = getForm(match);
              const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const msg      = messages[match.fixture.id];

              return (
                <article key={match.fixture.id}
                  className={`bg-zinc-900 rounded-3xl border p-4 sm:p-6 space-y-4 ${
                    !match.is_open ? 'border-zinc-700/50' :
                    existing       ? 'border-green-500/35' :
                    'border-red-500/35'
                  }`}>

                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base sm:text-xl font-bold">
                        {match.teams.home.name} <span className="text-white/30">×</span> {match.teams.away.name}
                      </h2>
                      <p className="text-white/40 text-xs mt-1">
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG', {
                          weekday: 'long', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        match.is_open ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-white/40'
                      }`}>
                        {match.is_open ? '🟢 مفتوح' : '🔒 مغلق'}
                      </span>
                      {existing && <span className="text-xs text-green-400">✅ محفوظ</span>}
                    </div>
                  </div>

                  {hasResult && (
                    <div className="bg-green-900/20 border border-green-500/20 rounded-2xl px-4 py-3 text-center space-y-1">
                      <p className="text-green-400 font-bold text-base sm:text-xl">
                        النتيجة: {match.actual_home_score} - {match.actual_away_score}
                      </p>
                      {match.first_scorer && (
                        <p className="text-yellow-400 text-xs">⚽ أول هدف: {match.first_scorer}</p>
                      )}
                      {existing && (
                        <p className="text-white font-bold">
                          نقاطك: <span className="text-yellow-400 text-lg">{existing.points || 0}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {match.is_open && (
                    <div className="space-y-4">
                      {/* Score stepper */}
                      <div>
                        <label className="block text-white/55 mb-2 text-xs sm:text-sm">توقع النتيجة</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { key: 'homeScore', team: match.teams.home.name },
                            { key: 'awayScore', team: match.teams.away.name },
                          ].map(({ key, team }) => (
                            <div key={key} className="text-center">
                              <p className="text-white/50 text-xs mb-2 truncate">{team}</p>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setForm(match.fixture.id, { [key]: Math.max(0, (form[key] || 0) - 1) })}
                                  className="w-10 h-10 bg-zinc-700 hover:bg-zinc-600 rounded-2xl text-xl font-bold transition-colors"
                                >−</button>
                                <span className="text-3xl sm:text-4xl font-bold w-10 text-center">
                                  {form[key] || 0}
                                </span>
                                <button
                                  onClick={() => setForm(match.fixture.id, { [key]: (form[key] || 0) + 1 })}
                                  className="w-10 h-10 bg-red-700 hover:bg-red-600 rounded-2xl text-xl font-bold transition-colors"
                                >+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* First scorer */}
                      <div>
                        <label className="block text-white/55 mb-2 text-xs sm:text-sm">
                          ⚽ توقع أول هداف (+3 نقاط)
                        </label>
                        <input
                          type="text"
                          value={form.firstScorer}
                          onChange={(e) => setForm(match.fixture.id, { firstScorer: e.target.value })}
                          className="w-full min-h-[52px] bg-zinc-800 border border-zinc-700 focus:border-red-500 text-white px-4 py-3 rounded-2xl text-sm outline-none transition-colors"
                          placeholder="مثال: مبابي"
                        />
                      </div>

                      {/* Extra time */}
                      <label className="flex items-center gap-3 min-h-[52px] bg-zinc-800/60 px-4 py-3 rounded-2xl border border-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.extraTime}
                          onChange={(e) => setForm(match.fixture.id, { extraTime: e.target.checked })}
                          className="w-5 h-5 accent-red-600 shrink-0"
                        />
                        <span className="text-sm sm:text-base text-white/80">
                          ⏱️ الماتش هيروح لوقت إضافي؟ (+2 نقاط)
                        </span>
                      </label>

                      {/* Surprise question */}
                      {match.surprise_question && (
                        <div>
                          <label className="block text-purple-400 mb-2 text-xs sm:text-sm">
                            🎯 {match.surprise_question} (+5 نقاط)
                          </label>
                          <input
                            type="text"
                            value={form.surpriseAnswer}
                            onChange={(e) => setForm(match.fixture.id, { surpriseAnswer: e.target.value })}
                            className="w-full min-h-[52px] bg-zinc-800 border border-purple-500/30 focus:border-purple-500 text-white px-4 py-3 rounded-2xl text-sm outline-none transition-colors"
                            placeholder="إجابتك..."
                          />
                        </div>
                      )}

                      {msg && <p className="text-center text-sm font-bold text-green-400">{msg}</p>}

                      <button
                        onClick={() => submitPrediction(match)}
                        disabled={submitting === match.fixture.id}
                        className="w-full min-h-[54px] bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded-2xl font-bold text-base sm:text-lg transition-colors"
                      >
                        {submitting === match.fixture.id ? 'جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}

                  {!match.is_open && !hasResult && existing && (
                    <div className="bg-zinc-800/50 rounded-2xl px-4 py-3 text-center">
                      <p className="text-white/50 text-sm">
                        توقعك: <span className="text-white font-bold">{existing.predicted_home_score} - {existing.predicted_away_score}</span>
                      </p>
                      {existing.predicted_first_scorer && (
                        <p className="text-yellow-400/70 text-xs mt-1">⚽ {existing.predicted_first_scorer}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {/* ===== MY PREDICTIONS TAB ===== */}
        {activeTab === 'my' && (
          <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg sm:text-2xl">توقعاتي</h2>
              <div className="bg-yellow-500/20 text-yellow-400 font-bold px-4 py-2 rounded-2xl text-sm sm:text-base">
                🏆 {myPoints} نقطة
              </div>
            </div>

            {predictions.length === 0 ? (
              <div className="py-16 text-center text-white/40">لم تقدم أي توقعات بعد</div>
            ) : predictions.map((p) => {
              const hasResult = p.actual_home_score !== null;
              return (
                <div key={p.id} className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 ${
                  hasResult && p.points >= 10
                    ? 'bg-yellow-900/10 border-yellow-500/25'
                    : 'bg-zinc-800 border-zinc-700'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-base truncate">{p.home_team} × {p.away_team}</p>
                      <p className="text-white/40 text-xs mt-1">
                        توقعك: <span className="text-white font-bold">{p.predicted_home_score} - {p.predicted_away_score}</span>
                        {p.predicted_first_scorer && (
                          <span className="mr-2 text-yellow-400">⚽ {p.predicted_first_scorer}</span>
                        )}
                      </p>
                      {hasResult && (
                        <p className="text-white/40 text-xs mt-0.5">
                          الفعلية: <span className="text-green-400 font-bold">{p.actual_home_score} - {p.actual_away_score}</span>
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 font-bold text-base sm:text-xl px-3 py-1 rounded-2xl ${
                      !hasResult         ? 'text-white/30 bg-zinc-700'         :
                      p.points >= 10     ? 'text-yellow-400 bg-yellow-500/15' :
                      p.points >= 5      ? 'text-green-400 bg-green-500/15'   :
                      'text-white/60 bg-zinc-700'
                    }`}>
                      {hasResult ? `${p.points || 0} نقطة` : '⏳'}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ===== LEADERBOARD TAB ===== */}
        {activeTab === 'leaders' && (
          <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-6 space-y-3">
            <h2 className="font-bold text-lg sm:text-2xl">🏆 ترتيب المتسابقين</h2>

            {leaderboard.length === 0 ? (
              <div className="py-16 text-center text-white/40">لا توجد نتائج بعد</div>
            ) : leaderboard.map((player: any, index) => {
              const medals = ['🥇', '🥈', '🥉'];
              const isMe   = player.user_id === user?.id;
              return (
                <div key={player.user_id}
                  className={`flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-4 rounded-2xl sm:rounded-3xl border ${
                    isMe    ? 'border-red-500/40 bg-red-900/15' :
                    index < 3 ? 'border-zinc-600 bg-zinc-800'  :
                    'border-zinc-800'
                  }`}>
                  <div className="w-9 sm:w-10 text-center shrink-0">
                    {index < 3
                      ? <span className="text-2xl sm:text-3xl">{medals[index]}</span>
                      : <span className="text-sm sm:text-lg font-bold text-white/40">#{index + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm sm:text-lg truncate ${isMe ? 'text-red-400' : ''}`}>
                      {player.user_email?.split('@')[0]}
                      {isMe && <span className="text-xs text-red-400/70 mr-1">(أنت)</span>}
                    </p>
                    <p className="text-white/40 text-xs">{player.count} توقع</p>
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
  );
}
