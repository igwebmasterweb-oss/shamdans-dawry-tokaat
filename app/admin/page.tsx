'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
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
  const [msgType, setMsgType]         = useState<'success' | 'error'>('success');

  // Modal state
  const [showModal, setShowModal]       = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [actualForm, setActualForm]     = useState({
    homeScore: 0, awayScore: 0, firstScorer: '',
    wentExtraTime: false, surpriseAnswer: '', surpriseQuestion: '',
  });
  const [savingResult, setSavingResult] = useState(false);

  const router = useRouter();
  const rounds = ['Group Stage - 1', 'Group Stage - 2', 'Group Stage - 3'];
  const roundLabels: Record<string, string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
  };

  const showMsg = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMsgType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const loadMatches = useCallback(async () => {
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
    } catch (err) {
      console.error('loadMatches error:', err);
    }
    setLoading(false);
  }, []);

  const loadAllPredictions = useCallback(async () => {
    const { data } = await supabase
      .from('predictions').select('*').order('submitted_at', { ascending: false });
    setPredictions(data || []);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('predictions').select('user_id, user_email, points, fixture_id');
    const grouped: any = {};
    data?.forEach((row: any) => {
      if (!grouped[row.user_id]) {
        grouped[row.user_id] = { user_id: row.user_id, user_email: row.user_email, totalPoints: 0, predictionCount: 0, bestPoints: 0 };
      }
      grouped[row.user_id].totalPoints     += row.points || 0;
      grouped[row.user_id].predictionCount += 1;
      if ((row.points || 0) > grouped[row.user_id].bestPoints)
        grouped[row.user_id].bestPoints = row.points || 0;
    });
    setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.totalPoints - a.totalPoints));
  }, []);

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
  }, [router, loadMatches, loadAllPredictions, loadLeaderboard]);

  // ── Toggle single match ──────────────────────────────────────────────────
  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open;
    const fixtureId = match.fixture.id;
    try {
      const { data: existing, error: selErr } = await supabase
        .from('fixtures').select('id').eq('api_fixture_id', fixtureId).maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await supabase
          .from('fixtures').update({ is_open: newStatus }).eq('api_fixture_id', fixtureId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id: fixtureId, is_open: newStatus,
          home_team: match.teams.home.name, away_team: match.teams.away.name,
          match_date: match.fixture.date, round: match.league.round,
        });
        if (error) throw error;
      }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة', 'success');
    } catch (err: any) {
      console.error('toggleMatchOpen error:', err);
      showMsg('❌ خطأ: ' + (err?.message || 'تأكد من الـ RLS policies'), 'error');
    }
  };

  // ── Open result modal ────────────────────────────────────────────────────
  const openResultModal = (match: any) => {
    setActualForm({
      homeScore:        match.actual_home_score  ?? 0,
      awayScore:        match.actual_away_score  ?? 0,
      firstScorer:      match.first_scorer       ?? '',
      wentExtraTime:    match.went_extra_time     ?? false,
      surpriseAnswer:   match.surprise_answer    ?? '',
      surpriseQuestion: match.surprise_question  ?? '',
    });
    setSelectedMatch(match);
    setShowModal(true);
  };

  // ── Save result ──────────────────────────────────────────────────────────
  const saveActualResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fixtureId = selectedMatch.fixture.id;
    try {
      const { data: existing, error: selErr } = await supabase
        .from('fixtures').select('id').eq('api_fixture_id', fixtureId).maybeSingle();
      if (selErr) throw selErr;

      const payload = {
        actual_home_score: actualForm.homeScore,
        actual_away_score: actualForm.awayScore,
        first_scorer:      actualForm.firstScorer      || null,
        went_extra_time:   actualForm.wentExtraTime,
        surprise_answer:   actualForm.surpriseAnswer   || null,
        surprise_question: actualForm.surpriseQuestion || null,
      };

      if (existing) {
        const { error } = await supabase
          .from('fixtures').update(payload).eq('api_fixture_id', fixtureId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id: fixtureId, is_open: false,
          home_team: selectedMatch.teams.home.name, away_team: selectedMatch.teams.away.name,
          match_date: selectedMatch.fixture.date, round: selectedMatch.league.round,
          ...payload,
        });
        if (error) throw error;
      }
      setShowModal(false);
      await loadMatches();
      showMsg('✅ تم حفظ النتيجة بنجاح', 'success');
    } catch (err: any) {
      console.error('saveActualResult error:', err);
      showMsg('❌ خطأ في حفظ النتيجة: ' + (err?.message || ''), 'error');
    }
    setSavingResult(false);
  };

  // ── Open ALL matches in current round ────────────────────────────────────
  const openAllMatches = async () => {
    setUpdating(true);
    const filtered = matches.filter((m) => m.league.round === activeRound);
    let ok = 0, fail = 0;
    for (const match of filtered) {
      const fixtureId = match.fixture.id;
      try {
        const { data: existing, error: selErr } = await supabase
          .from('fixtures').select('id').eq('api_fixture_id', fixtureId).maybeSingle();
        if (selErr) throw selErr;

        if (existing) {
          const { error } = await supabase
            .from('fixtures').update({ is_open: true }).eq('api_fixture_id', fixtureId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('fixtures').insert({
            api_fixture_id: fixtureId, is_open: true,
            home_team: match.teams.home.name, away_team: match.teams.away.name,
            match_date: match.fixture.date, round: match.league.round,
          });
          if (error) throw error;
        }
        ok++;
      } catch (err) {
        console.error('openAllMatches error for', fixtureId, err);
        fail++;
      }
    }
    await loadMatches();
    setUpdating(false);
    if (fail === 0) {
      showMsg(`✅ تم فتح ${ok} ماتش بنجاح`, 'success');
    } else {
      showMsg(`⚠️ تم فتح ${ok} — فشل ${fail}`, 'error');
    }
  };

  // ── Close ALL matches ────────────────────────────────────────────────────
  const closeAllMatches = async () => {
    setUpdating(true);
    try {
      const res  = await fetch('/api/admin-close-all');
      const data = await res.json();
      showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ ' + data.error,
              data.success ? 'success' : 'error');
      await loadMatches();
    } catch {
      showMsg('❌ خطأ في الغلق', 'error');
    }
    setUpdating(false);
  };

  // ── Update all points ────────────────────────────────────────────────────
  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const res  = await fetch('/api/update-results');
      const data = await res.json();
      if (data.success) {
        showMsg(data.message || '✅ تم تحديث النقاط', 'success');
        await loadAllPredictions();
        await loadLeaderboard();
      } else {
        showMsg('❌ خطأ: ' + data.error, 'error');
      }
    } catch {
      showMsg('❌ خطأ في الاتصال', 'error');
    }
    setUpdating(false);
  };

  // ── Sync fixtures ────────────────────────────────────────────────────────
  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count || ''} ماتش` : '❌ ' + data.error,
              data.success ? 'success' : 'error');
      await loadMatches();
    } catch {
      showMsg('❌ خطأ في المزامنة', 'error');
    }
    setSyncing(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-4xl animate-pulse">⚙️</p>
        <p className="text-zinc-400 text-sm">جاري التحميل...</p>
      </div>
    </div>
  );

  const filteredMatches   = matches.filter((m) => m.league.round === activeRound);
  const totalPredictions  = predictions.length;
  const gradedPredictions = predictions.filter((p) => p.actual_home_score !== null).length;
  const openMatches       = matches.filter((m) => m.is_open).length;

  return (
    <>
      <main className="min-h-screen bg-black text-white" dir="rtl">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

          {/* Header */}
          <header className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚙️</span>
                <div>
                  <h1 className="text-lg font-black text-red-500">لوحة التحكم</h1>
                  <p className="text-zinc-500 text-xs">كأس العالم 2026 — الشمعدان</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={syncFixtures} disabled={syncing}
                  className="min-h-[40px] bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs font-bold transition-colors">
                  {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الماتشات'}
                </button>
                <button onClick={updateAllPoints} disabled={updating}
                  className="min-h-[40px] bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs font-bold transition-colors">
                  {updating ? '⏳ جاري التحديث...' : '⚡ تحديث النقاط'}
                </button>
                <button onClick={handleLogout}
                  className="min-h-[40px] bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-2xl text-xs font-bold transition-colors text-zinc-300">
                  خروج
                </button>
              </div>
            </div>
          </header>

          {/* Message banner */}
          {message && (
            <div className={`px-5 py-3 rounded-2xl text-center text-sm font-bold border transition-all ${
              msgType === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {message}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي التوقعات', value: totalPredictions,   color: 'text-blue-400'   },
              { label: 'توقعات محسوبة',   value: gradedPredictions,  color: 'text-green-400'  },
              { label: 'ماتشات مفتوحة',   value: openMatches,        color: 'text-yellow-400' },
              { label: 'المتسابقين',       value: leaderboard.length, color: 'text-red-400'    },
            ].map((card) => (
              <div key={card.label} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
                <p className="text-zinc-500 text-xs mb-1">{card.label}</p>
                <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {(['matches', 'predictions', 'leaderboard'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`shrink-0 min-h-[44px] px-5 py-2 rounded-2xl text-sm font-bold transition-colors ${
                  activeTab === tab
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}>
                {tab === 'matches'     ? `🏟️ الماتشات (${matches.length})`
                 : tab === 'predictions' ? `📋 التوقعات (${totalPredictions})`
                 : `🏆 الصدارة (${leaderboard.length})`}
              </button>
            ))}
          </div>

          {/* ── MATCHES TAB ── */}
          {activeTab === 'matches' && (
            <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {rounds.map((round) => (
                    <button key={round} onClick={() => setActiveRound(round)}
                      className={`shrink-0 min-h-[40px] px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
                        activeRound === round ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}>
                      {roundLabels[round]}
                      <span className="mr-1 text-xs opacity-40">
                        ({matches.filter((m) => m.league.round === round).length})
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={openAllMatches} disabled={updating}
                    className="min-h-[40px] flex-1 sm:flex-none bg-green-800 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs font-bold transition-colors">
                    🟢 فتح الكل
                  </button>
                  <button onClick={closeAllMatches} disabled={updating}
                    className="min-h-[40px] flex-1 sm:flex-none bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded-2xl text-xs font-bold transition-colors">
                    🔒 غلق الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filteredMatches.map((match) => {
                  const hasResult  = match.actual_home_score !== null && match.actual_home_score !== undefined;
                  const matchPreds = predictions.filter((p) => p.fixture_id === match.fixture.id);
                  return (
                    <article key={match.fixture.id}
                      className={`bg-zinc-950 rounded-2xl border p-4 ${
                        match.is_open ? 'border-green-500/30' : 'border-zinc-800'
                      }`}>

                      <div className="flex justify-between items-start mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${match.is_open ? 'bg-green-400' : 'bg-zinc-600'}`} />
                            <p className="text-sm font-bold truncate">
                              {match.teams.home.name} <span className="text-zinc-600">×</span> {match.teams.away.name}
                            </p>
                          </div>
                          <p className="text-zinc-600 text-xs">
                            {new Date(match.fixture.date).toLocaleDateString('ar-EG', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            match.is_open ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {match.is_open ? 'مفتوح' : 'مغلق'}
                          </span>
                          {matchPreds.length > 0 && (
                            <span className="text-zinc-600 text-xs">👥 {matchPreds.length} توقع</span>
                          )}
                        </div>
                      </div>

                      {hasResult && (
                        <div className="bg-green-950/30 border border-green-500/15 rounded-xl px-3 py-2.5 mb-3 space-y-1 text-center">
                          <p className="text-green-400 font-black text-lg">
                            {match.actual_home_score} — {match.actual_away_score}
                          </p>
                          {match.first_scorer && (
                            <p className="text-yellow-400 text-xs">⚽ {match.first_scorer}</p>
                          )}
                          {match.went_extra_time && (
                            <p className="text-blue-400 text-xs">⏱️ ذهب لوقت إضافي</p>
                          )}
                          {match.surprise_question && (
                            <p className="text-purple-400 text-xs">❓ {match.surprise_question}</p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMatchOpen(match)}
                          className={`min-h-[44px] rounded-xl font-bold text-xs transition-colors ${
                            match.is_open
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              : 'bg-green-800 hover:bg-green-700 text-white'
                          }`}>
                          {match.is_open ? '🔒 غلق التوقعات' : '🟢 فتح التوقعات'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openResultModal(match)}
                          className="min-h-[44px] rounded-xl font-bold text-xs bg-red-700 hover:bg-red-600 transition-colors">
                          {hasResult ? '✏️ تعديل النتيجة' : '⚽ إدخال النتيجة'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── PREDICTIONS TAB ── */}
          {activeTab === 'predictions' && (
            <section className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 sm:p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      {['المستخدم','الماتش','توقعي','الفعلية','أول هدف','إضافي','مفاجأة','النقاط'].map((h, i) => (
                        <th key={h} className={`py-3 px-3 font-medium ${i > 1 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-3 text-zinc-400">{p.user_email?.split('@')[0]}</td>
                        <td className="py-3 px-3 max-w-[160px] truncate text-zinc-300">{p.home_team} × {p.away_team}</td>
                        <td className="py-3 px-3 text-center font-black">{p.predicted_home_score} - {p.predicted_away_score}</td>
                        <td className="py-3 px-3 text-center text-green-400 font-bold">
                          {p.actual_home_score !== null ? `${p.actual_home_score} - ${p.actual_away_score}` : '⏳'}
                        </td>
                        <td className="py-3 px-3 text-center text-yellow-400">{p.predicted_first_scorer || '—'}</td>
                        <td className="py-3 px-3 text-center text-blue-400">{p.predicted_extra_time ? 'نعم' : 'لا'}</td>
                        <td className="py-3 px-3 text-center text-purple-400 max-w-[100px] truncate">{p.surprise_answer || '—'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded-full font-black text-xs ${
                            p.points >= 10 ? 'bg-yellow-500/15 text-yellow-400'
                            : p.points >= 5 ? 'bg-green-500/15 text-green-400'
                            : p.actual_home_score !== null ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-zinc-800/50 text-zinc-600'
                          }`}>
                            {p.actual_home_score !== null ? (p.points || 0) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {predictions.length === 0 && (
                  <div className="py-16 text-center text-zinc-600">لا توجد توقعات بعد</div>
                )}
              </div>
            </section>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === 'leaderboard' && (
            <section className="space-y-2">
              {leaderboard.length === 0 ? (
                <div className="py-20 text-center text-zinc-600 bg-zinc-900 rounded-3xl border border-zinc-800">
                  لا توجد بيانات بعد
                </div>
              ) : leaderboard.map((player: any, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={player.user_id}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${
                      index < 3 ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50'
                    }`}>
                    <div className="w-8 text-center shrink-0">
                      {index < 3
                        ? <span className="text-xl">{medals[index]}</span>
                        : <span className="text-sm font-bold text-zinc-500">#{index + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{player.user_email?.split('@')[0]}</p>
                      <p className="text-zinc-600 text-xs">{player.predictionCount} توقع · أفضل: {player.bestPoints} نقطة</p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className={`text-xl font-black ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-amber-600' : 'text-white'
                      }`}>{player.totalPoints}</p>
                      <p className="text-zinc-600 text-xs">نقطة</p>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          RESULT MODAL — rendered at root level, always in DOM
          only visible when showModal === true
      ══════════════════════════════════════════════════════ */}
      {showModal && selectedMatch && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/90"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg mx-0 sm:mx-4 rounded-t-3xl sm:rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 pt-5 pb-4 z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-zinc-500 text-xs mb-1">إدخال نتيجة المباراة</p>
                  <h2 className="text-base font-black">
                    {selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="shrink-0 w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 flex items-center justify-center text-xl transition-colors"
                >×</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Score */}
              <div>
                <p className="text-zinc-500 text-xs mb-3 font-medium">النتيجة الفعلية</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'homeScore', team: selectedMatch.teams.home.name },
                    { key: 'awayScore', team: selectedMatch.teams.away.name },
                  ].map(({ key, team }) => (
                    <div key={key} className="text-center bg-zinc-800 rounded-2xl p-3">
                      <p className="text-zinc-400 text-xs mb-3 truncate">{team}</p>
                      <input
                        type="number" min={0}
                        value={(actualForm as any)[key]}
                        onChange={(e) => setActualForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                        className="h-16 w-full rounded-xl bg-white text-black text-3xl font-black text-center outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* First scorer */}
              <div>
                <label className="block text-zinc-500 text-xs mb-2 font-medium">⚽ أول هدف</label>
                <input type="text" value={actualForm.firstScorer}
                  onChange={(e) => setActualForm((f) => ({ ...f, firstScorer: e.target.value }))}
                  className="w-full min-h-[48px] bg-zinc-800 border border-zinc-700 focus:border-red-500 text-white px-4 py-3 rounded-2xl text-sm outline-none transition-colors placeholder:text-zinc-600"
                  placeholder="مثال: محمد صلاح" />
              </div>

              {/* Extra time */}
              <label className="flex items-center gap-3 min-h-[48px] bg-zinc-800 px-4 py-3 rounded-2xl border border-zinc-700 cursor-pointer hover:bg-zinc-700/50 transition-colors">
                <input type="checkbox" checked={actualForm.wentExtraTime}
                  onChange={(e) => setActualForm((f) => ({ ...f, wentExtraTime: e.target.checked }))}
                  className="w-5 h-5 accent-red-600 shrink-0" />
                <span className="text-zinc-300 text-sm">⏱️ الماتش راح لوقت إضافي؟</span>
              </label>

              {/* Surprise question */}
              <div>
                <label className="block text-zinc-500 text-xs mb-2 font-medium">
                  ❓ سؤال المفاجأة <span className="text-zinc-600">(يظهر للمستخدمين)</span>
                </label>
                <input type="text" value={actualForm.surpriseQuestion}
                  onChange={(e) => setActualForm((f) => ({ ...f, surpriseQuestion: e.target.value }))}
                  className="w-full min-h-[48px] bg-zinc-800 border border-zinc-700 focus:border-purple-500 text-white px-4 py-3 rounded-2xl text-sm outline-none transition-colors placeholder:text-zinc-600"
                  placeholder="مثال: من هيكون أفضل لاعب؟" />
              </div>

              {/* Surprise answer */}
              <div>
                <label className="block text-zinc-500 text-xs mb-2 font-medium">
                  🎯 الإجابة الصحيحة <span className="text-yellow-500/70">+5 نقاط</span>
                </label>
                <input type="text" value={actualForm.surpriseAnswer}
                  onChange={(e) => setActualForm((f) => ({ ...f, surpriseAnswer: e.target.value }))}
                  className="w-full min-h-[48px] bg-zinc-800 border border-zinc-700 focus:border-purple-500 text-white px-4 py-3 rounded-2xl text-sm outline-none transition-colors placeholder:text-zinc-600"
                  placeholder="الإجابة الصحيحة" />
              </div>

              {/* Points reference */}
              <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800 grid grid-cols-2 gap-2 text-xs">
                <p className="text-yellow-400">🏆 نتيجة كاملة = 10 نقاط</p>
                <p className="text-green-400">✅ فايز صح = 5 نقاط</p>
                <p className="text-blue-400">⚽ أول هدف = 3 نقاط</p>
                <p className="text-cyan-400">⏱️ وقت إضافي = 2 نقاط</p>
                <p className="text-purple-400">🎯 مفاجأة = 5 نقاط</p>
                <p className="text-zinc-500">الحد الأقصى = 25 نقطة</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2">
                <button
                  type="button"
                  onClick={saveActualResult}
                  disabled={savingResult}
                  className="min-h-[52px] rounded-2xl font-black text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors">
                  {savingResult ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[52px] rounded-2xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300">
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
