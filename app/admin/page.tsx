'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['i.g.webmaster.web@gmail.com'];

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches'|'predictions'|'leaderboard'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success'|'error'>('success');
  const [showModal, setShowModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [firstScorer, setFirstScorer] = useState('');
  const [extraTime, setExtraTime] = useState(false);
  const [surpriseQ, setSurpriseQ] = useState('');
  const [surpriseA, setSurpriseA] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const router = useRouter();

  const rounds = ['Group Stage - 1','Group Stage - 2','Group Stage - 3'];
  const roundLabels: Record<string,string> = {
    'Group Stage - 1':'الجولة الأولى',
    'Group Stage - 2':'الجولة الثانية',
    'Group Stage - 3':'الجولة الثالثة',
  };

  const showMsg = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];
      const { data: sbFixtures } = await supabase
        .from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,surprise_answer,surprise_question');
      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      setMatches(apiMatches.map((m: any) => {
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
      }));
    } catch (err) { console.error('loadMatches:', err); }
    setLoading(false);
  }, []);

  const loadPredictions = useCallback(async () => {
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .not('fixture_id', 'is', null)
      .order('submitted_at', { ascending: false });

    const { data: pts } = await supabase.from('user_points').select('user_id,full_name,user_email');
    const nameMap = new Map(pts?.map((p: any) => [p.user_id, p.full_name || p.user_email?.split('@')[0]]) || []);

    setPredictions((preds || []).map((p: any) => ({
      ...p,
      user_name: nameMap.get(p.user_id) || p.user_email?.split('@')[0],
    })));
  }, []);

  // ✅ يقرأ من user_points مباشرة بدل predictions
  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .order('total_points', { ascending: false });
    setLeaderboard((data || []).map((row: any) => ({
      user_id: row.user_id,
      user_email: row.user_email,
      full_name: row.full_name,
      total: row.total_points || 0,
      count: row.predictions_count || 0,
      best: 0,
    })));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || '')) {
        router.push('/dashboard'); return;
      }
      setUser(data.user);
      loadMatches(); loadPredictions(); loadLeaderboard();
    });
  }, [router, loadMatches, loadPredictions, loadLeaderboard]);

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open;
    const fid = match.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fid).maybeSingle();
      if (se) throw se;
      if (ex) {
        const { error } = await supabase.from('fixtures').update({ is_open: newStatus }).eq('api_fixture_id', fid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id: fid, is_open: newStatus,
          home_team: match.teams.home.name, away_team: match.teams.away.name,
          match_date: match.fixture.date, round: match.league.round,
        });
        if (error) throw error;
      }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
    } catch (err: any) {
      showMsg('❌ ' + (err?.message || 'خطأ في التحديث'), 'error');
    }
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setHomeScore(match.actual_home_score ?? 0);
    setAwayScore(match.actual_away_score ?? 0);
    setFirstScorer(match.first_scorer ?? '');
    setExtraTime(match.went_extra_time ?? false);
    setSurpriseQ(match.surprise_question ?? '');
    setSurpriseA(match.surprise_answer ?? '');
    setShowModal(true);
  };

  const saveResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fid = selectedMatch.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fid).maybeSingle();
      if (se) throw se;
      const payload = {
        actual_home_score: homeScore, actual_away_score: awayScore,
        first_scorer: firstScorer || null, went_extra_time: extraTime,
        surprise_answer: surpriseA || null, surprise_question: surpriseQ || null,
      };
      if (ex) {
        const { error } = await supabase.from('fixtures').update(payload).eq('api_fixture_id', fid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id: fid, is_open: false,
          home_team: selectedMatch.teams.home.name, away_team: selectedMatch.teams.away.name,
          match_date: selectedMatch.fixture.date, round: selectedMatch.league.round, ...payload,
        });
        if (error) throw error;
      }
      setShowModal(false);
      await loadMatches();
      showMsg('✅ تم حفظ النتيجة بنجاح');
    } catch (err: any) {
      showMsg('❌ ' + (err?.message || 'خطأ في الحفظ'), 'error');
    }
    setSavingResult(false);
  };

  const openAllMatches = async () => {
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound);
    let ok = 0, fail = 0;
    for (const match of filtered) {
      const fid = match.fixture.id;
      try {
        const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fid).maybeSingle();
        if (se) throw se;
        if (ex) {
          const { error } = await supabase.from('fixtures').update({ is_open: true }).eq('api_fixture_id', fid);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('fixtures').insert({
            api_fixture_id: fid, is_open: true,
            home_team: match.teams.home.name, away_team: match.teams.away.name,
            match_date: match.fixture.date, round: match.league.round,
          });
          if (error) throw error;
        }
        ok++;
      } catch { fail++; }
    }
    await loadMatches();
    setUpdating(false);
    showMsg(fail === 0 ? `✅ تم فتح ${ok} ماتش` : `⚠️ فتح ${ok} — فشل ${fail}`, fail === 0 ? 'success' : 'error');
  };

  const closeAllMatches = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/admin-close-all');
      const data = await res.json();
      showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ ' + data.error, data.success ? 'success' : 'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في الغلق', 'error'); }
    setUpdating(false);
  };

  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/update-results');
      const data = await res.json();
      showMsg(data.success ? data.message || '✅ تم تحديث النقاط' : '❌ ' + data.error, data.success ? 'success' : 'error');
      if (data.success) { await loadPredictions(); await loadLeaderboard(); }
    } catch { showMsg('❌ خطأ في الاتصال', 'error'); }
    setUpdating(false);
  };

  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count || ''} ماتش` : '❌ ' + data.error, data.success ? 'success' : 'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في المزامنة', 'error'); }
    setSyncing(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#080c14', color: '#fff', fontFamily: 'Tajawal,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
        <p>جاري التحميل...</p>
      </div>
    </div>
  );

  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const openCount = matches.filter(m => m.is_open).length;
  const gradedCount = predictions.filter(p => p.actual_home_score !== null).length;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        :root {
  --fifa-bg:#070809;
--fifa-surface:#111315;
--fifa-surface-2:#171a1d;
--fifa-surface-3:#1d2125;
--fifa-red:#c93a2f;
--fifa-gold:#d9b25f;
--fifa-green:#27b06e;
--fifa-blue:#3b82f6;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--fifa-bg);color:var(--fifa-text);font-family:Tajawal,sans-serif;direction:rtl}
        .tab-btn{padding:10px 20px;border-radius:10px;border:1px solid var(--fifa-line);background:transparent;color:var(--fifa-muted);cursor:pointer;font-family:Tajawal,sans-serif;font-size:14px;font-weight:700;transition:all .2s}
        .tab-btn.active{background:var(--fifa-surface-3);border-color:rgba(255,255,255,0.15);color:var(--fifa-text)}
        .round-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--fifa-line);background:transparent;color:var(--fifa-muted);cursor:pointer;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;transition:all .2s}
        .round-btn.active{background:var(--fifa-red);border-color:var(--fifa-red);color:#fff}
        .action-btn{padding:10px 20px;border-radius:10px;border:none;color:#fff;cursor:pointer;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;transition:all .2s}
        .fifa-field-input{width:100%;padding:12px 16px;borderRadius:10px;background:var(--fifa-surface-3);border:1px solid var(--fifa-line);color:var(--fifa-text);font-family:Tajawal,sans-serif;font-size:14px;outline:none}
        .fifa-field-input:focus{border-color:var(--fifa-red)}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--fifa-line);font-size:13px}
        th{color:var(--fifa-muted);font-weight:700;background:var(--fifa-surface-2)}
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: 'linear-gradient(135deg,#0d1117,#111827)', borderBottom: '1px solid var(--fifa-line)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>لوحة التحكم</h1>
            <p style={{ fontSize: 12, color: 'var(--fifa-muted)', margin: 0 }}>كأس العالم 2026 — الشمعدان</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* ✅ رابط الصدارة العامة */}
          <a href="/leaderboard" target="_blank" rel="noopener noreferrer"
            style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--fifa-line)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13, fontFamily: 'Tajawal,sans-serif', fontWeight: 700 }}>
            🏁 الصدارة العامة
          </a>
          <button className="action-btn" style={{ background: 'var(--fifa-blue)' }} onClick={syncFixtures} disabled={syncing}>
            {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الماتشات'}
          </button>
          <button className="action-btn" style={{ background: 'var(--fifa-green)' }} onClick={updateAllPoints} disabled={updating}>
            {updating ? '⏳ جاري التحديث...' : '⚡ تحديث النقاط'}
          </button>
          <button className="action-btn" style={{ background: 'var(--fifa-red)' }} onClick={handleLogout}>
            خروج
          </button>
        </div>
      </header>

      {/* MESSAGE */}
      {message && (
        <div style={{ margin: '12px 24px', padding: '12px 18px', borderRadius: 10, background: msgType === 'success' ? 'rgba(39,176,110,0.15)' : 'rgba(232,0,45,0.15)', border: `1px solid ${msgType === 'success' ? 'rgba(39,176,110,0.3)' : 'rgba(232,0,45,0.3)'}`, color: msgType === 'success' ? '#5effa8' : '#ff9c91', fontWeight: 700, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'إجمالي التوقعات', value: predictions.length, color: 'var(--fifa-gold)' },
            { label: 'توقعات محسوبة', value: gradedCount, color: 'var(--fifa-green)' },
            { label: 'ماتشات مفتوحة', value: openCount, color: '#facc15' },
            { label: 'المتسابقين', value: leaderboard.length, color: '#ff9c91' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--fifa-surface)', border: '1px solid var(--fifa-line)', borderRadius: 14, padding: '16px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--fifa-muted)', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['matches', 'predictions', 'leaderboard'] as const).map(tab => (
            <button key={tab} className={`tab-btn${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'matches' ? `🏟️ الماتشات (${matches.length})` : tab === 'predictions' ? `📋 التوقعات (${predictions.length})` : `🏆 الصدارة (${leaderboard.length})`}
            </button>
          ))}
        </div>

        {/* ── MATCHES ── */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound === r ? ' active' : ''}`} onClick={() => setActiveRound(r)}>
                  {roundLabels[r]}  ({matches.filter(m => m.league.round === r).length})
                </button>
              ))}
              <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
                <button className="action-btn" style={{ background: 'var(--fifa-green)', fontSize: 12, padding: '8px 14px' }} onClick={openAllMatches} disabled={updating}>🟢 فتح الكل</button>
                <button className="action-btn" style={{ background: 'var(--fifa-muted)', fontSize: 12, padding: '8px 14px' }} onClick={closeAllMatches} disabled={updating}>🔒 غلق الكل</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredMatches.map(match => {
                const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
                const matchPreds = predictions.filter(p => p.fixture_id === match.fixture.id);
                return (
                  <div key={match.fixture.id} style={{ background: 'var(--fifa-surface)', border: '1px solid var(--fifa-line)', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                          {match.teams.home.name} × {match.teams.away.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fifa-muted)', marginBottom: 6 }}>
                          {new Date(match.fixture.date).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: match.is_open ? 'rgba(39,176,110,0.15)' : 'rgba(255,255,255,0.05)', color: match.is_open ? '#5effa8' : 'var(--fifa-muted)', border: `1px solid ${match.is_open ? 'rgba(39,176,110,0.3)' : 'var(--fifa-line)'}` }}>
                            {match.is_open ? 'مفتوح' : 'مغلق'}
                          </span>
                          {matchPreds.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--fifa-muted)' }}>👥 {matchPreds.length} توقع</span>
                          )}
                        </div>
                        {hasResult && (
                          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(217,178,95,0.08)', border: '1px solid rgba(217,178,95,0.2)', fontSize: 13 }}>
                            <span style={{ color: 'var(--fifa-gold)', fontWeight: 800 }}>{match.actual_home_score} — {match.actual_away_score}</span>
                            {match.first_scorer && <span style={{ color: 'var(--fifa-muted)', marginRight: 10 }}>⚽ {match.first_scorer}</span>}
                            {match.went_extra_time && <span style={{ color: 'var(--fifa-muted)', marginRight: 10 }}>⏱️ وقت إضافي</span>}
                            {match.surprise_question && <div style={{ color: 'var(--fifa-muted)', fontSize: 12, marginTop: 4 }}>❓ {match.surprise_question}</div>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button className="action-btn" style={{ background: match.is_open ? 'var(--fifa-muted)' : 'var(--fifa-green)', fontSize: 12, padding: '8px 14px' }} onClick={() => toggleMatchOpen(match)}>
                          {match.is_open ? '🔒 غلق التوقعات' : '🟢 فتح التوقعات'}
                        </button>
                        <button className="action-btn" style={{ background: 'var(--fifa-blue)', fontSize: 12, padding: '8px 14px' }} onClick={() => openResultModal(match)}>
                          {hasResult ? '✏️ تعديل النتيجة' : '⚽ إدخال النتيجة'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PREDICTIONS ── */}
        {activeTab === 'predictions' && (
          <div style={{ background: 'var(--fifa-surface)', borderRadius: 14, border: '1px solid var(--fifa-line)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>{['المستخدم', 'الماتش', 'توقعي', 'الفعلية', 'أول هدف', 'إضافي', 'النقاط'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {predictions.filter(p => p.fixture_id && p.home_team !== 'BONUS' && p.user_email).map(p => (
                    <tr key={p.id} style={{ background: p.points >= 10 ? 'rgba(217,178,95,.08)' : p.points >= 5 ? 'rgba(39,176,110,.06)' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{p.user_name || p.user_email?.split('@')[0] || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.home_team} × {p.away_team}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.predicted_home_score} - {p.predicted_away_score}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fifa-muted)' }}>{p.actual_home_score !== null ? `${p.actual_home_score} - ${p.actual_away_score}` : '⏳'}</td>
                      <td style={{ fontSize: 12, color: 'var(--fifa-muted)' }}>{p.predicted_first_scorer || '—'}</td>
                      <td>{p.predicted_extra_time ? 'نعم' : 'لا'}</td>
                      <td style={{ fontWeight: 900, color: p.points >= 10 ? '#ffe3a6' : p.points >= 5 ? '#5effa8' : 'var(--fifa-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {p.actual_home_score !== null ? (p.points || 0) : '—'}
                      </td>
                    </tr>
                  ))}
                  {predictions.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fifa-muted)' }}>لا توجد توقعات بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ── ✅ يقرأ من user_points */}
        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--fifa-muted)' }}>لا توجد بيانات بعد</div>
            ) : leaderboard.filter((p: any) => p.user_email || p.full_name).map((p: any, i) => (
              <div key={p.user_id} style={{ background: 'var(--fifa-surface)', border: '1px solid var(--fifa-line)', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ minWidth: 44, textAlign: 'center', fontSize: i < 3 ? 24 : 15, fontWeight: 900, color: i === 0 ? 'var(--fifa-gold)' : 'var(--fifa-muted)' }}>
                  {i < 3 ? medals[i] : `#${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  {/* ✅ يعرض الاسم الحقيقي */}
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{p.full_name || p.user_email?.split('@')[0]}</div>
                  <div style={{ fontSize: 12, color: 'var(--fifa-muted)' }}>{p.count} توقع · أفضل: {p.best} نقطة</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 22, color: i === 0 ? 'var(--fifa-gold)' : 'var(--fifa-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.total} <span style={{ fontSize: 12, color: 'var(--fifa-muted)', fontWeight: 400 }}>نقطة</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && selectedMatch && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--fifa-surface-2)', border: '1px solid var(--fifa-line)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>إدخال نتيجة المباراة</h3>
                <p style={{ fontSize: 13, color: 'var(--fifa-muted)', margin: '4px 0 0' }}>{selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--fifa-surface-3)', border: '1px solid var(--fifa-line)', color: 'var(--fifa-muted)', fontSize: 20, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>×</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 12 }}>النتيجة الفعلية</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { team: selectedMatch.teams.home.name, val: homeScore, set: setHomeScore },
                { team: selectedMatch.teams.away.name, val: awayScore, set: setAwayScore },
              ].map(({ team, val, set }) => (
                <div key={team} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--fifa-muted)', marginBottom: 8 }}>{team}</p>
                  <input type="number" min={0} value={val} onChange={e => set(Number(e.target.value))}
                    style={{ width: '100%', height: 64, borderRadius: 14, background: '#fff', color: '#000', fontSize: 32, fontWeight: 900, textAlign: 'center', border: 'none', outline: 'none', fontFamily: 'Cairo,Tajawal,sans-serif' }} />
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 8 }}>⚽ أول هدف</p>
            <input className="fifa-field-input" type="text" value={firstScorer} onChange={e => setFirstScorer(e.target.value)} placeholder="مثال: محمد صلاح" style={{ marginBottom: 16, width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--fifa-surface-3)', border: '1px solid var(--fifa-line)', color: 'var(--fifa-text)', fontFamily: 'Tajawal,sans-serif', fontSize: 14, outline: 'none' }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={extraTime} onChange={e => setExtraTime(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--fifa-red)', flexShrink: 0 }} />
              ⏱️ الماتش راح لوقت إضافي؟
            </label>

            <p style={{ fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 8 }}>❓ سؤال المفاجأة</p>
            <input type="text" value={surpriseQ} onChange={e => setSurpriseQ(e.target.value)} placeholder="مثال: من هيكون أفضل لاعب؟"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--fifa-surface-3)', border: '1px solid var(--fifa-line)', color: 'var(--fifa-text)', fontFamily: 'Tajawal,sans-serif', fontSize: 14, outline: 'none', marginBottom: 12 }} />

            <p style={{ fontSize: 13, color: 'var(--fifa-muted)', marginBottom: 8 }}>🎯 الإجابة الصحيحة <span style={{ fontSize: 11, background: 'rgba(192,132,252,0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: 100, marginRight: 4 }}>+5 نقاط</span></p>
            <input type="text" value={surpriseA} onChange={e => setSurpriseA(e.target.value)} placeholder="الإجابة الصحيحة"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--fifa-surface-3)', border: '1px solid var(--fifa-line)', color: 'var(--fifa-text)', fontFamily: 'Tajawal,sans-serif', fontSize: 14, outline: 'none', marginBottom: 20 }} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[['#facc15','🏆 نتيجة كاملة = 10'],['#5effa8','✅ فايز صح = 5'],['#60a5fa','⚽ أول هدف = 3'],['#93c5fd','⏱️ وقت إضافي = 2'],['#c084fc','🎯 مفاجأة = 5'],['var(--fifa-muted)','الحد الأقصى = 25']].map(([color,text]) => (
                <span key={text} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color }}>{text}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="action-btn" style={{ flex: 1, background: 'var(--fifa-green)', padding: '14px 0' }} onClick={saveResult} disabled={savingResult}>
                {savingResult ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة'}
              </button>
              <button className="action-btn" style={{ flex: 1, background: 'var(--fifa-surface-3)', border: '1px solid var(--fifa-line)' }} onClick={() => setShowModal(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
