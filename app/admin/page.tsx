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

  const ADMIN_EMAIL = 'i.g.webmaster.web@gmail.com';   // ← غيّره لإيميلك

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

  // إغلاق / فتح التوقعات
  const toggleMatchStatus = async (match: any) => {
    const newStatus = !match.is_open;

    const { error } = await supabase
      .from('fixtures')
      .update({ is_open: newStatus })
      .eq('fixture_id', match.fixture.id);

    if (error) {
      alert('خطأ: ' + error.message);
    } else {
      alert(newStatus ? '✅ التوقعات فُتحت' : '✅ التوقعات أُغلقت بنجاح');
      loadMatches();
    }
  };

  // تحديث أوتوماتيك من API-Football
  const autoUpdateFromAPI = async () => {
    if (!confirm('هل تريد تحديث كل النتايج الفعلية تلقائيًا من API-Football؟')) return;

    const res = await fetch('/api/update-results');
    const data = await res.json();

    if (data.success) {
      alert(data.message);
      loadMatches();
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
      loadMatches();
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-tajawal">جاري التحميل...</div>;

  // إحصائيات سريعة
  const totalMatches = matches.length;
  const openMatches = matches.filter(m => m.is_open === true).length;
  const closedMatches = totalMatches - openMatches;

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <span className="text-6xl">🔧</span>
              <h1 className="text-5xl font-bold text-red-600 font-tajawal">Admin Panel</h1>
            </div>
            <button 
              onClick={() => router.push('/dashboard')} 
              className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-3xl font-tajawal text-lg"
            >
              رجوع للداشبورد
            </button>
          </div>

          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-3 gap-6 mb-10">
            <div className="bg-zinc-900 p-6 rounded-3xl text-center">
              <p className="text-white/60 text-sm">إجمالي الماتشات</p>
              <p className="text-4xl font-bold text-white mt-2">{totalMatches}</p>
            </div>
            <div className="bg-emerald-900/30 p-6 rounded-3xl text-center border border-emerald-500/30">
              <p className="text-emerald-400 text-sm">التوقعات مفتوحة</p>
              <p className="text-4xl font-bold text-emerald-400 mt-2">{openMatches}</p>
            </div>
            <div className="bg-red-900/30 p-6 rounded-3xl text-center border border-red-500/30">
              <p className="text-red-400 text-sm">التوقعات مغلقة</p>
              <p className="text-4xl font-bold text-red-400 mt-2">{closedMatches}</p>
            </div>
          </div>

          <h2 className="text-3xl font-tajawal mb-8">إدارة الماتشات</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {matches.map((match) => (
              <div key={match.fixture.id} className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 hover:border-red-600 transition-all">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex-1 text-center">
                    <p className="font-tajawal text-2xl">{match.teams.home.name}</p>
                  </div>
                  <div className="px-8 text-xl font-light">VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-tajawal text-2xl">{match.teams.away.name}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => toggleMatchStatus(match)}
                    className={`flex-1 py-5 rounded-3xl font-tajawal text-lg font-bold transition-all ${
                      match.is_open 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {match.is_open ? '🚫 إغلاق التوقعات' : '✅ فتح التوقعات'}
                  </button>

                  <button 
                    onClick={() => openEditModal(match)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-3xl text-lg font-tajawal"
                  >
                    تعديل النتيجة
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* زرار التحديث الأوتوماتيك */}
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

      {/* Modal تعديل النتيجة */}
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
            <h2 style={{ color: '#ffffff', fontWeight: '700' }} className="text-3xl text-center mb-8 font-tajawal">
              {editingMatch.teams.home.name} × {editingMatch.teams.away.name}
            </h2>

            <div className="space-y-8">
              <div className="flex gap-12 justify-center">
                <div className="text-center">
                  <p style={{ color: '#ffffff', fontWeight: '600' }} className="text-xl mb-3 font-tajawal">{editingMatch.teams.home.name}</p>
                  <input 
                    type="number" 
                    min={0} 
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
                    type="number" 
                    min={0} 
                    value={actualForm.awayScore} 
                    onChange={(e) => setActualForm({ ...actualForm, awayScore: Number(e.target.value) })} 
                    className="w-24 text-center bg-white text-black text-6xl font-bold p-6 rounded-3xl border border-green-500/50 focus:border-green-500" 
                    style={{ color: '#111111', fontWeight: '700' }} 
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={closeEditModal} 
                  className="flex-1 py-5 border border-zinc-400 rounded-3xl font-tajawal text-xl" 
                  style={{ color: '#111111', fontWeight: '700', backgroundColor: '#ffffff' }}
                >
                  إلغاء
                </button>
                <button 
                  type="button" 
                  onClick={saveActualResult} 
                  className="flex-1 py-5 rounded-3xl font-bold text-xl font-tajawal" 
                  style={{ color: '#111111', fontWeight: '700', backgroundColor: '#22c55e' }}
                >
                  حفظ النتيجة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
