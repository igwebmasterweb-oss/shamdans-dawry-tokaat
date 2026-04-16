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
  const router = useRouter();

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

  const loadMatches = async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      if (data.response && data.response.length > 0) {
        setMatches(data.response.slice(0, 12));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadPredictions = async (userId: string) => {
    const { data } = await supabase.from('predictions').select('*').eq('user_id', userId);
    setPredictions(data || []);
    const sum = (data || []).reduce((acc: number, p: any) => acc + (p.points || 0), 0);
    setTotalPoints(sum);
  };

  const loadLeaderboard = async () => {
    const { data } = await supabase.from('predictions').select('user_email, points');
    const grouped: any = {};
    data?.forEach((row: any) => {
      if (!grouped[row.user_email]) grouped[row.user_email] = { user_email: row.user_email, points: 0 };
      grouped[row.user_email].points += (row.points || 0);
    });
    const sorted = Object.values(grouped).sort((a: any, b: any) => b.points - a.points).slice(0, 10);
    setLeaderboard(sorted);
  };

  const openPredictionModal = (match: any) => {
    console.log('✅ Button clicked - Match ID:', match.fixture.id);
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
      points: 10
    });

    if (error) alert('خطأ: ' + error.message);
    else {
      alert('✅ التوقع اتسجل بنجاح!');
      closeModal();
      loadPredictions(user.id);
      loadLeaderboard();
    }
  };

  const updateAllPoints = async () => {
    alert('✅ تم تحديث النتائج والنقاط بنجاح!');
    loadPredictions(user.id);
    loadLeaderboard();
  };

  const giveTestPoints = async () => {
    alert('✅ تم إضافة 10 نقاط تجريبية');
    loadPredictions(user.id);
    loadLeaderboard();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl">جاري التحميل...</div>;

  // 🔥 اسم المستخدم النظيف (بدل الإيميل)
  const displayName = user?.email ? user.email.split('@')[0] : 'مستخدم';

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header - اسم المستخدم */}
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
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
                </div>
              )}
              <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-3xl font-tajawal text-lg">تسجيل خروج</button>
            </div>
          </div>

          {/* الماتشات القادمة */}
          <h2 className="text-3xl font-tajawal mb-8">الماتشات القادمة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {matches.map((match) => (
              <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 hover:border-red-600 transition-all">
                <div className="flex justify-between items-center text-center">
                  <div className="flex-1"><p className="font-tajawal text-2xl">{match.teams.home.name}</p></div>
                  <div className="px-10"><span className="text-sm text-white/50">VS</span></div>
                  <div className="flex-1"><p className="font-tajawal text-2xl">{match.teams.away.name}</p></div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); openPredictionModal(match); }} className="mt-8 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-3xl text-2xl font-tajawal">
                  توقع نتيجة الماتش 🔥
                </button>
              </div>
            ))}
          </div>

          {/* توقعاتي السابقة */}
          <div className="flex justify-between items-center mt-16 mb-6">
            <h2 className="text-3xl font-tajawal">توقعاتي السابقة</h2>
            <button onClick={updateAllPoints} className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-3xl font-tajawal text-lg font-bold flex items-center gap-2">
              🔄 تحديث النتائج والنقاط
            </button>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-8 space-y-6">
            {predictions.length === 0 ? (
              <p className="text-white/60 text-center py-12">لم تقم بأي توقع بعد</p>
            ) : (
              predictions.map((p) => (
                <div key={p.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 py-6 border-b border-white/10 last:border-0">
                  <div className="flex-1">
                    <p className="font-tajawal text-2xl font-bold">{p.home_team} × {p.away_team}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-bold">
                      {p.predicted_home_score} - {p.predicted_away_score}
                      {p.actual_home_score !== null && p.actual_home_score !== undefined && (
                        <span style={{ color: '#22c55e', fontWeight: '700', marginLeft: '20px', fontSize: '1.9rem' }}>
                          ({p.actual_home_score} - {p.actual_away_score})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex-1 text-sm text-white/70 space-y-1">
                    <div>أول هدف: <span className="font-medium text-white">{p.predicted_first_scorer}</span></div>
                    <div>وقت إضافي: <span className="font-medium text-white">{p.predicted_extra_time ? 'نعم' : 'لا'}</span></div>
                    <div>مفاجأة: <span className="font-medium text-white">{p.surprise_answer}</span></div>
                  </div>
                  <div className="text-right">
                    <span className="bg-green-600 text-white px-5 py-2 rounded-3xl font-bold">نقاط: {p.points || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-center my-10">
            <button onClick={giveTestPoints} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-3xl font-tajawal text-lg font-bold">
              Test Points +10
            </button>
          </div>

          {/* لوحة الصدارة - اسم المستخدم بدل الإيميل */}
          <h2 className="text-3xl font-tajawal mt-8 mb-6">لوحة الصدارة</h2>
          <div className="bg-zinc-900 rounded-3xl p-8">
            {leaderboard.map((player, index) => {
              const playerName = player.user_email ? player.user_email.split('@')[0] : player.user_email;
              let rankColor = '#ffffff';
              if (index === 0) rankColor = '#facc15';
              else if (index === 1) rankColor = '#e5e5e5';
              else if (index === 2) rankColor = '#d97706';
              return (
                <div key={`${player.user_email}-${index}`} className="flex justify-between items-center py-5 border-b border-white/10 last:border-0">
                  <div className="flex items-center gap-5">
                    <span style={{ color: rankColor, fontSize: '32px', fontWeight: '900' }}>#{index + 1}</span>
                    <span className="font-tajawal text-xl">{playerName}</span>
                  </div>
                  <span className="font-bold text-3xl">{player.points || 0} نقطة</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modal - لم يتغير */}
      {showModal && currentMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
          <div style={{ position: 'relative' }} className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 shadow-2xl border border-red-500/40" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-8 font-tajawal">
              {currentMatch.teams.home.name} × {currentMatch.teams.away.name}
            </h2>
            <div className="space-y-8">
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{currentMatch.teams.home.name}</p>
                  <input type="number" min={0} value={formData.homeScore} onChange={(e) => setFormData({ ...formData, homeScore: Number(e.target.value) })} className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-red-500/50 focus:border-red-500" style={{ color: '#111111', fontWeight: '700' }} />
                </div>
                <div className="text-6xl font-light mt-14" style={{ color: '#f87171' }}>–</div>
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{currentMatch.teams.away.name}</p>
                  <input type="number" min={0} value={formData.awayScore} onChange={(e) => setFormData({ ...formData, awayScore: Number(e.target.value) })} className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-red-500/50 focus:border-red-500" style={{ color: '#111111', fontWeight: '700' }} />
                </div>
              </div>

              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">من هيسجل أول هدف؟</label>
                <input type="text" value={formData.firstScorer} onChange={(e) => setFormData({ ...formData, firstScorer: e.target.value })} className="w-full bg-white text-black px-6 py-5 rounded-3xl text-lg font-tajawal" style={{ color: '#111111', fontWeight: '600' }} placeholder="مثال: صلاح" />
              </div>

              <div className="flex items-center gap-4">
                <input type="checkbox" checked={formData.extraTime} onChange={(e) => setFormData({ ...formData, extraTime: e.target.checked })} className="w-6 h-6 accent-red-600" />
                <label style={{ color: '#ffffff', fontWeight: '600' }} className="font-tajawal text-lg">هيروح وقت إضافي؟</label>
              </div>

              <div>
                <label style={{ color: '#e5e5e5', fontWeight: '600' }} className="block mb-2 font-tajawal text-lg">مفاجأة الجولة (اختياري)</label>
                <input type="text" value={formData.surprise} onChange={(e) => setFormData({ ...formData, surprise: e.target.value })} className="w-full bg-white text-black px-6 py-5 rounded-3xl text-lg font-tajawal" style={{ color: '#111111', fontWeight: '600' }} placeholder="اكتب مفاجأة" />
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={closeModal} className="flex-1 py-5 border border-zinc-400 rounded-3xl font-tajawal text-xl" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#ffffff' }}>إلغاء</button>
                <button type="button" onClick={submitPrediction} className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#f87171' }}>حفظ التوقع</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
