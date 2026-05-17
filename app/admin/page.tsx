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
  const [leagues, setLeagues] = useState<any[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string, any[]>>({});
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches'|'predictions'|'leaderboard'|'leagues'>('matches');
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

  // ✅ Rounds ديناميكية من الماتشات
  const roundLabels: Record<string,string> = {
    'Group Stage - 1': 'الجولة الأولى',
    'Group Stage - 2': 'الجولة الثانية',
    'Group Stage - 3': 'الجولة الثالثة',
    'Round of 16':     'دور الـ 16',
    'Quarter-finals':  'ربع النهائي',
    'Semi-finals':     'نصف النهائي',
    '3rd Place Final': 'مباراة الثالث',
    'Final':           'النهائي',
  };
  const rounds = [...new Set(matches.map((m: any) => m.league?.round).filter(Boolean))] as string[];

  const showMsg = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];
      const { data: sbFixtures } = await supabase.from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,surprise_answer,surprise_question');
      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
        return { ...m, is_open: sb?.is_open ?? false, actual_home_score: sb?.actual_home_score ?? null, actual_away_score: sb?.actual_away_score ?? null, first_scorer: sb?.first_scorer ?? '', went_extra_time: sb?.went_extra_time ?? false, surprise_answer: sb?.surprise_answer ?? '', surprise_question: sb?.surprise_question ?? '' };
      });
      setMatches(merged);
      // ✅ ضبط activeRound أوتوماتيك
      const avail = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (avail.length > 0) setActiveRound(prev => avail.includes(prev) ? prev : avail[0]);
    } catch (err) { console.error('loadMatches:', err); }
    setLoading(false);
  }, []);

  const loadPredictions = useCallback(async () => {
    const { data: preds } = await supabase.from('predictions').select('*').not('fixture_id','is',null).order('submitted_at',{ascending:false});
    const { data: pts } = await supabase.from('user_points').select('user_id,full_name,user_email');
    const nameMap = new Map(pts?.map((p: any) => [p.user_id, p.full_name || p.user_email?.split('@')[0]]) || []);
    setPredictions((preds || []).map((p: any) => ({ ...p, user_name: nameMap.get(p.user_id) || p.user_email?.split('@')[0] })));
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabase.from('user_points').select('*').order('total_points',{ascending:false});
    setLeaderboard((data || []).map((row: any) => ({ user_id: row.user_id, user_email: row.user_email, full_name: row.full_name, total: row.total_points || 0, count: row.predictions_count || 0 })));
  }, []);

  // ✅ تحميل الليجات مع إحصائياتها
  const loadLeagues = useCallback(async () => {
    const { data: lgs } = await supabase.from('mini_leagues').select('*').order('created_at', { ascending: false });
    // ✅ جلب الأعضاء بدون nested join — بنجيب user_points منفصلة ونعمل map يدوي
    const { data: members } = await supabase.from('mini_league_members').select('*');
    const { data: invites } = await supabase.from('mini_league_invitations').select('league_id, status');
    // ✅ جلب بيانات المستخدمين من user_points
    const { data: userPts } = await supabase.from('user_points').select('user_id, full_name, user_email, total_points');
    const userPtsMap = new Map((userPts || []).map((u: any) => [u.user_id, u]));

    // إثراء كل عضو ببياناته من user_points
    const enrichedMembers = (members || []).map((m: any) => ({
      ...m,
      _profile: userPtsMap.get(m.user_id) || null,
    }));

    const membersMap: Record<string, any[]> = {};
    enrichedMembers.forEach((m: any) => {
      if (!membersMap[m.league_id]) membersMap[m.league_id] = [];
      membersMap[m.league_id].push(m);
    });
    const pendingMap: Record<string, number> = {};
    (invites || []).filter((i: any) => i.status === 'pending').forEach((i: any) => {
      pendingMap[i.league_id] = (pendingMap[i.league_id] || 0) + 1;
    });

    // ✅ جلب مالك كل ليج
    const ownerMap: Record<string, string> = {};
    (lgs || []).forEach((lg: any) => {
      const ownerMember = (membersMap[lg.id] || []).find((m: any) => m.role === 'owner' || m.user_id === lg.created_by);
      if (ownerMember) {
        ownerMap[lg.id] = ownerMember._profile?.full_name || ownerMember._profile?.user_email?.split('@')[0] || 'غير معروف';
      }
    });

    setLeagueMembers(membersMap);
    setLeagues((lgs || []).map((lg: any) => {
      const lgMembers = membersMap[lg.id] || [];
      const points = lgMembers.map((m: any) => m._profile?.total_points || 0);
      return {
        ...lg,
        member_count: lgMembers.length,
        pending_invites: pendingMap[lg.id] || 0,
        top_points: points.length ? Math.max(...points) : 0,
        owner_name: ownerMap[lg.id] || '—',
      };
    }));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || '')) { router.push('/dashboard'); return; }
      setUser(data.user);
      loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues();
    });
  }, [router, loadMatches, loadPredictions, loadLeaderboard, loadLeagues]);

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open; const fid = match.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      if (ex) { const { error } = await supabase.from('fixtures').update({is_open:newStatus}).eq('api_fixture_id',fid); if (error) throw error; }
      else { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:newStatus,home_team:match.teams.home.name,away_team:match.teams.away.name,match_date:match.fixture.date,round:match.league.round}); if (error) throw error; }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
    } catch (err: any) { showMsg('❌ ' + (err?.message || 'خطأ'), 'error'); }
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match); setHomeScore(match.actual_home_score ?? 0); setAwayScore(match.actual_away_score ?? 0);
    setFirstScorer(match.first_scorer ?? ''); setExtraTime(match.went_extra_time ?? false);
    setSurpriseQ(match.surprise_question ?? ''); setSurpriseA(match.surprise_answer ?? '');
    setShowModal(true);
  };

  const saveResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fid = selectedMatch.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id', fid).maybeSingle();
      if (se) throw se;
      const payload = { actual_home_score: homeScore, actual_away_score: awayScore, first_scorer: firstScorer || null, went_extra_time: extraTime, surprise_answer: surpriseA || null, surprise_question: surpriseQ || null };
      if (ex) { const { error } = await supabase.from('fixtures').update(payload).eq('api_fixture_id', fid); if (error) throw error; }
      else { const { error } = await supabase.from('fixtures').insert({ api_fixture_id: fid, is_open: false, home_team: selectedMatch.teams.home.name, away_team: selectedMatch.teams.away.name, match_date: selectedMatch.fixture.date, round: selectedMatch.league.round, ...payload }); if (error) throw error; }
      const res = await fetch('/api/update-results');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'خطأ في حساب النقاط');
      setShowModal(false);
      await loadMatches(); await loadPredictions(); await loadLeaderboard();
      showMsg(`✅ تم حفظ النتيجة وتحديث النقاط — ${data.message || ''}`);
    } catch (err: any) { showMsg('❌ ' + (err?.message || 'خطأ في الحفظ'), 'error'); }
    setSavingResult(false);
  };

  // ✅ فتح الكل مع تأكيد
  const openAllMatches = async () => {
    if (!confirm(`فتح توقعات جميع ماتشات "${roundLabels[activeRound] || activeRound}"؟`)) return;
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound); let ok=0,fail=0;
    for (const match of filtered) {
      const fid = match.fixture.id;
      try {
        const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle(); if (se) throw se;
        if (ex) { const { error } = await supabase.from('fixtures').update({is_open:true}).eq('api_fixture_id',fid); if (error) throw error; }
        else { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:true,home_team:match.teams.home.name,away_team:match.teams.away.name,match_date:match.fixture.date,round:match.league.round}); if (error) throw error; }
        ok++;
      } catch { fail++; }
    }
    await loadMatches(); setUpdating(false);
    showMsg(fail === 0 ? `✅ تم فتح ${ok} ماتش` : `⚠️ فتح ${ok} — فشل ${fail}`, fail === 0 ? 'success' : 'error');
  };

  // ✅ غلق الكل مع تأكيد
  const closeAllMatches = async () => {
    if (!confirm('غلق جميع الماتشات الآن؟')) return;
    setUpdating(true);
    try { const res = await fetch('/api/admin-close-all'); const data = await res.json(); showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ ' + data.error, data.success ? 'success' : 'error'); await loadMatches(); }
    catch { showMsg('❌ خطأ في الغلق', 'error'); }
    setUpdating(false);
  };

  const updateAllPoints = async () => {
    setUpdating(true);
    try { const res = await fetch('/api/update-results'); const data = await res.json(); showMsg(data.success ? data.message || '✅ تم تحديث النقاط' : '❌ ' + data.error, data.success ? 'success' : 'error'); if (data.success) { await loadPredictions(); await loadLeaderboard(); } }
    catch { showMsg('❌ خطأ في الاتصال', 'error'); }
    setUpdating(false);
  };

  const syncFixtures = async () => {
    setSyncing(true);
    try { const res = await fetch('/api/sync-fixtures'); const data = await res.json(); showMsg(data.success ? `✅ تم مزامنة ${data.count || ''} ماتش` : '❌ ' + data.error, data.success ? 'success' : 'error'); await loadMatches(); }
    catch { showMsg('❌ خطأ في المزامنة', 'error'); }
    setSyncing(false);
  };

  // ✅ حذف ليج من الأدمن (invitations → members → league)
  const adminDeleteLeague = async (lg: any) => {
    if (!confirm(`حذف ليج "${lg.name}" نهائياً؟ لا يمكن التراجع.`)) return;
    try {
      await supabase.from('mini_league_invitations').delete().eq('league_id', lg.id);
      await supabase.from('mini_league_members').delete().eq('league_id', lg.id);
      const { error } = await supabase.from('mini_leagues').delete().eq('id', lg.id);
      if (error) throw error;
      showMsg(`🗑️ تم حذف ليج "${lg.name}"`);
      await loadLeagues();
    } catch (err: any) { showMsg('❌ ' + (err?.message || 'خطأ في الحذف'), 'error'); }
  };

  // ✅ إزالة عضو من ليج
  const adminRemoveMember = async (leagueId: string, userId: string, memberName: string) => {
    if (!confirm(`إزالة "${memberName}" من الليج؟`)) return;
    try {
      const { error } = await supabase.from('mini_league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
      if (error) throw error;
      showMsg(`✅ تم إزالة "${memberName}" من الليج`);
      await loadLeagues();
    } catch (err: any) { showMsg('❌ ' + (err?.message || 'خطأ'), 'error'); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#070809', color:'#f4f1e8', fontFamily:"'Cairo',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:30, margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(217,178,95,.25)' }}>⚙️</div>
        <p style={{ color:'#a8a39a' }}>جاري التحميل...</p>
      </div>
    </div>
  );

  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const openCount = matches.filter(m => m.is_open).length;
  const gradedCount = predictions.filter(p => p.actual_home_score !== null).length;
  const medals = ['🥇','🥈','🥉'];

  // إحصائيات الليجات
  const totalLeagueMembers = leagues.reduce((s, lg) => s + lg.member_count, 0);
  const totalPending = leagues.reduce((s, lg) => s + lg.pending_invites, 0);
  const biggestLeague = leagues.reduce((best, lg) => lg.member_count > (best?.member_count || 0) ? lg : best, null as any);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125;
          --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a;
          --gold:#d9b25f; --red:#c93a2f; --green:#27b06e; --blue:#3b82f6;
        }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:var(--bg); color:var(--text); font-family:'Cairo',sans-serif; direction:rtl; }
        .tab-btn { padding:10px 22px; border-radius:12px; border:1px solid var(--line); background:transparent; color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; transition:all .2s; }
        .tab-btn.active { background:linear-gradient(135deg,rgba(217,178,95,.15),rgba(217,178,95,.05)); border-color:rgba(217,178,95,.28); color:var(--gold); }
        .round-btn { padding:8px 16px; border-radius:10px; border:1px solid var(--line); background:transparent; color:var(--muted); cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:all .2s; }
        .round-btn.active { background:rgba(217,178,95,.14); border-color:rgba(217,178,95,.3); color:var(--gold); }
        .action-btn { padding:10px 20px; border-radius:12px; border:none; color:#fff; cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:opacity .18s; }
        .action-btn:disabled { opacity:.6; cursor:not-allowed; }
        .action-btn:hover:not(:disabled) { opacity:.85; }
        .field-input { width:100%; padding:12px 16px; border-radius:12px; background:var(--surface-3); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; outline:none; transition:border-color .2s; }
        .field-input:focus { border-color:rgba(217,178,95,.4); }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:10px 14px; text-align:right; border-bottom:1px solid var(--line); font-size:13px; }
        th { color:var(--muted); font-weight:700; background:var(--surface-2); }
        tr:hover td { background:rgba(255,255,255,.015); }
        .league-card { background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01)); border:1px solid var(--line); border-radius:18px; padding:16px 20px; margin-bottom:10px; }
        .league-card:hover { border-color:rgba(217,178,95,.2); }
        .member-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--line); gap:12px; }
        .member-row:last-child { border-bottom:none; }
        .del-btn { padding:6px 12px; border-radius:10px; border:1px solid rgba(201,58,47,.25); background:rgba(201,58,47,.08); color:#ff9c91; font-size:12px; font-weight:700; font-family:'Cairo',sans-serif; cursor:pointer; transition:opacity .18s; }
        .del-btn:hover { opacity:.75; }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'linear-gradient(180deg,rgba(217,178,95,.07),transparent), var(--surface)', borderBottom:'1px solid var(--line)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:22, flexShrink:0, boxShadow:'0 4px 16px rgba(217,178,95,.25)' }}>⚙️</div>
          <div>
            <h1 style={{ fontSize:17, fontWeight:800, margin:0 }}>لوحة التحكم</h1>
            <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>كأس العالم 2026 — الشمعدان</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <a href="/leaderboard" target="_blank" rel="noopener noreferrer" style={{ padding:'9px 16px', borderRadius:12, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--muted)', textDecoration:'none', fontSize:13, fontFamily:"'Cairo',sans-serif", fontWeight:700 }}>🏁 الصدارة</a>
          <button className="action-btn" style={{ background:'var(--blue)' }} onClick={syncFixtures} disabled={syncing}>{syncing ? '⏳ مزامنة...' : '🔄 مزامنة'}</button>
          <button className="action-btn" style={{ background:'var(--green)' }} onClick={updateAllPoints} disabled={updating}>{updating ? '⏳ جاري...' : '⚡ تحديث النقاط'}</button>
          <button className="action-btn" style={{ background:'var(--red)' }} onClick={handleLogout}>خروج</button>
        </div>
      </header>

      {/* MESSAGE */}
      {message && (
        <div style={{ margin:'12px 24px', padding:'12px 18px', borderRadius:14, background:msgType==='success'?'rgba(39,176,110,.12)':'rgba(201,58,47,.12)', border:`1px solid ${msgType==='success'?'rgba(39,176,110,.28)':'rgba(201,58,47,.28)'}`, color:msgType==='success'?'#5effa8':'#ff9c91', fontWeight:700, fontSize:14 }}>
          {message}
        </div>
      )}

      <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

        {/* STATS ROW — كل التابات */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'إجمالي التوقعات', value:predictions.length, color:'var(--gold)' },
            { label:'محسوبة',          value:gradedCount,         color:'var(--green)' },
            { label:'ماتشات مفتوحة',  value:openCount,           color:'#facc15' },
            { label:'المتسابقين',      value:leaderboard.length,  color:'#ff9c91' },
            { label:'ميني ليجات',      value:leagues.length,      color:'#a78bfa' },
            { label:'أعضاء ميني ليج', value:totalLeagueMembers,  color:'#38bdf8' },
            { label:'دعوات ليج معلقة', value:totalPending,       color:'#fb923c' },
          ].map(s => (
            <div key={s.label} style={{ background:'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', border:'1px solid var(--line)', borderRadius:18, padding:'16px 18px', textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{s.label}</p>
              <p style={{ fontSize:26, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {([
            { id:'matches',     label:`🏟️ الماتشات (${matches.length})` },
            { id:'predictions', label:`📋 التوقعات (${predictions.length})` },
            { id:'leaderboard', label:`🏆 الصدارة (${leaderboard.length})` },
            { id:'leagues',     label:`🏅 الليجات (${leagues.length})` },
          ] as const).map(({ id, label }) => (
            <button key={id} className={`tab-btn${activeTab===id?' active':''}`} onClick={()=>setActiveTab(id)}>{label}</button>
          ))}
        </div>

        {/* ══ MATCHES TAB ══ */}
        {activeTab==='matches' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              {rounds.map(r => (
                <button key={r} className={`round-btn${activeRound===r?' active':''}`} onClick={()=>setActiveRound(r)}>
                  {roundLabels[r] || r} ({matches.filter(m=>m.league.round===r).length})
                </button>
              ))}
              <div style={{ marginRight:'auto', display:'flex', gap:8 }}>
                <button className="action-btn" style={{ background:'var(--green)', fontSize:12, padding:'8px 14px' }} onClick={openAllMatches} disabled={updating}>🟢 فتح الكل</button>
                <button className="action-btn" style={{ background:'var(--surface-3)', border:'1px solid var(--line)', fontSize:12, padding:'8px 14px' }} onClick={closeAllMatches} disabled={updating}>🔒 غلق الكل</button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredMatches.map(match => {
                const hasResult = match.actual_home_score !== null && match.actual_home_score !== undefined;
                const matchPreds = predictions.filter(p => p.fixture_id === match.fixture.id);
                return (
                  <div key={match.fixture.id} style={{ background:'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))', border:'1px solid var(--line)', borderRadius:18, padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:200 }}>
                        <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>{match.teams.home.name} × {match.teams.away.name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>{new Date(match.fixture.date).toLocaleDateString('ar-EG',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:11, padding:'3px 10px', borderRadius:100, background:match.is_open?'rgba(39,176,110,.12)':'rgba(255,255,255,.04)', color:match.is_open?'#5effa8':'var(--muted)', border:`1px solid ${match.is_open?'rgba(39,176,110,.28)':'var(--line)'}` }}>{match.is_open?'مفتوح':'مغلق'}</span>
                          {matchPreds.length > 0 && <span style={{ fontSize:11, color:'var(--muted)' }}>👥 {matchPreds.length} توقع</span>}
                          {hasResult && <span style={{ fontSize:11, padding:'3px 10px', borderRadius:100, background:'rgba(217,178,95,.12)', color:'var(--gold)', border:'1px solid rgba(217,178,95,.28)' }}>النتيجة: {match.actual_home_score} - {match.actual_away_score}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                        <button className="action-btn" style={{ background:match.is_open?'rgba(201,58,47,.7)':'rgba(39,176,110,.7)', fontSize:12, padding:'8px 14px' }} onClick={()=>toggleMatchOpen(match)}>{match.is_open?'🔒 غلق':'🟢 فتح'}</button>
                        <button className="action-btn" style={{ background:'rgba(217,178,95,.25)', color:'var(--gold)', fontSize:12, padding:'8px 14px' }} onClick={()=>openResultModal(match)}>📝 {hasResult?'تعديل النتيجة':'إدخال النتيجة'}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredMatches.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>لا توجد ماتشات في هذه الجولة</div>}
            </div>
          </div>
        )}

        {/* ══ PREDICTIONS TAB ══ */}
        {activeTab==='predictions' && (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>اللاعب</th><th>المباراة</th><th>توقع</th><th>نتيجة فعلية</th><th>نقاط</th><th>وقت التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {predictions.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>لا توجد توقعات بعد</td></tr>
                  : predictions.map((p, i) => (
                    <tr key={p.id || i}>
                      <td style={{ fontWeight:700 }}>{p.user_name || p.user_email?.split('@')[0] || '—'}</td>
                      <td>{p.home_team} × {p.away_team}</td>
                      <td style={{ fontVariantNumeric:'tabular-nums' }}>{p.predicted_home_score} - {p.predicted_away_score}{p.predicted_extra_time ? ' (و)' : ''}</td>
                      <td style={{ color:'var(--gold)', fontVariantNumeric:'tabular-nums' }}>{p.actual_home_score !== null ? `${p.actual_home_score} - ${p.actual_away_score}` : '—'}</td>
                      <td style={{ fontWeight:800, color: p.points > 0 ? 'var(--green)' : 'var(--muted)', fontVariantNumeric:'tabular-nums' }}>{p.actual_home_score !== null ? (p.points || 0) : '—'}</td>
                      <td style={{ color:'var(--muted)' }}>{p.submitted_at ? new Date(p.submitted_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {activeTab==='leaderboard' && (
          <div>
            <div style={{ overflowX:'auto' }}>
              <table>
                <thead>
                  <tr><th>#</th><th>اللاعب</th><th>الإيميل</th><th>النقاط</th><th>التوقعات</th></tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>لا يوجد بيانات</td></tr>
                    : leaderboard.map((p, i) => (
                      <tr key={p.user_id}>
                        <td style={{ fontWeight:800, color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>{i < 3 ? medals[i] : `#${i+1}`}</td>
                        <td style={{ fontWeight:700 }}>{p.full_name || '—'}</td>
                        <td style={{ color:'var(--muted)', fontSize:12 }}>{p.user_email}</td>
                        <td style={{ fontWeight:800, color:'var(--gold)', fontVariantNumeric:'tabular-nums' }}>{p.total}</td>
                        <td style={{ color:'var(--muted)' }}>{p.count}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ LEAGUES TAB ══ */}
        {activeTab==='leagues' && (
          <div>
            {/* إحصائيات مختصرة */}
            {biggestLeague && (
              <div style={{ background:'rgba(217,178,95,.06)', border:'1px solid rgba(217,178,95,.18)', borderRadius:16, padding:'14px 18px', marginBottom:20, fontSize:13, color:'#f2d79e', display:'flex', gap:24, flexWrap:'wrap' }}>
                <span>🏆 أكبر ميني ليج: <strong>{biggestLeague.name}</strong> ({biggestLeague.member_count} أعضاء)</span>
                <span>📩 إجمالي الدعوات المعلقة: <strong>{totalPending}</strong></span>
                <span>📊 متوسط أعضاء الميني ليج: <strong>{leagues.length ? (totalLeagueMembers / leagues.length).toFixed(1) : 0}</strong></span>
              </div>
            )}

            {leagues.length === 0
              ? <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)' }}>لا توجد ليجات بعد</div>
              : leagues.map(lg => {
                const members = leagueMembers[lg.id] || [];
                const isExpanded = expandedLeague === lg.id;
                return (
                  <div key={lg.id} className="league-card">
                    {/* رأس الليج */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:180 }}>
                        <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>{lg.name}</div>
                        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'var(--muted)' }}>كود: <span style={{ color:'var(--gold)', fontFamily:'monospace', fontWeight:700 }}>{lg.code}</span></span>
                          <span style={{ fontSize:12, color:'var(--muted)' }}>👑 المالك: <strong style={{ color:'var(--text)' }}>{lg.owner_name}</strong></span>
                          <span style={{ fontSize:12, color:'var(--muted)' }}>👥 {lg.member_count} عضو في الليج</span>
                          {lg.pending_invites > 0 && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:'rgba(251,146,60,.12)', color:'#fb923c', border:'1px solid rgba(251,146,60,.25)' }}>📩 {lg.pending_invites} دعوة معلقة</span>}
                          <span style={{ fontSize:11, color:'var(--muted)' }}>{new Date(lg.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</span>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="action-btn" style={{ background:'rgba(59,130,246,.15)', color:'#93c5fd', border:'1px solid rgba(59,130,246,.25)', fontSize:12, padding:'7px 14px' }} onClick={() => setExpandedLeague(isExpanded ? null : lg.id)}>
                          {isExpanded ? '▲ إخفاء الأعضاء' : '▼ عرض الأعضاء'}
                        </button>
                        <button className="del-btn" onClick={() => adminDeleteLeague(lg)}>🗑️ حذف</button>
                      </div>
                    </div>

                    {/* قائمة الأعضاء */}
                    {isExpanded && (
                      <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--line)' }}>
                        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12, fontWeight:700 }}>أعضاء الليج ({members.length})</div>
                        {members.length === 0
                          ? <div style={{ fontSize:13, color:'var(--muted)', textAlign:'center', padding:'16px 0' }}>لا يوجد أعضاء</div>
                          : members
                              .sort((a: any, b: any) => (b._profile?.total_points || 0) - (a._profile?.total_points || 0))
                              .map((m: any, idx: number) => {
                                const name = m._profile?.full_name || m._profile?.user_email?.split('@')[0] || 'لاعب';
                                const pts = m._profile?.total_points || 0;
                                const isOwner = m.role === 'owner';
                                return (
                                  <div key={m.user_id} className="member-row">
                                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                      <span style={{ fontSize:13, color:'var(--muted)', minWidth:20, textAlign:'center' }}>#{idx+1}</span>
                                      <div>
                                        <span style={{ fontWeight:700, fontSize:13 }}>{name}</span>
                                        {isOwner && <span style={{ marginRight:8, fontSize:11, padding:'2px 8px', borderRadius:100, background:'rgba(217,178,95,.12)', color:'var(--gold)', border:'1px solid rgba(217,178,95,.2)' }}>مالك</span>}
                                      </div>
                                    </div>
                                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                      <span style={{ fontWeight:800, color:'var(--gold)', fontVariantNumeric:'tabular-nums', fontSize:14 }}>{pts} نقطة</span>
                                      {!isOwner && (
                                        <button className="del-btn" onClick={() => adminRemoveMember(lg.id, m.user_id, name)}>إزالة</button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                        }
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* ══ RESULT MODAL ══ */}
      {showModal && selectedMatch && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', backdropFilter:'blur(6px)', display:'grid', placeItems:'center', zIndex:1000, padding:20 }} onClick={()=>setShowModal(false)}>
          <div style={{ background:'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015),var(--surface))', border:'1px solid rgba(217,178,95,.2)', borderRadius:24, padding:28, width:'100%', maxWidth:460, boxShadow:'0 24px 64px rgba(0,0,0,.6)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontWeight:800, fontSize:17 }}>{selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}</h3>
              <button onClick={()=>setShowModal(false)} style={{ background:'var(--surface-3)', border:'1px solid var(--line)', borderRadius:10, width:34, height:34, cursor:'pointer', color:'var(--text)', fontSize:16, display:'grid', placeItems:'center' }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>النتيجة الفعلية</p>
            {[{label:selectedMatch.teams.home.name, key:'home', val:homeScore, set:setHomeScore},{label:selectedMatch.teams.away.name, key:'away', val:awayScore, set:setAwayScore}].map(({label,key,val,set})=>(
              <div key={key} style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>{label}</label>
                <input type="number" min={0} value={val} onChange={e=>set(Number(e.target.value))} style={{ width:'100%', height:66, borderRadius:14, background:'#fff', color:'#000', fontSize:34, fontWeight:900, textAlign:'center', border:'none', outline:'none', fontFamily:"'Cairo',sans-serif" }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>⚽ أول هدف</label>
              <input type="text" value={firstScorer} onChange={e=>setFirstScorer(e.target.value)} placeholder="مثال: محمد صلاح" className="field-input" style={{ marginBottom:0 }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface-2)', borderRadius:14, marginBottom:14 }}>
              <input type="checkbox" checked={extraTime} onChange={e=>setExtraTime(e.target.checked)} style={{ width:18, height:18, accentColor:'var(--gold)' }} />
              <span style={{ fontSize:14, fontWeight:700 }}>⏱️ ذهبت لوقت إضافي</span>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>❓ سؤال المفاجأة</label>
              <input type="text" value={surpriseQ} onChange={e=>setSurpriseQ(e.target.value)} placeholder="مثال: من هيكون أفضل لاعب؟" className="field-input" style={{ marginBottom:12 }} />
              <label style={{ display:'block', fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>🎯 الإجابة الصحيحة +5 نقاط</label>
              <input type="text" value={surpriseA} onChange={e=>setSurpriseA(e.target.value)} placeholder="الإجابة الصحيحة" className="field-input" style={{ marginBottom:0 }} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1, padding:'13px 0', borderRadius:16, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--muted)', cursor:'pointer', fontFamily:"'Cairo',sans-serif", fontWeight:700, fontSize:14 }}>إلغاء</button>
              <button className="action-btn" style={{ flex:2, background:'var(--green)', padding:'14px 0', borderRadius:16, fontSize:15 }} onClick={saveResult} disabled={savingResult}>{savingResult ? '⏳ جاري الحفظ...' : '✅ حفظ النتيجة وتحديث النقاط'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
