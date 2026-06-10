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

  const [loadError, setLoadError]     = useState(false);
  const [activeTab, setActiveTab]     = useState<'matches'|'predictions'|'leaderboard'|'leagues'|'prizes'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');

  const [predRoundFilter, setPredRoundFilter] = useState<string>('all');
  const [predStatusFilter, setPredStatusFilter] = useState<'all'|'ungraded'>('all');
  const [updating, setUpdating]       = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [syncingSquads, setSyncingSquads] = useState(false);
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

  const [savingResult, setSavingResult] = useState(false);

  const [prizePhases, setPrizePhases]           = useState<any[]>([]);
  const [prizeWinners, setPrizeWinners]         = useState<any[]>([]);
  const [dailyScorers, setDailyScorers]         = useState<any[]>([]);
  const [phaseLeaderboard, setPhaseLeaderboard] = useState<any[]>([]);
  const [selectedPhase, setSelectedPhase]       = useState<any>(null);
  const [showPrizeModal, setShowPrizeModal]     = useState(false);
  const [prizeModalLoading, setPrizeModalLoading] = useState(false);
  const [savingWinner, setSavingWinner]         = useState(false);

  const [breakdownUser, setBreakdownUser]   = useState<any>(null);
  const [breakdownPreds, setBreakdownPreds] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown]   = useState(false);

  const autoIntervalRef = useRef<any>(null);
  const router = useRouter();

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
      setLoadError(true);
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
        user_id:              row.user_id,
        user_email:           row.user_email,
        full_name:            row.full_name,
        total:                row.total_points || 0,
        count:                row.predictions_count || 0,
        referral_count:       row.referral_count || 0,
        bonus_points_awarded: row.bonus_points_awarded ?? false,
        facebook_bonus_awarded: row.facebook_bonus_awarded ?? false,
        profile_completed:    row.profile_completed ?? false,
        bonus_points:         row.bonus_points ?? 0,
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

  const loadPrizes = useCallback(async () => {
    try {
      const [{ data: phases }, { data: winners }, { data: daily }] = await Promise.all([
        supabase.from('prize_phases').select('*').order('id'),
        supabase.from('prize_winners')
          .select('*, profiles(full_name)').order('phase_id').order('rank'),
        supabase.rpc('get_daily_top_scorers', {
          p_date: new Date().toISOString().split('T')[0],
          p_limit: 10,
        }),
      ]);
      setPrizePhases(phases || []);
      setPrizeWinners(winners || []);
      setDailyScorers(daily || []);
    } catch (err) { console.error('loadPrizes:', err); }
  }, []);

  const silentUpdateResults = useCallback(async () => {
    if (updating) return;
    setAutoUpdating(true);
    try {
      const res  = await fetch('/api/update-results');
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
      loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues(); loadPrizes();
    });
  }, [router, loadMatches, loadPredictions, loadLeaderboard, loadLeagues, loadPrizes]);

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
      else    { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:newStatus,home_team_name:match.teams.home.name,away_team_name:match.teams.away.name,home_team_id:match.teams.home.id,away_team_id:match.teams.away.id,home_team_logo:match.teams.home.logo,away_team_logo:match.teams.away.logo,match_date:match.fixture.date,round:match.league.round}); if(error) throw error; }
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
      else    { const { error } = await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:false,home_team_name:selectedMatch.teams.home.name,away_team_name:selectedMatch.teams.away.name,home_team_id:selectedMatch.teams.home.id,away_team_id:selectedMatch.teams.away.id,home_team_logo:selectedMatch.teams.home.logo,away_team_logo:selectedMatch.teams.away.logo,match_date:selectedMatch.fixture.date,round:selectedMatch.league.round,...payload}); if(error) throw error; }
      const res  = await fetch('/api/update-results');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'خطأ في حساب النقاط');
      setShowModal(false);
      await loadMatches(); await loadPredictions(); await loadLeaderboard();
      showMsg(`✅ تم حفظ النتيجة وتحديث النقاط — ${data.message || ''}`);
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
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
        else    { await supabase.from('fixtures').insert({api_fixture_id:fid,is_open:true,home_team_name:match.teams.home.name,away_team_name:match.teams.away.name,home_team_id:match.teams.home.id,away_team_id:match.teams.away.id,home_team_logo:match.teams.home.logo,away_team_logo:match.teams.away.logo,match_date:match.fixture.date,round:match.league.round}); }
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
      const res = await fetch('/api/update-results');
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

  const syncSquads = async () => {
    setSyncingSquads(true);
    try {
      const res = await fetch('/api/sync-squads');
      const data = await res.json();
      showMsg(data.success ? `✅ ${data.message}` : '❌ '+data.error, data.success?'success':'error');
    } catch { showMsg('❌ خطأ في تحديث السكواد','error'); }
    setSyncingSquads(false);
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

  const exportPredictionsCSV = () => {
    const headers = ['اللاعب','المباراة','توقع','نتيجة فعلية','نقاط','وقت التسجيل'];
    const rows = predictions.map(p => [
      p.user_name||p.user_email?.split('@')[0]||'—',
      `${p.home_team} × ${p.away_team}`,
      `${p.predicted_home_score}-${p.predicted_away_score}`,
      (p.actual_home_score==null?'—':`${p.actual_home_score}-${p.actual_away_score}`),
      p.points ?? '—',
      p.submitted_at ? new Date(p.submitted_at).toLocaleString('ar-EG') : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.map((v:any)=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(["\ufeff"+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `predictions-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportLeaderboardCSV = () => {
    const headers = ['الترتيب','الاسم','الإيميل','النقاط','عدد التوقعات','إحالات'];
    const rows = leaderboard.map((u:any,idx:number)=>[
      idx+1, u.full_name||'—', u.user_email||'—', u.total||0, u.count||0, u.referral_count||0
    ]);
    const csv = [headers,...rows].map(r => r.map((v:any)=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(["\ufeff"+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `leaderboard-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const openUserBreakdown = async (u: any) => {
    try {
      setBreakdownUser(u); setShowBreakdown(true); setBreakdownPreds([]);
      const { data } = await supabase.from('predictions').select('*').eq('user_id',u.user_id).order('submitted_at',{ascending:false});
      setBreakdownPreds(data || []);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{padding:30,color:'#fff'}}>...جاري التحميل</div>;

  return (
    <>
      <style jsx>{`
        :global(body){margin:0;background:#0b0d12;color:#f4f7fb;font-family:Cairo,system-ui,sans-serif}
        .wrap{max-width:1320px;margin:0 auto;padding:20px}
        .topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
        .title{font-size:28px;font-weight:900}
        .muted{color:#9aa4b2}
        .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .tab{background:#121722;border:1px solid #1f2937;color:#cbd5e1;padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:700}
        .tab.active{background:#1d4ed8;color:#fff;border-color:#2563eb}
        .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .btn{background:#1f2937;border:1px solid #334155;color:#fff;padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:800}
        .btn.primary{background:#16a34a;border-color:#22c55e}
        .btn.warn{background:#ea580c;border-color:#fb923c}
        .btn.red{background:#b91c1c;border-color:#ef4444}
        .btn.blue{background:#1d4ed8;border-color:#2563eb}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .card{background:#0f1420;border:1px solid #1f2937;border-radius:18px;padding:16px;margin-bottom:16px}
        .tableWrap{overflow:auto}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 12px;border-bottom:1px solid #1f2937;text-align:right;white-space:nowrap}
        th{color:#93c5fd;font-size:13px}
        tr:hover td{background:#0d1320}
        .rounds{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
        .chip{padding:8px 12px;border-radius:999px;border:1px solid #334155;background:#111827;color:#cbd5e1;cursor:pointer;font-weight:700}
        .chip.active{background:#1e3a8a;border-color:#2563eb;color:#fff}
        .score{font-weight:900;font-size:18px}
        .ok{color:#22c55e}.warnTxt{color:#f59e0b}.bad{color:#ef4444}
        .msg{padding:12px 14px;border-radius:12px;margin-bottom:14px;font-weight:800}
        .msg.success{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35);color:#bbf7d0}
        .msg.error{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fecaca}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media (max-width:900px){.grid2{grid-template-columns:1fr}}
        .modalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
        .modal{width:min(720px,100%);background:#0f1420;border:1px solid #243042;border-radius:20px;padding:18px}
        .field{display:flex;flex-direction:column;gap:6px}
        .field input,.field select{background:#0b111b;border:1px solid #243042;color:#fff;padding:10px 12px;border-radius:12px}
        .row{display:flex;gap:10px;flex-wrap:wrap}
        .spacer{height:8px}
        .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#111827;border:1px solid #334155;font-size:12px}
        .leagueBox{border:1px solid #22304a;border-radius:14px;padding:12px}
        .right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      `}</style>

      <div className="wrap">
        <div className="topbar">
          <div>
            <div className="title">لوحة تحكم الأدمن</div>
            <div className="muted">
              {user?.email} • {autoUpdating ? 'تحديث أوتوماتيك...' : `آخر تحديث تلقائي: ${lastAutoUpdate || '—'}`}
            </div>
          </div>
          <div className="right">
            <button className="btn" onClick={()=>router.push('/dashboard')}>العودة للداش بورد</button>
            <button className="btn red" onClick={handleLogout}>تسجيل الخروج</button>
          </div>
        </div>

        {message && <div className={`msg ${msgType}`}>{message}</div>}
        {loadError && <div className="msg error">حدث خطأ أثناء تحميل البيانات.</div>}

        <div className="tabs">
          <button className={`tab ${activeTab==='matches'?'active':''}`} onClick={()=>setActiveTab('matches')}>الماتشات</button>
          <button className={`tab ${activeTab==='predictions'?'active':''}`} onClick={()=>setActiveTab('predictions')}>التوقعات</button>
          <button className={`tab ${activeTab==='leaderboard'?'active':''}`} onClick={()=>setActiveTab('leaderboard')}>الترتيب</button>
          <button className={`tab ${activeTab==='leagues'?'active':''}`} onClick={()=>setActiveTab('leagues')}>الليجات</button>
          <button className={`tab ${activeTab==='prizes'?'active':''}`} onClick={()=>setActiveTab('prizes')}>الجوائز</button>
        </div>

        {activeTab === 'matches' && (
          <>
            <div className="toolbar">
              <button className="btn blue" onClick={syncFixtures} disabled={syncing}>{syncing ? 'جارٍ...' : 'مزامنة الماتشات'}</button>
              <button className="btn" onClick={syncSquads} disabled={syncingSquads}>{syncingSquads ? 'جارٍ...' : 'تحديث السكواد'}</button>
              <button className="btn primary" onClick={openAllMatches} disabled={updating}>فتح كل ماتشات الجولة</button>
              <button className="btn red" onClick={closeAllMatches} disabled={updating}>غلق كل الماتشات</button>
              <button className="btn warn" onClick={updateAllPoints} disabled={updating}>تحديث النقاط</button>
            </div>

            <div className="rounds">
              {[...new Set(matches.map((m:any)=>m.league?.round).filter(Boolean))].map((r:string)=>(
                <button key={r} className={`chip ${activeRound===r?'active':''}`} onClick={()=>setActiveRound(r)}>
                  {roundLabels[r] || r}
                </button>
              ))}
            </div>

            <div className="card tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>المباراة</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th>النتيجة</th>
                    <th>فتح/غلق</th>
                    <th>إدارة</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.filter((m:any)=>m.league?.round===activeRound).map((match:any)=>(
                    <tr key={match.fixture.id}>
                      <td>{match.teams.home.name} × {match.teams.away.name}</td>
                      <td>{new Date(match.fixture.date).toLocaleString('ar-EG')}</td>
                      <td>{match.fixture.status?.short || '—'}</td>
                      <td className="score">
                        {match.actual_home_score == null ? '—' : `${match.actual_home_score} - ${match.actual_away_score}`}
                      </td>
                      <td>
                        <button className={`btn ${match.is_open?'warn':'primary'}`} onClick={()=>toggleMatchOpen(match)}>
                          {match.is_open ? 'غلق' : 'فتح'}
                        </button>
                      </td>
                      <td>
                        <button className="btn blue" onClick={()=>openResultModal(match)}>إدخال/تعديل نتيجة</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'predictions' && (
          <>
            <div className="toolbar">
              <select className="btn" value={predRoundFilter} onChange={e=>setPredRoundFilter(e.target.value)}>
                <option value="all">كل الجولات</option>
                {[...new Set(matches.map((m:any)=>m.league?.round).filter(Boolean))].map((r:string)=>(
                  <option key={r} value={r}>{roundLabels[r] || r}</option>
                ))}
              </select>
              <select className="btn" value={predStatusFilter} onChange={e=>setPredStatusFilter(e.target.value as any)}>
                <option value="all">كل التوقعات</option>
                <option value="ungraded">غير محسوبة</option>
              </select>
              <button className="btn" onClick={exportPredictionsCSV}>تصدير CSV</button>
            </div>

            <div className="card tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>اللاعب</th>
                    <th>المباراة</th>
                    <th>التوقع</th>
                    <th>النتيجة الفعلية</th>
                    <th>النقاط</th>
                    <th>وقت التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions
                    .filter((p:any)=>{
                      const round = matches.find((m:any)=>m.fixture.id===p.fixture_id)?.league?.round || '';
                      const byRound = predRoundFilter==='all' || round===predRoundFilter;
                      const byStatus = predStatusFilter==='all' || p.points==null;
                      return byRound && byStatus;
                    })
                    .map((p:any)=>(
                    <tr key={p.id}>
                      <td>{p.user_name || p.user_email?.split('@')[0] || '—'}</td>
                      <td>{p.home_team} × {p.away_team}</td>
                      <td>{p.predicted_home_score}-{p.predicted_away_score}</td>
                      <td>{p.actual_home_score==null?'—':`${p.actual_home_score}-${p.actual_away_score}`}</td>
                      <td>{p.points ?? '—'}</td>
                      <td>{p.submitted_at ? new Date(p.submitted_at).toLocaleString('ar-EG') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'leaderboard' && (
          <>
            <div className="toolbar">
              <button className="btn" onClick={exportLeaderboardCSV}>تصدير CSV</button>
            </div>

            <div className="card tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الاسم</th>
                    <th>الإيميل</th>
                    <th>النقاط</th>
                    <th>التوقعات</th>
                    <th>الإحالات</th>
                    <th>تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((u:any, idx:number)=>(
                    <tr key={u.user_id}>
                      <td>{idx+1}</td>
                      <td>{u.full_name || '—'}</td>
                      <td>{u.user_email || '—'}</td>
                      <td>{u.total || 0}</td>
                      <td>{u.count || 0}</td>
                      <td>{u.referral_count || 0}</td>
                      <td><button className="btn blue" onClick={()=>openUserBreakdown(u)}>عرض</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'leagues' && (
          <div className="grid2">
            {leagues.map((lg:any)=>(
              <div key={lg.id} className="card leagueBox">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:900}}>{lg.name}</div>
                    <div className="muted">الكود: {lg.code} • المالك: {lg.owner_name}</div>
                  </div>
                  <div className="right">
                    <span className="pill">الأعضاء: {lg.member_count}</span>
                    <span className="pill">دعوات معلقة: {lg.pending_invites}</span>
                    <span className="pill">أعلى نقاط: {lg.top_points}</span>
                    <button className="btn" onClick={()=>setExpandedLeague(expandedLeague===lg.id?null:lg.id)}>
                      {expandedLeague===lg.id?'إخفاء':'الأعضاء'}
                    </button>
                    <button className="btn red" onClick={()=>adminDeleteLeague(lg)}>حذف الليج</button>
                  </div>
                </div>

                {expandedLeague===lg.id && (
                  <div className="spacer">
                    <div className="tableWrap" style={{marginTop:12}}>
                      <table>
                        <thead>
                          <tr>
                            <th>الاسم</th>
                            <th>الإيميل</th>
                            <th>النقاط</th>
                            <th>الدور</th>
                            <th>إزالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(leagueMembers[lg.id] || []).map((m:any)=>(
                            <tr key={`${lg.id}-${m.user_id}`}>
                              <td>{m._profile?.full_name || '—'}</td>
                              <td>{m._profile?.user_email || '—'}</td>
                              <td>{m._profile?.total_points || 0}</td>
                              <td>{m.role || 'member'}</td>
                              <td>
                                <button
                                  className="btn red"
                                  disabled={m.role==='owner'}
                                  onClick={()=>adminRemoveMember(lg.id,m.user_id,m._profile?.full_name || m._profile?.user_email || 'العضو')}
                                >
                                  إزالة
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'prizes' && (
          <div className="grid2">
            <div className="card">
              <div style={{fontSize:22,fontWeight:900,marginBottom:12}}>المراحل</div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>المرحلة</th>
                      <th>الحالة</th>
                      <th>الفترة</th>
                      <th>إدارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prizePhases.map((phase:any)=>(
                      <tr key={phase.id}>
                        <td>{phase.name}</td>
                        <td>{phase.status}</td>
                        <td>{phase.start_date} → {phase.end_date}</td>
                        <td>
                          <button
                            className="btn blue"
                            onClick={async()=>{
                              setShowPrizeModal(true);
                              setPrizeModalLoading(true);
                              setSelectedPhase(phase);
                              try {
                                const { data } = await supabase.rpc('get_phase_leaderboard', { p_phase_key: phase.phase_key });
                                setPhaseLeaderboard(data || []);
                              } finally {
                                setPrizeModalLoading(false);
                              }
                            }}
                          >
                            إدارة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div style={{fontSize:22,fontWeight:900,marginBottom:12}}>أفضل مسجلين اليوم</div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyScorers.map((u:any, idx:number)=>(
                      <tr key={u.user_id || idx}>
                        <td>{idx+1}</td>
                        <td>{u.full_name || u.user_email || '—'}</td>
                        <td>{u.total_points || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{fontSize:22,fontWeight:900,margin:'18px 0 12px'}}>الفائزون المحفوظون</div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>المرحلة</th>
                      <th>الترتيب</th>
                      <th>الاسم</th>
                      <th>الجائزة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prizeWinners.map((w:any)=>(
                      <tr key={w.id}>
                        <td>{w.phase_id}</td>
                        <td>{w.rank}</td>
                        <td>{w.profiles?.full_name || '—'}</td>
                        <td>{w.prize_label || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showModal && selectedMatch && (
          <div className="modalBackdrop" onClick={()=>!savingResult && setShowModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:24,fontWeight:900,marginBottom:12}}>
                نتيجة: {selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}
              </div>

              <div className="grid2">
                <div className="field">
                  <label>أهداف الفريق الأول</label>
                  <input type="number" value={homeScore} onChange={e=>setHomeScore(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>أهداف الفريق الثاني</label>
                  <input type="number" value={awayScore} onChange={e=>setAwayScore(Number(e.target.value))} />
                </div>
              </div>

              <div className="spacer" />

              <div className="field">
                <label>أول هداف</label>
                <input value={firstScorer} onChange={e=>setFirstScorer(e.target.value)} placeholder="اسم اللاعب" />
              </div>

              <div className="spacer" />

              <div className="row">
                <label className="pill"><input type="checkbox" checked={extraTime} onChange={e=>setExtraTime(e.target.checked)} /> وقت إضافي</label>
                <label className="pill"><input type="checkbox" checked={redCard} onChange={e=>setRedCard(e.target.checked)} /> بطاقة حمراء</label>
                <label className="pill"><input type="checkbox" checked={penalty} onChange={e=>setPenalty(e.target.checked)} /> ركلة جزاء</label>
                <label className="pill"><input type="checkbox" checked={bothTeams} onChange={e=>setBothTeams(e.target.checked)} /> الفريقان يسجلان</label>
              </div>

              <div className="spacer" />

              <div className="right" style={{justifyContent:'flex-end'}}>
                <button className="btn" onClick={()=>setShowModal(false)} disabled={savingResult}>إلغاء</button>
                <button className="btn primary" onClick={saveResult} disabled={savingResult}>
                  {savingResult ? 'جارٍ الحفظ...' : 'حفظ النتيجة'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showBreakdown && (
          <div className="modalBackdrop" onClick={()=>setShowBreakdown(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:24,fontWeight:900,marginBottom:12}}>
                تفاصيل توقعات: {breakdownUser?.full_name || breakdownUser?.user_email || '—'}
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>المباراة</th>
                      <th>التوقع</th>
                      <th>النتيجة الفعلية</th>
                      <th>النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownPreds.map((pr:any)=>(
                      <tr key={pr.id}>
                        <td>{pr.home_team} × {pr.away_team}</td>
                        <td>{pr.predicted_home_score}-{pr.predicted_away_score}</td>
                        <td>{pr.actual_home_score==null?'—':`${pr.actual_home_score}-${pr.actual_away_score}`}</td>
                        <td>{pr.points ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="right" style={{justifyContent:'flex-end',marginTop:16}}>
                <button className="btn" onClick={()=>setShowBreakdown(false)}>إغلاق</button>
              </div>
            </div>
          </div>
        )}

        {showPrizeModal && selectedPhase && (
          <div className="modalBackdrop" onClick={()=>!savingWinner && setShowPrizeModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:24,fontWeight:900,marginBottom:12}}>
                إدارة جوائز: {selectedPhase.name}
              </div>

              {prizeModalLoading ? (
                <div>جارٍ التحميل...</div>
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>الاسم</th>
                        <th>النقاط</th>
                        <th>حفظ كفائز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseLeaderboard.map((u:any, idx:number)=>(
                        <tr key={u.user_id || idx}>
                          <td>{idx+1}</td>
                          <td>{u.full_name || u.user_email || '—'}</td>
                          <td>{u.total_points || 0}</td>
                          <td>
                            <button
                              className="btn primary"
                              disabled={savingWinner}
                              onClick={async()=>{
                                try {
                                  setSavingWinner(true);
                                  await supabase.from('prize_winners').insert({
                                    phase_id: selectedPhase.id,
                                    user_id: u.user_id,
                                    rank: idx + 1,
                                    prize_label: idx === 0 ? 'المركز الأول' : idx === 1 ? 'المركز الثاني' : 'مركز متقدم',
                                  });
                                  await supabase.from('prize_phases').update({ status: 'completed' }).eq('id', selectedPhase.id);
                                  showMsg('✅ تم حفظ الفائز');
                                  setShowPrizeModal(false);
                                  await loadPrizes();
                                } catch (err:any) {
                                  showMsg('❌ '+(err?.message || 'خطأ'), 'error');
                                } finally {
                                  setSavingWinner(false);
                                }
                              }}
                            >
                              حفظ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="right" style={{justifyContent:'flex-end',marginTop:16}}>
                <button className="btn" onClick={()=>setShowPrizeModal(false)} disabled={savingWinner}>إغلاق</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
