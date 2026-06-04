'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['i.g.webmaster.web@gmail.com'];
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export default function AdminPage() {
  const [user, setUser]               = useState<any>(null);
  const [matches, setMatches]         = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leagues, setLeagues]         = useState<any[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string,any[]>>({});
  const [expandedLeague, setExpandedLeague] = useState<string|null>(null);
  const [loading, setLoading]         = useState(true);
  // ① loadError ✅
  const [loadError, setLoadError]     = useState(false);
  const [activeTab, setActiveTab]     = useState<'matches'|'predictions'|'leaderboard'|'leagues'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  // ⑦ فلتر التوقعات بالجولة
  const [predRoundFilter, setPredRoundFilter] = useState<string>('all');
  const [predStatusFilter, setPredStatusFilter] = useState<'all'|'ungraded'>('all');
  const [updating, setUpdating]       = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [lastAutoUpdate, setLastAutoUpdate] = useState('');
  const [message, setMessage]         = useState('');
  const [msgType, setMsgType]         = useState<'success'|'error'>('success');
  const [showModal, setShowModal]     = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [homeScore, setHomeScore]     = useState(0);
  const [awayScore, setAwayScore]     = useState(0);
  const [firstScorer, setFirstScorer] = useState('');
  const [extraTime, setExtraTime]     = useState(false);
  const [redCard,    setRedCard]    = useState(false);
  const [penalty,    setPenalty]    = useState(false);
  const [bothTeams,  setBothTeams]  = useState(false);
  // ① savingResult moved to top ✅
  const [savingResult, setSavingResult] = useState(false);

  const autoIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const router = useRouter();

  const getAuthHeader = async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || '';
    return { 'Authorization': `Bearer ${token}` };
  };

  const roundLabels: Record<string,string> = {
    'Group Stage - 1':'الجولة الأولى','Group Stage - 2':'الجولة الثانية',
    'Group Stage - 3':'الجولة الثالثة','Round of 16':'دور الـ 16',
    'Quarter-finals':'ربع النهائي','Semi-finals':'نصف النهائي',
    '3rd Place Final':'مباراة الثالث','Final':'النهائي',
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
      const { data: sbFixtures } = await supabase.from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,went_extra_time,red_card_in_match,penalty_in_match,both_teams_scored');
      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open:            sb?.is_open ?? false,
          actual_home_score:  sb?.actual_home_score ?? null,
          actual_away_score:  sb?.actual_away_score ?? null,
          first_scorer:       sb?.first_scorer ?? '',
          went_extra_time:    sb?.went_extra_time ?? false,
          red_card_in_match:  sb?.red_card_in_match ?? false,
          penalty_in_match:   sb?.penalty_in_match ?? false,
          both_teams_scored:  sb?.both_teams_scored ?? false,
        };
      });
      setMatches(merged);
      const avail = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (avail.length > 0) setActiveRound(prev => avail.includes(prev) ? prev : avail[0]);
    } catch (err) {
      console.error('loadMatches:', err);
      setLoadError(true); // ① catch → setLoadError ✅
    }
    setLoading(false);
  }, []);

  const loadPredictions = useCallback(async () => {
    try {
      const { data: preds } = await supabase.from('predictions').select('*').not('fixture_id','is',null).order('submitted_at',{ascending:false});
      const { data: pts }   = await supabase.from('user_points').select('user_id,full_name,user_email');
      const nameMap = new Map(pts?.map((p: any) => [p.user_id, p.full_name || p.user_email?.split('@')[0]]) || []);
      setPredictions((preds || []).map((p: any) => ({ ...p, user_name: nameMap.get(p.user_id) || p.user_email?.split('@')[0] })));
    } catch (err) { console.error('loadPredictions:', err); }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const { data } = await supabase.from('user_points').select('*').order('total_points',{ascending:false});
      setLeaderboard((data || []).map((row: any) => ({
        user_id: row.user_id, user_email: row.user_email,
        full_name: row.full_name, total: row.total_points || 0, count: row.predictions_count || 0,
      })));
    } catch (err) { console.error('loadLeaderboard:', err); }
  }, []);

  const loadLeagues = useCallback(async () => {
    try {
      const { data: lgs }     = await supabase.from('mini_leagues').select('*').order('created_at',{ascending:false});
      const { data: members } = await supabase.from('mini_league_members').select('*');
      const { data: invites } = await supabase.from('mini_league_invitations').select('league_id,status');
      const { data: userPts } = await supabase.from('user_points').select('user_id,full_name,user_email,total_points');
      const userPtsMap = new Map((userPts||[]).map((u:any)=>[u.user_id,u]));
      const enrichedMembers = (members||[]).map((m:any)=>({...m,_profile:userPtsMap.get(m.user_id)||null}));
      const membersMap: Record<string,any[]> = {};
      enrichedMembers.forEach((m:any)=>{ if(!membersMap[m.league_id]) membersMap[m.league_id]=[]; membersMap[m.league_id].push(m); });
      const pendingMap: Record<string,number> = {};
      (invites||[]).filter((i:any)=>i.status==='pending').forEach((i:any)=>{ pendingMap[i.league_id]=(pendingMap[i.league_id]||0)+1; });
      const ownerMap: Record<string,string> = {};
      (lgs||[]).forEach((lg:any)=>{ const o=(membersMap[lg.id]||[]).find((m:any)=>m.role==='owner'||m.user_id===lg.created_by); if(o) ownerMap[lg.id]=o._profile?.full_name||o._profile?.user_email?.split('@')[0]||'غير معروف'; });
      setLeagueMembers(membersMap);
      setLeagues((lgs||[]).map((lg:any)=>{ const m=membersMap[lg.id]||[]; const pts=m.map((x:any)=>x._profile?.total_points||0); return {...lg,member_count:m.length,pending_invites:pendingMap[lg.id]||0,top_points:pts.length?Math.max(...pts):0,owner_name:ownerMap[lg.id]||'—'}; }));
    } catch (err) { console.error('loadLeagues:', err); }
  }, []);

  const silentUpdateResults = useCallback(async () => {
    if (updating) return;
    setAutoUpdating(true);
    try {
      const headers = await getAuthHeader();
      const res  = await fetch('/api/admin-update-results', { method: 'POST', headers });
      const data = await res.json();
      if (data.success && data.updated > 0) {
        showMsg(`🔄 تحديث أوتوماتيك: ${data.message || `${data.updated} توقع`}`);
        await loadPredictions(); await loadLeaderboard();
      }
      setLastAutoUpdate(new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}));
    } catch (err) { console.warn('silent update failed:', err); }
    setAutoUpdating(false);
  }, [updating, showMsg, loadPredictions, loadLeaderboard]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email||'')) { router.push('/dashboard'); return; }
      setUser(data.user);
      loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues();
    });
  }, [router, loadMatches, loadPredictions, loadLeaderboard, loadLeagues]);

  useEffect(() => {
    if (!user) return;
    const firstRun = setTimeout(() => silentUpdateResults(), 30 * 1000);
    autoIntervalRef.current = setInterval(() => silentUpdateResults(), AUTO_REFRESH_INTERVAL);
    return () => { clearTimeout(firstRun); if (autoIntervalRef.current) clearInterval(autoIntervalRef.current); };
  }, [user, silentUpdateResults]);

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open; const fid = match.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      if (ex) { const { error } = await supabase.from('fixtures').update({is_open:newStatus}).eq('api_fixture_id',fid); if(error) throw error; }
      else    { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:newStatus,home_team:match.teams.home.name,away_team:match.teams.away.name,match_date:match.fixture.date,round:match.league.round}); if(error) throw error; }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setHomeScore(match.actual_home_score ?? 0);
    setAwayScore(match.actual_away_score ?? 0);
    setFirstScorer(match.first_scorer ?? '');
    setExtraTime(match.went_extra_time ?? false);
    setRedCard(match.red_card_in_match ?? false);
    setPenalty(match.penalty_in_match ?? false);
    setBothTeams(match.both_teams_scored ?? false);
    setShowModal(true);
  };

  const saveResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fid = selectedMatch.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      const payload = {
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        first_scorer:      firstScorer || null,
        went_extra_time:   extraTime,
        red_card_in_match: redCard,
        penalty_in_match:  penalty,
        both_teams_scored: bothTeams,
      };
      if (ex) { const { error } = await supabase.from('fixtures').update(payload).eq('api_fixture_id',fid); if(error) throw error; }
      else    { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:false,home_team:selectedMatch.teams.home.name,away_team:selectedMatch.teams.away.name,match_date:selectedMatch.fixture.date,round:selectedMatch.league.round,...payload}); if(error) throw error; }
      const saveHeaders = await getAuthHeader();
      const res  = await fetch('/api/admin-update-results', { method: 'POST', headers: saveHeaders });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'خطأ في حساب النقاط');
      setShowModal(false);
      await loadMatches(); await loadPredictions(); await loadLeaderboard();
      showMsg(`✅ تم حفظ النتيجة وتحديث النقاط — ${data.message || ''}`);
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ في الحفظ'),'error'); }
    setSavingResult(false);
  };

  const openAllMatches = async () => {
    if (!confirm(`فتح توقعات جميع ماتشات "${roundLabels[activeRound]||activeRound}"؟`)) return;
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound);
    let ok=0, fail=0;
    for (const match of filtered) {
      const fid = match.fixture.id;
      try {
        const { data: ex } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
        if (ex) { await supabase.from('fixtures').update({is_open:true}).eq('api_fixture_id',fid); }
        else    { await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:true,home_team:match.teams.home.name,away_team:match.teams.away.name,match_date:match.fixture.date,round:match.league.round}); }
        ok++;
      } catch { fail++; }
    }
    await loadMatches(); setUpdating(false);
    showMsg(fail===0 ? `✅ تم فتح ${ok} ماتش` : `⚠️ فتح ${ok} — فشل ${fail}`, fail===0?'success':'error');
  };

  const closeAllMatches = async () => {
    if (!confirm('غلق جميع الماتشات الآن؟')) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/admin-close-all');
      const data = await res.json();
      showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ '+data.error, data.success?'success':'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في الغلق','error'); }
    setUpdating(false);
  };

  const updateAllPoints = async () => {
    setUpdating(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/admin-update-results', { method: 'POST', headers });
      const data = await res.json();
      showMsg(data.success ? data.message||'✅ تم تحديث النقاط' : '❌ '+data.error, data.success?'success':'error');
      if (data.success) { await loadPredictions(); await loadLeaderboard(); }
    } catch { showMsg('❌ خطأ في الاتصال','error'); }
    setUpdating(false);
  };

  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count||''} ماتش` : '❌ '+data.error, data.success?'success':'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في المزامنة','error'); }
    setSyncing(false);
  };

  const adminDeleteLeague = async (lg: any) => {
    if (!confirm(`حذف ليج "${lg.name}" نهائياً؟`)) return;
    try {
      await supabase.from('mini_league_invitations').delete().eq('league_id',lg.id);
      await supabase.from('mini_league_members').delete().eq('league_id',lg.id);
      const { error } = await supabase.from('mini_leagues').delete().eq('id',lg.id);
      if (error) throw error;
      showMsg(`🗑️ تم حذف ليج "${lg.name}"`); await loadLeagues();
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const adminRemoveMember = async (leagueId: string, userId: string, memberName: string) => {
    if (!confirm(`إزالة "${memberName}" من الليج؟`)) return;
    try {
      const { error } = await supabase.from('mini_league_members').delete().eq('league_id',leagueId).eq('user_id',userId);
      if (error) throw error;
      showMsg(`✅ تم إزالة "${memberName}"`); await loadLeagues();
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // ⑧ Export CSV helpers
  const exportPredictionsCSV = () => {
    const headers = ['اللاعب','المباراة','توقع','نتيجة فعلية','نقاط','وقت التسجيل'];
    const rows = predictions.map(p => [
      p.user_name||p.user_email?.split('@')[0]||'—',
      `${p.home_team} × ${p.away_team}`,
      `${p.predicted_home_score}-${p.predicted_away_score}`,
      p.actual_home_score!==null ? `${p.actual_home_score}-${p.actual_away_score}` : '—',
      p.actual_home_score!==null ? (p.points||0) : '—',
      p.submitted_at ? new Date(p.submitted_at).toLocaleString('ar-EG') : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `predictions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const exportLeaderboardCSV = () => {
    const headers = ['#','الاسم','الإيميل','النقاط','عدد التوقعات'];
    const rows = leaderboard.map((p,i) => [i+1, p.full_name||'—', p.user_email, p.total, p.count]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `leaderboard-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // ─── Render states ─────────────────────────────────────
  if (loading) return (
    <div style={{display:'grid',placeItems:'center',height:'100vh',background:'#070809',color:'#d9b25f',fontFamily:"'Cairo',sans-serif",gap:16,fontSize:18}}>
      <div style={{fontSize:40}}>⚙️</div>
      <div>جاري التحميل...</div>
    </div>
  );

  // ① شاشة الخطأ + retry ✅
  if (loadError) return (
    <div style={{display:'grid',placeItems:'center',height:'100vh',background:'#070809',fontFamily:"'Cairo',sans-serif",gap:16,textAlign:'center',padding:24}}>
      <div style={{fontSize:48}}>⚠️</div>
      <div style={{fontSize:18,color:'#f4f1e8'}}>حدث خطأ أثناء تحميل البيانات</div>
      <div style={{fontSize:13,color:'#a8a39a'}}>تحقق من اتصالك بالإنترنت وحاول مجدداً</div>
      <button
        onClick={() => { setLoadError(false); setLoading(true); loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues(); }}
        style={{padding:'12px 32px',borderRadius:14,border:'none',background:'#d9b25f',color:'#1a1200',fontFamily:"'Cairo',sans-serif",fontSize:16,fontWeight:700,cursor:'pointer'}}
      >
        🔄 إعادة المحاولة
      </button>
    </div>
  );

  // ④ computed stats ✅
  const filteredMatches    = matches.filter(m => m.league.round === activeRound);
  const openCount          = matches.filter(m => m.is_open).length;
  const gradedCount        = predictions.filter(p => p.actual_home_score !== null).length;
  const medals             = ['🥇','🥈','🥉'];
  const totalLeagueMembers = leagues.reduce((s,lg)=>s+lg.member_count,0);
  const totalPending       = leagues.reduce((s,lg)=>s+lg.pending_invites,0);
  const biggestLeague      = leagues.reduce((best,lg)=>lg.member_count>(best?.member_count||0)?lg:best,null as any);
  const rounds             = [...new Set(matches.map((m:any)=>m.league?.round).filter(Boolean))] as string[];

  // ④ 4 new computed stats ✅
  const avgPoints       = leaderboard.length > 0
    ? (leaderboard.reduce((s:number,p:any)=>s+p.total,0) / leaderboard.length).toFixed(1) : '—';
  const coveragePct     = leaderboard.length > 0 && filteredMatches.length > 0
    ? Math.round((predictions.filter(p => filteredMatches.find(m => m.fixture.id === p.fixture_id)).length
        / (leaderboard.length * filteredMatches.length)) * 100) : 0;
  const ungradedCount   = predictions.filter(p => p.actual_home_score === null).length;
  const noResultCount   = matches.filter(m => m.actual_home_score === null && !m.is_open).length;

  // ⑦ filtered predictions ✅
  const visiblePredictions = predictions.filter(p => {
    if (predRoundFilter !== 'all') {
      const m = matches.find(m => m.fixture.id === p.fixture_id);
      if (!m || m.league?.round !== predRoundFilter) return false;
    }
    if (predStatusFilter === 'ungraded' && p.actual_home_score !== null) return false;
    return true;
  });

  // ⑥ round badges ✅
  const roundOpenMap: Record<string,{open:number,total:number}> = {};
  rounds.forEach(r => {
    const rm = matches.filter(m => m.league?.round === r);
    roundOpenMap[r] = { open: rm.filter(m => m.is_open).length, total: rm.length };
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root{--bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;--line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;--gold:#d9b25f;--red:#c93a2f;--green:#27b06e}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);color:var(--text);font-family:'Cairo',sans-serif;direction:rtl;min-height:100vh}
        .tab-btn{padding:10px 22px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;transition:all .2s;white-space:nowrap;flex-shrink:0}
        .tab-btn.active{background:linear-gradient(135deg,rgba(217,178,95,.15),rgba(217,178,95,.05));border-color:rgba(217,178,95,.28);color:var(--gold)}
        .round-btn{padding:8px 16px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;transition:all .2s;white-space:nowrap;flex-shrink:0}
        .round-btn.active{background:rgba(217,178,95,.14);border-color:rgba(217,178,95,.3);color:var(--gold)}
        .action-btn{padding:10px 20px;border-radius:12px;border:none;color:#fff;cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;transition:opacity .18s}
        .action-btn:disabled{opacity:.6;cursor:not-allowed}
        .action-btn:hover:not(:disabled){opacity:.85}
        .field-input{width:100%;padding:12px 16px;border-radius:12px;background:var(--surface-3);border:1px solid var(--line);color:var(--text);font-family:'Cairo',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 14px;text-align:right;border-bottom:1px solid var(--line);font-size:13px}
        th{color:var(--muted);font-weight:700;background:var(--surface-2)}
        tr:hover td{background:rgba(255,255,255,.015)}
        .league-card{background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin-bottom:10px}
        .league-card:hover{border-color:rgba(217,178,95,.2)}
        .del-btn{padding:6px 12px;border-radius:10px;border:1px solid rgba(201,58,47,.25);background:rgba(201,58,47,.08);color:#ff9c91;font-size:12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;transition:opacity .18s}
        .del-btn:hover{opacity:.75}
        .export-btn{padding:8px 16px;border-radius:10px;border:1px solid rgba(217,178,95,.25);background:rgba(217,178,95,.08);color:var(--gold);font-size:12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;transition:opacity .18s}
        .export-btn:hover{opacity:.75}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .auto-pulse{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* HEADER */}
      <div style={{background:'var(--surface)',borderBottom:'1px solid var(--line)',padding:'14px 24px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{fontSize:28}}>⚙️</div>
        <div>
          <div style={{fontWeight:800,fontSize:18,color:'var(--gold)'}}>لوحة التحكم</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>كأس العالم 2026 — الشمعدان</div>
        </div>
        {/* ⑤ lastAutoUpdate معروض ✅ */}
        <div style={{marginRight:'auto',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--muted)'}}>
          <span className={autoUpdating ? 'auto-pulse' : ''} style={{color:autoUpdating?'var(--gold)':'var(--muted)'}}>🔄</span>
          <span>{autoUpdating ? 'تحديث أوتوماتيك...' : lastAutoUpdate ? `آخر تحديث: ${lastAutoUpdate}` : 'تحديث كل 5 دقايق'}</span>
        </div>
        <a href="/leaderboard" style={{color:'var(--gold)',textDecoration:'none',fontSize:13,fontWeight:700}}>🏁 الصدارة</a>
        <button onClick={syncFixtures} disabled={syncing} className="action-btn" style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',fontSize:12}}>
          {syncing?'⏳ مزامنة...':'🔄 مزامنة'}
        </button>
        <button onClick={updateAllPoints} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:12}}>
          {updating?'⏳ جاري...':'⚡ تحديث النقاط'}
        </button>
        <button onClick={handleLogout} className="action-btn" style={{background:'rgba(201,58,47,.2)',border:'1px solid rgba(201,58,47,.3)',color:'#ff9c91',fontSize:12}}>خروج</button>
      </div>

      {message && (
        <div style={{padding:'12px 24px',background:msgType==='success'?'rgba(39,176,110,.15)':'rgba(201,58,47,.15)',borderBottom:`1px solid ${msgType==='success'?'rgba(39,176,110,.25)':'rgba(201,58,47,.25)'}`,color:msgType==='success'?'var(--green)':'#ff9c91',fontWeight:700,fontSize:14,textAlign:'center'}}>
          {message}
        </div>
      )}

      {/* ④ STATS — 7 أصلية + 4 جديدة ✅ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:10,padding:'20px 24px'}}>
        {[
          {label:'إجمالي التوقعات', value:predictions.length,     color:'var(--gold)'},
          {label:'محسوبة',           value:gradedCount,            color:'var(--green)'},
          {label:'غير محسوبة',       value:ungradedCount,          color:'#fb923c'},
          {label:'ماتشات مفتوحة',    value:openCount,              color:'#facc15'},
          {label:'بدون نتيجة',       value:noResultCount,          color:'#f87171'},
          {label:'المتسابقين',        value:leaderboard.length,     color:'#ff9c91'},
          {label:'متوسط النقاط',     value:avgPoints,              color:'#a78bfa'},
          {label:'تغطية الجولة',     value:`${coveragePct}%`,      color:'#38bdf8'},
          {label:'ميني ليجات',        value:leagues.length,         color:'#a78bfa'},
          {label:'أعضاء ميني ليج',   value:totalLeagueMembers,     color:'#38bdf8'},
          {label:'دعوات معلقة',       value:totalPending,           color:'#fb923c'},
        ].map(s=>(
          <div key={s.label} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:16,padding:'12px 14px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:6,fontWeight:700}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:900,color:s.color,fontVariantNumeric:'tabular-nums'}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ③ TABS — overflowX: auto ✅ */}
      <div style={{display:'flex',gap:8,padding:'0 24px 16px',overflowX:'auto',scrollbarWidth:'none',WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
        {([
          {id:'matches',     label:`🏟️ الماتشات (${matches.length})`},
          {id:'predictions', label:`📋 التوقعات (${predictions.length})`},
          {id:'leaderboard', label:`🏆 الصدارة (${leaderboard.length})`},
          {id:'leagues',     label:`🏅 الليجات (${leagues.length})`},
        ] as const).map(({id,label})=>(
          <button key={id} className={`tab-btn${activeTab===id?' active':''}`} onClick={()=>setActiveTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{padding:'0 24px 40px'}}>

        {/* ══ MATCHES ══ */}
        {activeTab==='matches' && (
          <>
            {/* ⑥ Round buttons — badge مفتوح/إجمالي ✅ */}
            <div style={{display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',marginBottom:16,paddingBottom:4} as React.CSSProperties}>
              {rounds.map(r=>{
                const {open,total} = roundOpenMap[r]||{open:0,total:0};
                return (
                  <button key={r} className={`round-btn${activeRound===r?' active':''}`} onClick={()=>setActiveRound(r)}>
                    {roundLabels[r]||r}
                    <span style={{marginRight:6,fontSize:11,opacity:.75,fontVariantNumeric:'tabular-nums'}}>
                      ({open > 0 ? <span style={{color:'var(--green)'}}>{open}</span> : 0}/{total})
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <button onClick={openAllMatches} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,#22c55e,#16a34a)'}}>🟢 فتح الكل</button>
              <button onClick={closeAllMatches} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,#ef4444,#b91c1c)'}}>🔒 غلق الكل</button>
            </div>
            {filteredMatches.map(match=>{
              const hasResult  = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const matchPreds = predictions.filter(p=>p.fixture_id===match.fixture.id);
              // ⑨ % مشاركة ✅
              const participationPct = leaderboard.length > 0
                ? Math.round((matchPreds.length / leaderboard.length) * 100) : 0;
              return (
                <div key={match.fixture.id} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:18,padding:'16px 20px',marginBottom:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>{match.teams.home.name} × {match.teams.away.name}</div>
                    <div style={{fontSize:12,color:'var(--muted)',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                      <span>{new Date(match.fixture.date).toLocaleDateString('ar-EG',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      <span style={{color:match.is_open?'var(--green)':'var(--red)',fontWeight:700}}>{match.is_open?'مفتوح':'مغلق'}</span>
                      {matchPreds.length > 0 && (
                        <span style={{color:'#38bdf8'}}>
                          👥 {matchPreds.length}
                          {leaderboard.length > 0 && (
                            <span style={{
                              marginRight:4, fontSize:10,
                              color: participationPct >= 70 ? 'var(--green)' : participationPct >= 40 ? '#facc15' : '#f87171',
                            }}>
                              ({participationPct}%)
                            </span>
                          )}
                        </span>
                      )}
                      {hasResult && <span style={{color:'var(--gold)',fontWeight:700}}>النتيجة: {match.actual_home_score} - {match.actual_away_score}</span>}
                    </div>
                  </div>
                  <button onClick={()=>toggleMatchOpen(match)} className="action-btn" style={{background:match.is_open?'linear-gradient(135deg,#ef4444,#b91c1c)':'linear-gradient(135deg,#22c55e,#16a34a)',fontSize:12,padding:'8px 14px'}}>
                    {match.is_open?'🔒 غلق':'🟢 فتح'}
                  </button>
                  <button onClick={()=>openResultModal(match)} className="action-btn" style={{background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:12,padding:'8px 14px'}}>
                    📝 {hasResult?'تعديل':'إدخال نتيجة'}
                  </button>
                </div>
              );
            })}
            {filteredMatches.length===0 && <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد ماتشات في هذه الجولة</div>}
          </>
        )}

        {/* ══ PREDICTIONS ══ */}
        {activeTab==='predictions' && (
          <>
            {/* ⑦ فلاتر التوقعات ✅ */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              <select
                value={predRoundFilter}
                onChange={e=>setPredRoundFilter(e.target.value)}
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',fontFamily:"'Cairo',sans-serif",fontSize:13,cursor:'pointer'}}
              >
                <option value="all">كل الجولات</option>
                {rounds.map(r=><option key={r} value={r}>{roundLabels[r]||r}</option>)}
              </select>
              <button
                onClick={()=>setPredStatusFilter(s=>s==='all'?'ungraded':'all')}
                style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${predStatusFilter==='ungraded'?'rgba(251,146,60,.4)':'var(--line)'}`,background:predStatusFilter==='ungraded'?'rgba(251,146,60,.1)':'var(--surface-2)',color:predStatusFilter==='ungraded'?'#fb923c':'var(--muted)',fontFamily:"'Cairo',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}
              >
                {predStatusFilter==='ungraded'?'✅ غير محسوبة فقط':'⬜ غير محسوبة فقط'}
              </button>
              <span style={{fontSize:12,color:'var(--muted)',marginRight:4}}>
                يعرض {visiblePredictions.length} من {predictions.length}
              </span>
              {/* ⑧ Export CSV ✅ */}
              <button onClick={exportPredictionsCSV} className="export-btn" style={{marginRight:'auto'}}>
                ⬇️ تصدير CSV
              </button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead><tr><th>اللاعب</th><th>المباراة</th><th>توقع</th><th>نتيجة فعلية</th><th>نقاط</th><th>وقت التسجيل</th></tr></thead>
                <tbody>
                  {visiblePredictions.length===0 ? (
                    <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد توقعات</td></tr>
                  ) : visiblePredictions.map((p,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:700}}>{p.user_name||p.user_email?.split('@')[0]||'—'}</td>
                      <td>{p.home_team} × {p.away_team}</td>
                      <td style={{fontVariantNumeric:'tabular-nums'}}>{p.predicted_home_score} - {p.predicted_away_score}{p.predicted_extra_time?' (و)':''}</td>
                      <td style={{fontVariantNumeric:'tabular-nums'}}>{p.actual_home_score!==null?`${p.actual_home_score} - ${p.actual_away_score}`:'—'}</td>
                      <td style={{color:p.points>0?'var(--green)':'var(--muted)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{p.actual_home_score!==null?(p.points||0):'—'}</td>
                      <td style={{color:'var(--muted)'}}>{p.submitted_at?new Date(p.submitted_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ LEADERBOARD ══ */}
        {activeTab==='leaderboard' && (
          <>
            {/* ⑧ Export CSV leaderboard ✅ */}
            <div style={{display:'flex',justifyContent:'flex-start',marginBottom:12}}>
              <button onClick={exportLeaderboardCSV} className="export-btn">⬇️ تصدير CSV</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead><tr><th>#</th><th>اللاعب</th><th>الإيميل</th><th>النقاط</th><th>التوقعات</th></tr></thead>
                <tbody>
                  {leaderboard.length===0 ? (
                    <tr><td colSpan={5} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                  ) : leaderboard.map((p,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:800,color:i<3?'var(--gold)':'var(--muted)'}}>{i<3?medals[i]:`#${i+1}`}</td>
                      <td style={{fontWeight:700}}>{p.full_name||'—'}</td>
                      <td style={{color:'var(--muted)',fontSize:12}}>{p.user_email}</td>
                      <td style={{color:'var(--gold)',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{p.total}</td>
                      <td style={{color:'var(--muted)'}}>{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ LEAGUES ══ */}
        {activeTab==='leagues' && (
          <>
            {biggestLeague && (
              <div style={{background:'rgba(217,178,95,.08)',border:'1px solid rgba(217,178,95,.2)',borderRadius:14,padding:'12px 18px',marginBottom:16,fontSize:13,color:'var(--gold)',fontWeight:700,display:'flex',flexWrap:'wrap',gap:16}}>
                <span>🏆 أكبر ميني ليج: <strong>{biggestLeague.name}</strong> ({biggestLeague.member_count} أعضاء)</span>
                <span>📩 دعوات معلقة: <strong>{totalPending}</strong></span>
                <span>📊 متوسط أعضاء: <strong>{leagues.length?(totalLeagueMembers/leagues.length).toFixed(1):0}</strong></span>
              </div>
            )}
            {leagues.length===0 ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد ليجات بعد</div>
            ) : leagues.map(lg=>{
              const members    = leagueMembers[lg.id]||[];
              const isExpanded = expandedLeague===lg.id;
              return (
                <div key={lg.id} className="league-card">
                  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:'var(--gold)',marginBottom:4}}>{lg.name}</div>
                      <div style={{fontSize:12,color:'var(--muted)',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                        {/* زر نسخ الكود مباشرة ✅ */}
                        <span
                          onClick={()=>navigator.clipboard.writeText(lg.code).then(()=>showMsg(`✅ تم نسخ كود ${lg.name}`))}
                          style={{cursor:'pointer',display:'flex',alignItems:'center',gap:4}}
                          title="اضغط لنسخ الكود"
                        >
                          كود: <strong style={{color:'var(--text)',letterSpacing:1}}>{lg.code}</strong>
                          <span style={{fontSize:10,color:'var(--gold)'}}>📋</span>
                        </span>
                        <span>👑 {lg.owner_name}</span>
                        <span>👥 {lg.member_count} عضو</span>
                        {lg.pending_invites>0 && <span style={{color:'#fb923c'}}>📩 {lg.pending_invites} معلق</span>}
                        <span>{new Date(lg.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</span>
                      </div>
                    </div>
                    <button onClick={()=>setExpandedLeague(isExpanded?null:lg.id)} className="action-btn" style={{background:'rgba(217,178,95,.12)',border:'1px solid rgba(217,178,95,.2)',color:'#ffe3a6',fontSize:12,padding:'8px 14px'}}>
                      {isExpanded?'▲ إخفاء':'▼ الأعضاء'}
                    </button>
                    <button onClick={()=>adminDeleteLeague(lg)} className="del-btn">🗑️ حذف</button>
                  </div>
                  {isExpanded && (
                    <div style={{marginTop:14,borderTop:'1px solid var(--line)',paddingTop:14}}>
                      <div style={{fontSize:13,color:'var(--gold)',fontWeight:700,marginBottom:10}}>أعضاء الليج ({members.length})</div>
                      {members.length===0 ? (
                        <div style={{color:'var(--muted)',fontSize:13}}>لا يوجد أعضاء</div>
                      ) : members
                        .sort((a:any,b:any)=>(b._profile?.total_points||0)-(a._profile?.total_points||0))
                        .map((m:any,idx:number)=>{
                          const name    = m._profile?.full_name||m._profile?.user_email?.split('@')[0]||'لاعب';
                          const pts     = m._profile?.total_points||0;
                          const isOwner = m.role==='owner';
                          return (
                            <div key={m.user_id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
                              <span style={{color:'var(--muted)',fontSize:12,minWidth:24}}>#{idx+1}</span>
                              <span style={{flex:1,fontWeight:700}}>{name} {isOwner && <span style={{fontSize:11,color:'var(--gold)'}}>👑 مالك</span>}</span>
                              <span style={{color:'var(--gold)',fontWeight:800,fontSize:13}}>{pts} نقطة</span>
                              {!isOwner && <button onClick={()=>adminRemoveMember(lg.id,m.user_id,name)} className="del-btn">إزالة</button>}
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ══ RESULT MODAL ══ */}
      {showModal && selectedMatch && (
        <div onClick={()=>setShowModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',backdropFilter:'blur(6px)',display:'grid',placeItems:'center',zIndex:1000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:24,padding:28,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div>
                <div style={{fontWeight:900,fontSize:16,color:'var(--gold)'}}>{selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>إدخال / تعديل النتيجة</div>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'var(--surface-3)',border:'1px solid var(--line)',borderRadius:10,width:34,height:34,cursor:'pointer',color:'var(--text)',fontSize:16,display:'grid',placeItems:'center'}}>✕</button>
            </div>
            <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:10}}>النتيجة الفعلية</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
              {[{label:selectedMatch.teams.home.name,val:homeScore,set:setHomeScore},{label:selectedMatch.teams.away.name,val:awayScore,set:setAwayScore}].map(({label,val,set})=>(
                <div key={label} style={{background:'var(--surface-2)',borderRadius:16,padding:'12px 16px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:8,fontWeight:700}}>{label}</div>
                  <input type="number" min={0} value={val}
                    onChange={e=>set(Number(e.target.value))}
                    style={{width:'100%',height:66,borderRadius:14,background:'#fff',color:'#000',fontSize:34,fontWeight:900,textAlign:'center',border:'none',outline:'none',fontFamily:"'Cairo',sans-serif"}} />
                </div>
              ))}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:6}}>⚽ أول هدف</div>
              <input type="text" value={firstScorer} onChange={e=>setFirstScorer(e.target.value)}
                placeholder="مثال: محمد صلاح" className="field-input" />
            </div>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px',marginBottom:18}}>
              <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:12}}>أحداث الماتش (+2 نقطة لكل توقع صح)</div>
              {[
                { label:'⏱️ ذهبت لوقت إضافي',   val:extraTime,  set:setExtraTime  },
                { label:'🟥 كان في بطاقة حمراء', val:redCard,    set:setRedCard    },
                { label:'⚽ كان في ركلة جزاء',   val:penalty,    set:setPenalty    },
                { label:'🎯 كلا الفريقين سجّلا', val:bothTeams,  set:setBothTeams  },
              ].map(({label,val,set})=>(
                <label key={label} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,cursor:'pointer'}}>
                  <input type="checkbox" checked={val} onChange={e=>set(e.target.checked)}
                    style={{width:18,height:18,accentColor:'var(--gold)',flexShrink:0}} />
                  <span style={{fontSize:14,fontWeight:600}}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowModal(false)} style={{flex:1,padding:'13px 0',borderRadius:16,background:'var(--surface-2)',border:'1px solid var(--line)',color:'var(--muted)',cursor:'pointer',fontFamily:"'Cairo',sans-serif",fontWeight:700,fontSize:14}}>إلغاء</button>
              <button onClick={saveResult} disabled={savingResult} className="action-btn" style={{flex:2,padding:'13px 0',borderRadius:16,background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:15}}>
                {savingResult?'⏳ جاري الحفظ...':'✅ حفظ النتيجة وتحديث النقاط'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
