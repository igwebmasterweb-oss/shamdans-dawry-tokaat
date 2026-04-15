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

  const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';   // غيّره لإيميلك

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || data.user.email !== ADMIN_EMAIL) {
        alert('❌ هذه الصفحة للأدمن فقط');
        router.push('/dashboard');
        return;
      }
      setUser(data.user);
      loadMatches();
    });
  }, [router]);

  const loadMatches = async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      if (data.response) setMatches(data.response.slice(0, 30));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // 🔥 زرار التحديث الأوتوماتيك الجديد
  const autoUpdateFromAPI = async () => {
    if (!confirm('هل تريد تحديث كل النتايج الفعلية تلقائيًا من API-Football؟')) return;

    const res = await fetch('/api/update-results');
    const data = await res.json();

    if (data.success) {
      alert(data.message);
      window.location.reload();   // عشان يتحدث الداشبورد
    } else {
      alert('خطأ: ' + data.error);
    }
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
      alert('✅ النتيجة الفعلية اتسجلت يدويًا');
      closeEditModal();
      window.location.reload();
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl">جاري التحميل...</div>;

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <span className="text-6xl">🔧</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">Admin Panel</h1>
            </div>
            <div className="flex gap-4">
              <button onClick={autoUpdateFromAPI} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-4 rounded-3xl font-tajawal text-lg font-bold">
                🔄 تحديث أوتوماتيك من API-Football
              </button>
              <button onClick={() => router.push('/dashboard')} className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-3xl font-tajawal text-lg">رجوع للداشبورد</button>
            </div>
          </div>

          <h2 className="text-3xl font-tajawal mb-8">إدارة نتايج الماتشات</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {matches.map((match) => (
              <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30">
                <div className="flex justify-between items-center">
                  <div className="flex-1 text-center">
                    <p className="font-tajawal text-2xl">{match.teams.home.name}</p>
                  </div>
                  <div className="px-8 text-xl font-light">VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-tajawal text-2xl">{match.teams.away.name}</p>
                  </div>
                </div>

                <button onClick={() => openEditModal(match)} className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-3xl text-2xl font-tajawal">
                  تعديل يدوي
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal اليدوي */}
      {editingMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeEditModal}>
          <div style={{ position: 'relative' }} className="bg-zinc-700 rounded-3xl p-10 w-full max-w-lg mx-4 shadow-2xl border border-green-500/40" onClick={(e) => e.stopPropagation()}>
            {/* نفس المودال السابق - لم يتغير */}
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-8 font-tajawal">
              {editingMatch.teams.home.name} × {editingMatch.teams.away.name}
            </h2>
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
                <button type="button" onClick={saveActualResult} className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal" style={{ color: '#111111', fontWeight: '700', backgroundColor: '#22c55e' }}>حفظ يدوي</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}