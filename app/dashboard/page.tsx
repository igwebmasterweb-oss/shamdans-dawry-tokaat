'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  profile_completed: boolean;
  bonus_points_awarded: boolean;
  bonus_points?: number;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'predict' | 'my' | 'leaders'>('predict');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [predForms, setPredForms] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

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
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileData) {
        setProfile(profileData);
        setProfileForm({
          display_name: profileData.display_name || '',
          phone: profileData.phone || '',
        });
      }

      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];

      const { data: sbFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,surprise_answer,surprise_question');

      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
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

      const { data: userPreds } = await supabase
        .from('predictions').select('*').eq('user_id', userId);
      setPredictions(userPreds || []);

      const { data: allPreds } = await supabase
        .from('predictions').select('user_id,user_email,points');

      // Join with profiles for display_name
      const { data: allProfiles } = await supabase
        .from('profiles').select('id,display_name,profile_completed');
      const profileMap = new Map(allProfiles?.map((p: any) => [p.id, p]) || []);

      const grouped: any = {};
      allPreds?.forEach((row: any) => {
        if (!grouped[row.user_id]) {
          const prof = profileMap.get(row.user_id) as any;
          grouped[row.user_id] = {
            user_id: row.user_id,
            user_email: row.user_email,
            display_name: prof?.display_name || null,
            profile_completed: prof?.profile_completed || false,
            totalPoints: 0,
            count: 0,
          };
        }
        grouped[row.user_id].totalPoints += row.points || 0;
        grouped[row.user_id].count += 1;
      });
      setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.totalPoints - a.totalPoints));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // ── Profile save ──
  const saveProfile = async () => {
    if (!user) return;
    if (!profileForm.display_name.trim()) {
      setProfileMsg('❌ الاسم مطلوب');
      return;
    }
    setProfileSaving(true);
    try {
      const isCompleting = !profile?.profile_completed &&
        profileForm.display_name.trim() &&
        profileForm.phone.trim();

      const updates: any = {
        display_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        profile_completed: !!(profileForm.display_name.trim() && profileForm.phone.trim()),
        updated_at: new Date().toISOString(),
      };

      // Award bonus points only once — saved in profiles directly
      if (isCompleting && !profile?.bonus_points_awarded) {
        updates.bonus_points_awarded = true;
        updates.bonus_points = 5;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates });

      if (error) throw error;

      setProfileMsg(isCompleting && !profile?.bonus_points_awarded
        ? '✅ تم الحفظ! حصلت على 5 نقاط مكافأة 🎉'
        : '✅ تم الحفظ!');

      // Refresh profile + leaderboard
      await loadData(user.id);
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileMsg('');
      }, 2000);
    } catch {
      setProfileMsg('❌ خطأ في الحفظ، حاول مجدداً');
    }
    setProfileSaving(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id === match.fixture.id);
    return {
      homeScore: ex?.predicted_home_score ?? 0,
      awayScore: ex?.predicted_away_score ?? 0,
      firstScorer: ex?.predicted_first_scorer ?? '',
      extraTime: ex?.predicted_extra_time ?? false,
      surpriseAnswer: ex?.surprise_answer ?? '',
    };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms(prev => ({ ...prev, [fixtureId]: { ...getForm({ fixture: { id: fixtureId } }), ...patch } }));

  const submitPrediction = async (match: any) => {
    if (!user) return;
    setSubmitting(match.fixture.id);
    const form = getForm(match);
    try {
      const ex = predictions.find(p => p.fixture_id === match.fixture.id);
      const payload = {
        user_id: user.id,
        user_email: user.email,
        fixture_id: match.fixture.id,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        predicted_home_score: form.homeScore,
        predicted_away_score: form.awayScore,
        predicted_first_scorer: form.firstScorer || null,
        predicted_extra_time: form.extraTime,
        surprise_answer: form.surpriseAnswer || null,
        submitted_at: new Date().toISOString(),
        points: ex?.points ?? 0,
        actual_home_score: null,
        actual_away_score: null,
      };
      if (ex) await supabase.from('predictions').update(payload).eq('id', ex.id);
      else await supabase.from('predictions').insert(payload);
      const { data } = await supabase.from('predictions').select('*').eq('user_id', user.id);
      setPredictions(data || []);
      setMessages(m => ({ ...m, [match.fixture.id]: '✅ تم الحفظ!' }));
      setTimeout(() => setMessages(m => ({ ...m, [match.fixture.id]: '' })), 3000);
    } catch {
      setMessages(m => ({ ...m, [match.fixture.id]: '❌ خطأ في الحفظ' }));
    }
    setSubmitting(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--fifa-bg)', color: 'var(--fifa-text)', fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <p>جاري التحميل...</p>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );

  const myPoints = predictions.reduce((s, p) => s + (p.points || 0), 0) + (profile?.bonus_points || 0);
  const myRank = leaderboard.findIndex(p => p.user_id === user?.id) + 1;
  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const medals = ['🥇', '🥈', '🥉'];
  const displayName = profile?.display_name || user?.email?.split('@')[0];
  const profileIncomplete = !profile?.profile_completed;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fifa-bg)', color: 'var(--fifa-text)', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'var(--fifa-surface)', borderBottom: '1px solid var(--fifa-line)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🏆</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>الشمعدان × كأس العالم</div>
                <div style={{ color: 'var(--fifa-muted)', fontSize: 13 }}>أهلاً {displayName}! 👋</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Points badge */}
              <div style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--fifa-gold, #f5c518)' }}>{myPoints}</div>
                <div style={{ fontSize: 11, color: 'var(--fifa-muted)' }}>نقطة</div>
              </div>
              {myRank > 0 && (
                <div style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>#{myRank}</div>
                  <div style={{ fontSize: 11, color: 'var(--fifa-muted)' }}>ترتيب</div>
                </div>
              )}
              {/* Profile button */}
              <button
                onClick={() => setShowProfileModal(true)}
                style={{
                  padding: '8px 16px', borderRadius: 12, border: profileIncomplete ? '1px solid rgba(245,197,24,.4)' : '1px solid var(--fifa-line)',
                  background: profileIncomplete ? 'rgba(245,197,24,.08)' : 'var(--fifa-surface-2)',
                  color: profileIncomplete ? '#f5c518' : 'var(--fifa-text)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Tajawal, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {profileIncomplete ? '⚠️ أكمل ملفك +5 نقاط' : '✏️ ' + displayName}
              </button>
              <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid var(--fifa-line)', background: 'transparent', color: 'var(--fifa-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                خروج
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROFILE INCOMPLETE BANNER ── */}
      {profileIncomplete && (
        <div
          onClick={() => setShowProfileModal(true)}
          style={{
            background: 'linear-gradient(90deg, rgba(245,197,24,.12), rgba(245,197,24,.05))',
            borderBottom: '1px solid rgba(245,197,24,.2)',
            padding: '10px 20px', cursor: 'pointer', textAlign: 'center',
          }}
        >
          <span style={{ color: '#f5c518', fontWeight: 700, fontSize: 14 }}>
            🎁 أكمل ملفك الشخصي (اسم + تليفون) واحصل على 5 نقاط مجاناً!
          </span>
          <span style={{ color: 'var(--fifa-muted)', fontSize: 13, marginRight: 8 }}>اضغط هنا</span>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfileModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--fifa-surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420,
            border: '1px solid var(--fifa-line)', boxShadow: '0 20px 60px rgba(0,0,0,.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18 }}>👤 ملفك الشخصي</h3>
              <button onClick={() => { setShowProfileModal(false); setProfileMsg(''); }}
                style={{ background: 'var(--fifa-surface-2)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--fifa-text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                ✕
              </button>
            </div>

            {!profile?.bonus_points_awarded && (
              <div style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#f5c518', fontWeight: 600 }}>
                🎁 أكمل اسمك ورقمك واحصل على 5 نقاط مكافأة!
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 6, fontWeight: 600 }}>
                  الاسم الكامل <span style={{ color: 'var(--fifa-red, #e63946)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={profileForm.display_name}
                  onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="اسمك كما تريد أن يظهر في الصدارة"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: 'var(--fifa-surface-2)', border: '1px solid var(--fifa-line)',
                    color: 'var(--fifa-text)', fontSize: 14, fontFamily: 'Tajawal, sans-serif',
                    outline: 'none', direction: 'rtl',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 6, fontWeight: 600 }}>
                  رقم التليفون <span style={{ fontSize: 12, color: 'var(--fifa-muted)' }}>(مطلوب للحصول على النقاط)</span>
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="مثال: 01012345678"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: 'var(--fifa-surface-2)', border: '1px solid var(--fifa-line)',
                    color: 'var(--fifa-text)', fontSize: 14, fontFamily: 'Tajawal, sans-serif',
                    outline: 'none', direction: 'ltr', textAlign: 'right',
                  }}
                />
              </div>
            </div>

            {profileMsg && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, textAlign: 'center',
                background: profileMsg.includes('✅') ? 'rgba(39,176,110,.1)' : 'rgba(230,57,70,.1)',
                color: profileMsg.includes('✅') ? '#27b06e' : '#e63946',
                border: `1px solid ${profileMsg.includes('✅') ? 'rgba(39,176,110,.2)' : 'rgba(230,57,70,.2)'}`,
              }}>
                {profileMsg}
              </div>
            )}

            <button
              onClick={saveProfile}
              disabled={profileSaving}
              style={{
                marginTop: 18, width: '100%', padding: '12px', borderRadius: 12,
                background: profileSaving ? 'var(--fifa-surface-2)' : 'var(--fifa-red, #e63946)',
                border: 'none', color: '#fff', fontWeight: 800, fontSize: 15,
                fontFamily: 'Tajawal, sans-serif', cursor: profileSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {profileSaving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}
            </button>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['predict', 'my', 'leaders'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px', borderRadius: 12, border: '1px solid var(--fifa-line)',
                background: activeTab === tab ? 'var(--fifa-red, #e63946)' : 'var(--fifa-surface)',
                color: activeTab === tab ? '#fff' : 'var(--fifa-muted)',
                fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif',
                transition: 'all .2s',
              }}>
              {tab === 'predict' ? '⚽ التوقعات' : tab === 'my' ? '📋 توقعاتي' : '🏆 الصدارة'}
            </button>
          ))}
        </div>

        {/* ════════════ PREDICT TAB ════════════ */}
        {activeTab === 'predict' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {rounds.map(r => (
                <button key={r} onClick={() => setActiveRound(r)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: '1px solid var(--fifa-line)',
                    background: activeRound === r ? 'var(--fifa-surface-2)' : 'transparent',
                    color: activeRound === r ? 'var(--fifa-text)' : 'var(--fifa-muted)',
                    fontWeight: activeRound === r ? 700 : 400, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif',
                  }}>
                  {roundLabels[r]}&nbsp; ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--fifa-muted)' }}>لا توجد ماتشات في هذه الجولة</div>
            ) : filteredMatches.map(match => {
              const existing = predictions.find(p => p.fixture_id === match.fixture.id);
              const form = getForm(match);
              const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const msg = messages[match.fixture.id];
              return (
                <div key={match.fixture.id} style={{ background: 'var(--fifa-surface)', borderRadius: 16, border: '1px solid var(--fifa-line)', padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {match.teams.home.name} &nbsp;×&nbsp; {match.teams.away.name}
                      </div>
                      <div style={{ color: 'var(--fifa-muted)', fontSize: 13, marginTop: 4 }}>
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: match.is_open ? 'rgba(39,176,110,.12)' : 'rgba(255,255,255,.05)', color: match.is_open ? '#27b06e' : 'var(--fifa-muted)' }}>
                        {match.is_open ? 'مفتوح' : 'مغلق'}
                      </span>
                      {existing && <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(39,176,110,.1)', color: '#27b06e' }}>✅ محفوظ</span>}
                    </div>
                  </div>

                  {hasResult && (
                    <div style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 22 }}>{match.actual_home_score} — {match.actual_away_score}</div>
                      <div style={{ color: 'var(--fifa-muted)', fontSize: 13 }}>النتيجة الفعلية</div>
                      {match.first_scorer && <div style={{ fontSize: 13 }}>⚽ أول هدف: {match.first_scorer}</div>}
                      {existing && (
                        <div style={{ fontWeight: 700, fontSize: 14, color: existing.points >= 10 ? '#ffe3a6' : existing.points >= 5 ? '#5effa8' : 'var(--fifa-muted)' }}>
                          نقاطك: <strong>{existing.points || 0}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {match.is_open && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 10, fontWeight: 600 }}>توقع النتيجة</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {[{ key: 'homeScore', team: match.teams.home.name }, { key: 'awayScore', team: match.teams.away.name }].map(({ key, team }) => (
                            <div key={key} style={{ flex: 1, minWidth: 140, background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{team}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button onClick={() => setForm(match.fixture.id, { [key]: Math.max(0, (form[key] || 0) - 1) })} style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--fifa-surface-2)', border: '1px solid var(--fifa-line)', color: 'var(--fifa-text)', fontSize: 18, fontWeight: 900, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>−</button>
                                <span style={{ fontWeight: 900, fontSize: 20, minWidth: 24, textAlign: 'center' }}>{form[key] || 0}</span>
                                <button onClick={() => setForm(match.fixture.id, { [key]: (form[key] || 0) + 1 })} style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--fifa-red, #e63946)', border: 'none', color: '#fff', fontSize: 18, fontWeight: 900, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--fifa-muted)', fontWeight: 600 }}>⚽ أول هدف &nbsp;<span style={{ color: 'rgba(39,176,110,.8)', fontSize: 11 }}>+3 نقاط</span></span>
                        <input type="text" value={form.firstScorer} onChange={e => setForm(match.fixture.id, { firstScorer: e.target.value })}
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fifa-text)', fontSize: 14, fontFamily: 'Tajawal, sans-serif', textAlign: 'right' }}
                          placeholder="مثال: مبابي" />
                      </div>

                      <label style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.extraTime} onChange={e => setForm(match.fixture.id, { extraTime: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--fifa-red, #e63946)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>⏱️ الماتش هيروح لوقت إضافي؟</span>
                        <span style={{ fontSize: 11, color: 'rgba(39,176,110,.8)', marginRight: 'auto' }}>+2 نقاط</span>
                      </label>

                      {match.surprise_question && (
                        <div style={{ background: 'rgba(192,132,252,.06)', borderRadius: 12, border: '1px solid rgba(192,132,252,.15)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>🎯 {match.surprise_question} <span style={{ fontSize: 11, color: 'rgba(192,132,252,.8)', marginRight: 6 }}>+5 نقاط</span></div>
                          <input type="text" value={form.surpriseAnswer} onChange={e => setForm(match.fixture.id, { surpriseAnswer: e.target.value })}
                            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(192,132,252,.2)', outline: 'none', color: 'var(--fifa-text)', fontSize: 14, fontFamily: 'Tajawal, sans-serif', padding: '4px 0', direction: 'rtl' }}
                            placeholder="إجابتك..." />
                        </div>
                      )}

                      {msg && (
                        <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, textAlign: 'center', background: msg.includes('✅') ? 'rgba(39,176,110,.1)' : 'rgba(230,57,70,.1)', color: msg.includes('✅') ? '#27b06e' : '#e63946' }}>
                          {msg}
                        </div>
                      )}

                      <button onClick={() => submitPrediction(match)}
                        style={{ padding: '12px', borderRadius: 12, background: 'var(--fifa-red, #e63946)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                        {submitting === match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}

                  {!match.is_open && !hasResult && existing && (
                    <div style={{ background: 'var(--fifa-surface-2)', borderRadius: 12, padding: '12px 16px' }}>
                      <div style={{ color: 'var(--fifa-muted)', fontSize: 13, marginBottom: 8 }}>توقعك المسجّل</div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>{existing.predicted_home_score} — {existing.predicted_away_score}</div>
                      {existing.predicted_first_scorer && <div style={{ fontSize: 13, marginTop: 6 }}>⚽ {existing.predicted_first_scorer}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════ MY PREDICTIONS TAB ════════════ */}
        {activeTab === 'my' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>توقعاتي</h2>
              <div style={{ color: 'var(--fifa-muted)', fontSize: 14 }}>🏆 {myPoints} نقطة</div>
            </div>

            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--fifa-muted)' }}>لم تقدم أي توقعات بعد</div>
            ) : predictions.map(p => {
              const hasResult = p.actual_home_score !== null;
              return (
                <div key={p.id} style={{
                  background: 'var(--fifa-surface)', borderRadius: 14, border: '1px solid var(--fifa-line)',
                  padding: '14px 18px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                  ...(p.points >= 10 ? { borderColor: 'rgba(217,178,95,.25)', background: 'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))' } : {}),
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.home_team} × {p.away_team}</div>
                    <div style={{ fontSize: 13, color: 'var(--fifa-muted)', marginTop: 4 }}>
                      توقعك: <strong>{p.predicted_home_score} — {p.predicted_away_score}</strong>
                      {p.predicted_first_scorer && <span style={{ marginRight: 8 }}>⚽ {p.predicted_first_scorer}</span>}
                    </div>
                    {hasResult && (
                      <div style={{ fontSize: 13, marginTop: 4, color: 'var(--fifa-muted)' }}>
                        الفعلية: <strong>{p.actual_home_score} — {p.actual_away_score}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontWeight: 900, fontSize: 22, minWidth: 48, textAlign: 'center', padding: '6px 12px', borderRadius: 10,
                    background: !hasResult ? 'var(--fifa-surface-2)' : p.points >= 10 ? 'rgba(217,178,95,.12)' : p.points >= 5 ? 'rgba(39,176,110,.12)' : 'var(--fifa-surface-2)',
                    color: !hasResult ? 'var(--fifa-muted)' : p.points >= 10 ? '#ffe3a6' : p.points >= 5 ? '#5effa8' : 'var(--fifa-muted)',
                  }}>
                    {hasResult ? `${p.points || 0}` : '⏳'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════ LEADERBOARD TAB ════════════ */}
        {activeTab === 'leaders' && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>🏆 ترتيب المتسابقين</h2>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--fifa-muted)' }}>لا توجد نتائج بعد</div>
            ) : leaderboard.map((player: any, i) => {
              const isMe = player.user_id === user?.id;
              const name = player.display_name || player.user_email?.split('@')[0];
              return (
                <div key={player.user_id} style={{
                  background: isMe ? 'linear-gradient(90deg,rgba(230,57,70,.08),rgba(255,255,255,.01))' : 'var(--fifa-surface)',
                  borderRadius: 14, border: isMe ? '1px solid rgba(230,57,70,.25)' : '1px solid var(--fifa-line)',
                  padding: '14px 18px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ fontSize: i < 3 ? 24 : 16, minWidth: 36, textAlign: 'center', fontWeight: 900 }}>
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {name}
                      {isMe && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(230,57,70,.12)', color: 'var(--fifa-red, #e63946)' }}>أنت</span>}
                      {player.profile_completed && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(39,176,110,.1)', color: '#27b06e' }}>✅</span>}
                    </div>
                    <div style={{ color: 'var(--fifa-muted)', fontSize: 12, marginTop: 2 }}>{player.count} توقع</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{player.totalPoints} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fifa-muted)' }}>نقطة</span></div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
