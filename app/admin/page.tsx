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
  const [activeTab, setActiveTab]     = useState<'matches'|'predictions'|'leaderboard'>('matches');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [updating, setUpdating]       = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [message, setMessage]         = useState('');
  const [msgType, setMsgType]         = useState<'success'|'error'>('success');
  const [showModal, setShowModal]         = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [homeScore, setHomeScore]         = useState(0);
  const [awayScore, setAwayScore]         = useState(0);
  const [firstScorer, setFirstScorer]     = useState('');
  const [extraTime, setExtraTime]         = useState(false);
  const [surpriseQ, setSurpriseQ]         = useState('');
  const [surpriseA, setSurpriseA]         = useState('');
  const [savingResult, setSavingResult]   = useState(false);

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
      const res  = await fetch('/api/fixtures');
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
          is_open:           sb?.is_open           ?? false,
          actual_home_score: sb?.actual_home_score ?? null,
          actual_away_score: sb?.actual_away_score ?? null,
          first_scorer:      sb?.first_scorer      ?? '',
          went_extra_time:   sb?.went_extra_time   ?? false,
          surprise_answer:   sb?.surprise_answer   ?? '',
          surprise_question: sb?.surprise_question ?? '',
        };
      }));
    } catch (err) { console.error('loadMatches:', err); }
    setLoading(false);
  }, []);

  const loadPredictions = useCallback(async () => {
    const { data } = await supabase.from('predictions').select('*').order('submitted_at',{ascending:false});
    setPredictions(data || []);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabase.from('predictions').select('user_id,user_email,points,fixture_id');
    const g: any = {};
    data?.forEach((r: any) => {
      if (!g[r.user_id]) g[r.user_id] = {user_id:r.user_id,user_email:r.user_email,total:0,count:0,best:0};
      g[r.user_id].total += r.points||0;
      g[r.user_id].count += 1;
      if ((r.points||0) > g[r.user_id].best) g[r.user_id].best = r.points||0;
    });
    setLeaderboard(Object.values(g).sort((a:any,b:any) => b.total-a.total));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email||'')) { router.push('/dashboard'); return; }
      setUser(data.user);
      loadMatches(); loadPredictions(); loadLeaderboard();
    });
  }, [router, loadMatches, loadPredictions, loadLeaderboard]);

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open;
    const fid = match.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      if (ex) {
        const { error } = await supabase.from('fixtures').update({is_open:newStatus}).eq('api_fixture_id',fid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id:fid, is_open:newStatus,
          home_team:match.teams.home.name, away_team:match.teams.away.name,
          match_date:match.fixture.date, round:match.league.round,
        });
        if (error) throw error;
      }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
    } catch (err: any) {
      console.error('toggleMatchOpen:', err);
      showMsg('❌ ' + (err?.message || 'خطأ في التحديث'), 'error');
    }
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setHomeScore(match.actual_home_score  ?? 0);
    setAwayScore(match.actual_away_score  ?? 0);
    setFirstScorer(match.first_scorer     ?? '');
    setExtraTime(match.went_extra_time    ?? false);
    setSurpriseQ(match.surprise_question  ?? '');
    setSurpriseA(match.surprise_answer    ?? '');
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
        actual_home_score: homeScore, actual_away_score: awayScore,
        first_scorer: firstScorer||null, went_extra_time: extraTime,
        surprise_answer: surpriseA||null, surprise_question: surpriseQ||null,
      };
      if (ex) {
        const { error } = await supabase.from('fixtures').update(payload).eq('api_fixture_id',fid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id:fid, is_open:false,
          home_team:selectedMatch.teams.home.name, away_team:selectedMatch.teams.away.name,
          match_date:selectedMatch.fixture.date, round:selectedMatch.league.round, ...payload,
        });
        if (error) throw error;
      }
      setShowModal(false);
      await loadMatches();
      showMsg('✅ تم حفظ النتيجة بنجاح');
    } catch (err: any) {
      console.error('saveResult:', err);
      showMsg('❌ ' + (err?.message || 'خطأ في الحفظ'), 'error');
    }
    setSavingResult(false);
  };

  const openAllMatches = async () => {
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound);
    let ok=0, fail=0;
    for (const match of filtered) {
      const fid = match.fixture.id;
      try {
        const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
        if (se) throw se;
        if (ex) {
          const { error } = await supabase.from('fixtures').update({is_open:true}).eq('api_fixture_id',fid);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('fixtures').insert({
            api_fixture_id:fid, is_open:true,
            home_team:match.teams.home.name, away_team:match.teams.away.name,
            match_date:match.fixture.date, round:match.league.round,
          });
          if (error) throw error;
        }
        ok++;
      } catch (err) { console.error('openAll err:', fid, err); fail++; }
    }
    await loadMatches(); setUpdating(false);
    showMsg(fail===0 ? `✅ تم فتح ${ok} ماتش` : `⚠️ فتح ${ok} — فشل ${fail}`, fail===0?'success':'error');
  };

  const closeAllMatches = async () => {
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

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="fifa-admin" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:40,marginBottom:12}}>⚙️</p>
        <p style={{color:'var(--fifa-muted)',fontSize:14}}>جاري التحميل...</p>
      </div>
    </div>
  );

  const filteredMatches = matches.filter(m => m.league.round === activeRound);
  const openCount       = matches.filter(m => m.is_open).length;
  const gradedCount     = predictions.filter(p => p.actual_home_score !== null).length;
  const medals          = ['🥇','🥈','🥉'];

  return (
    <>
      <main className="fifa-admin" dir="rtl" style={{padding:'0 0 40px'}}>
        <div style={{maxWidth:960,margin:'0 auto',padding:'24px 16px',display:'flex',flexDirection:'column',gap:18}}>

          {/* HEADER */}
          <header className="fifa-panel" style={{
            display:'flex',alignItems:'center',justifyContent:'space-between',
            gap:16,flexWrap:'wrap',padding:'20px 24px',
            background:'linear-gradient(180deg,rgba(217,178,95,.08),transparent 18%),var(--fifa-surface)'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{
                width:48,height:48,borderRadius:16,
                background:'linear-gradient(135deg,#f0cf84,#a97b26)',
                display:'grid',placeItems:'center',
                color:'#231a0c',fontWeight:900,fontSize:22,
                boxShadow:'0 8px 24px rgba(217,178,95,.25)'
              }}>⚙️</div>
              <div>
                <h1 style={{fontSize:20,fontWeight:900,color:'var(--fifa-gold)',margin:0}}>لوحة التحكم</h1>
                <p style={{fontSize:12,color:'var(--fifa-muted)',margin:'2px 0 0'}}>كأس العالم 2026 — الشمعدان</p>
              </div>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="fifa-btn" onClick={syncFixtures} disabled={syncing}>
                {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الماتشات'}
              </button>
              <button className="fifa-btn fifa-btn-gold" onClick={updateAllPoints} disabled={updating}>
                {updating ? '⏳ جاري التحديث...' : '⚡ تحديث النقاط'}
              </button>
              <button className="fifa-btn fifa-btn-ghost" onClick={handleLogout}>خروج</button>
            </div>
          </header>

          {/* MESSAGE */}
          {message && (
            <div className={`fifa-msg-${msgType}`}>{message}</div>
          )}

          {/* STATS */}
          <div className="fifa-stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
            {[
              {label:'إجمالي التوقعات',value:predictions.length,color:'var(--fifa-gold)'},
              {label:'توقعات محسوبة',  value:gradedCount,        color:'var(--fifa-green)'},
              {label:'ماتشات مفتوحة',  value:openCount,          color:'#facc15'},
              {label:'المتسابقين',      value:leaderboard.length, color:'#ff9c91'},
            ].map(s => (
              <div key={s.label} className="fifa-stat">
                <div style={{color:'var(--fifa-muted)',fontSize:12,marginBottom:8}}>{s.label}</div>
                <div style={{fontSize:32,fontWeight:900,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* TABS */}
          <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:4}}>
            {(['matches','predictions','leaderboard'] as const).map(tab => (
              <button key={tab}
                className={`fifa-tab${activeTab===tab?' fifa-tab-active':''}`}
                onClick={() => setActiveTab(tab)}>
                {tab==='matches'       ? `🏟️ الماتشات (${matches.length})`
                 : tab==='predictions' ? `📋 التوقعات (${predictions.length})`
                 : `🏆 الصدارة (${leaderboard.length})`}
              </button>
            ))}
          </div>

          {/* ── MATCHES ── */}
          {activeTab==='matches' && (
            <div className="fifa-panel" style={{display:'flex',flexDirection:'column',gap:18}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {rounds.map(r => (
                    <button key={r}
                      className={`fifa-round-tab${activeRound===r?' fifa-round-tab-active':''}`}
                      onClick={() => setActiveRound(r)}>
                      {roundLabels[r]}
                      <span style={{opacity:.4,fontSize:11,marginRight:4}}>({matches.filter(m=>m.league.round===r).length})</span>
                    </button>
                  ))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="fifa-btn fifa-btn-green" onClick={openAllMatches} disabled={updating}>🟢 فتح الكل</button>
                  <button className="fifa-btn fifa-btn-ghost" onClick={closeAllMatches} disabled={updating}>🔒 غلق الكل</button>
                </div>
              </div>

              <div className="fifa-matches-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
                {filteredMatches.map(match => {
                  const hasResult  = match.actual_home_score !== null && match.actual_home_score !== undefined;
                  const matchPreds = predictions.filter(p => p.fixture_id===match.fixture.id);
                  return (
                    <article key={match.fixture.id} className={`fifa-card${match.is_open?' fifa-card-open':''}`}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:14}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:match.is_open?'var(--fifa-green)':'var(--fifa-muted)'}}/>
                            <p style={{fontSize:14,fontWeight:800,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {match.teams.home.name} × {match.teams.away.name}
                            </p>
                          </div>
                          <p style={{fontSize:11,color:'var(--fifa-muted)',margin:0}}>
                            {new Date(match.fixture.date).toLocaleDateString('ar-EG',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                          </p>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                          <span className={match.is_open?'fifa-pill-open':'fifa-pill-closed'}>
                            {match.is_open?'مفتوح':'مغلق'}
                          </span>
                          {matchPreds.length>0 && <span style={{fontSize:11,color:'var(--fifa-muted)'}}>👥 {matchPreds.length} توقع</span>}
                        </div>
                      </div>

                      {hasResult && (
                        <div className="fifa-result-box">
                          <div style={{color:'#5effa8',fontSize:22,fontWeight:900}}>{match.actual_home_score} — {match.actual_away_score}</div>
                          {match.first_scorer     && <div style={{color:'#facc15',fontSize:11,marginTop:4}}>⚽ {match.first_scorer}</div>}
                          {match.went_extra_time  && <div style={{color:'#60a5fa',fontSize:11,marginTop:2}}>⏱️ ذهب لوقت إضافي</div>}
                          {match.surprise_question&& <div style={{color:'#c084fc',fontSize:11,marginTop:2}}>❓ {match.surprise_question}</div>}
                        </div>
                      )}

                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <button
                          className={`fifa-btn ${match.is_open?'fifa-btn-ghost':'fifa-btn-green'}`}
                          style={{fontSize:12,padding:'10px 12px',borderRadius:14}}
                          onClick={() => toggleMatchOpen(match)}>
                          {match.is_open ? '🔒 غلق التوقعات' : '🟢 فتح التوقعات'}
                        </button>
                        <button
                          className="fifa-btn fifa-btn-red"
                          style={{fontSize:12,padding:'10px 12px',borderRadius:14}}
                          onClick={() => openResultModal(match)}>
                          {hasResult ? '✏️ تعديل النتيجة' : '⚽ إدخال النتيجة'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PREDICTIONS ── */}
          {activeTab==='predictions' && (
            <div className="fifa-panel" style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--fifa-line)'}}>
                    {['المستخدم','الماتش','توقعي','الفعلية','أول هدف','إضافي','النقاط'].map(h => (
                      <th key={h} style={{padding:'11px 14px',color:'var(--fifa-muted)',fontWeight:700,fontSize:12,textAlign:'right'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {predictions.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                      <td style={{padding:'11px 14px',fontSize:12,color:'var(--fifa-muted)'}}>{p.user_email?.split('@')[0]}</td>
                      <td style={{padding:'11px 14px',fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.home_team} × {p.away_team}</td>
                      <td style={{padding:'11px 14px',fontSize:12,textAlign:'center',fontWeight:900}}>{p.predicted_home_score} - {p.predicted_away_score}</td>
                      <td style={{padding:'11px 14px',fontSize:12,textAlign:'center',color:'#5effa8',fontWeight:700}}>{p.actual_home_score!==null?`${p.actual_home_score} - ${p.actual_away_score}`:'⏳'}</td>
                      <td style={{padding:'11px 14px',fontSize:12,textAlign:'center',color:'#facc15'}}>{p.predicted_first_scorer||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:12,textAlign:'center',color:'#60a5fa'}}>{p.predicted_extra_time?'نعم':'لا'}</td>
                      <td style={{padding:'11px 14px',fontSize:12,textAlign:'center'}}>
                        <span style={{
                          padding:'3px 10px',borderRadius:999,fontWeight:900,fontSize:12,
                          background:p.points>=10?'rgba(217,178,95,.14)':p.points>=5?'rgba(39,176,110,.12)':'rgba(255,255,255,.06)',
                          color:p.points>=10?'#ffe3a6':p.points>=5?'#5effa8':'var(--fifa-muted)',
                        }}>
                          {p.actual_home_score!==null?(p.points||0):'—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {predictions.length===0 && (
                    <tr><td colSpan={7} style={{textAlign:'center',padding:'40px',color:'var(--fifa-muted)'}}>لا توجد توقعات بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          {activeTab==='leaderboard' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {leaderboard.length===0
                ? <div className="fifa-panel" style={{textAlign:'center',padding:'40px',color:'var(--fifa-muted)'}}>لا توجد بيانات بعد</div>
                : leaderboard.map((p:any,i) => (
                  <div key={p.user_id} className="fifa-card"
                    style={i<3?{borderColor:'rgba(217,178,95,.25)',background:'linear-gradient(90deg,rgba(217,178,95,.08),rgba(255,255,255,.02))'}:{}}>
                    <div style={{display:'grid',gridTemplateColumns:'44px 1fr auto',alignItems:'center',gap:14}}>
                      <div style={{width:44,height:44,borderRadius:14,background:'rgba(217,178,95,.1)',display:'grid',placeItems:'center',fontSize:i<3?22:14,fontWeight:900,color:'var(--fifa-muted)'}}>
                        {i<3?medals[i]:`#${i+1}`}
                      </div>
                      <div>
                        <p style={{fontSize:15,fontWeight:800,margin:0}}>{p.user_email?.split('@')[0]}</p>
                        <p style={{fontSize:12,color:'var(--fifa-muted)',margin:'2px 0 0'}}>{p.count} توقع · أفضل: {p.best} نقطة</p>
                      </div>
                      <div style={{textAlign:'left'}}>
                        <strong style={{display:'block',fontSize:26,fontWeight:900,color:i===0?'var(--fifa-gold)':i===1?'#d1d5db':i===2?'#b45309':'var(--fifa-text)'}}>{p.total}</strong>
                        <span style={{fontSize:11,color:'var(--fifa-muted)'}}>نقطة</span>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

        </div>
      </main>

      {/* MODAL — outside main */}
      {showModal && selectedMatch && (
        <div className="fifa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="fifa-modal" onClick={e => e.stopPropagation()}>
            <div style={{position:'sticky',top:0,background:'var(--fifa-surface-2)',borderBottom:'1px solid var(--fifa-line)',padding:'20px 22px 16px',zIndex:10}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div>
                  <p style={{fontSize:12,color:'var(--fifa-muted)',margin:'0 0 4px'}}>إدخال نتيجة المباراة</p>
                  <h2 style={{fontSize:16,fontWeight:900,margin:0}}>{selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}</h2>
                </div>
                <button onClick={() => setShowModal(false)}
                  style={{width:34,height:34,borderRadius:'50%',background:'var(--fifa-surface-3)',border:'1px solid var(--fifa-line)',color:'var(--fifa-muted)',fontSize:20,display:'grid',placeItems:'center',cursor:'pointer',flexShrink:0}}>×</button>
              </div>
            </div>

            <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <p style={{fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:10}}>النتيجة الفعلية</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[
                    {team:selectedMatch.teams.home.name, val:homeScore, set:setHomeScore},
                    {team:selectedMatch.teams.away.name, val:awayScore, set:setAwayScore},
                  ].map(({team,val,set}) => (
                    <div key={team} style={{background:'var(--fifa-surface-3)',borderRadius:16,padding:14,textAlign:'center'}}>
                      <p style={{fontSize:11,color:'var(--fifa-muted)',marginBottom:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{team}</p>
                      <input type="number" min={0} value={val}
                        onChange={e => set(Number(e.target.value))}
                        style={{width:'100%',height:64,borderRadius:14,background:'#fff',color:'#000',fontSize:32,fontWeight:900,textAlign:'center',border:'none',outline:'none',fontFamily:'Cairo,Tajawal,sans-serif'}}/>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p style={{fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:8}}>⚽ أول هدف</p>
                <input className="fifa-field-input" type="text" value={firstScorer}
                  onChange={e => setFirstScorer(e.target.value)} placeholder="مثال: محمد صلاح"/>
              </div>

              <label style={{display:'flex',alignItems:'center',gap:12,minHeight:48,background:'var(--fifa-surface-3)',border:'1px solid var(--fifa-line)',padding:'12px 16px',borderRadius:16,cursor:'pointer'}}>
                <input type="checkbox" checked={extraTime} onChange={e => setExtraTime(e.target.checked)}
                  style={{width:18,height:18,accentColor:'var(--fifa-red)',flexShrink:0}}/>
                <span style={{fontSize:13}}>⏱️ الماتش راح لوقت إضافي؟</span>
              </label>

              <div>
                <p style={{fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:8}}>❓ سؤال المفاجأة</p>
                <input className="fifa-field-input" type="text" value={surpriseQ}
                  onChange={e => setSurpriseQ(e.target.value)} placeholder="مثال: من هيكون أفضل لاعب؟"/>
              </div>

              <div>
                <p style={{fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:8}}>🎯 الإجابة الصحيحة <span style={{color:'#facc15',fontSize:11}}>+5 نقاط</span></p>
                <input className="fifa-field-input" type="text" value={surpriseA}
                  onChange={e => setSurpriseA(e.target.value)} placeholder="الإجابة الصحيحة"/>
              </div>

              <div style={{background:'var(--fifa-surface)',border:'1px solid var(--fifa-line)',borderRadius:16,padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['#facc15','🏆 نتيجة كاملة = 10'],['#5effa8','✅ فايز صح = 5'],['#60a5fa','⚽ أول هدف = 3'],['#93c5fd','⏱️ وقت إضافي = 2'],['#c084fc','🎯 مفاجأة = 5'],['var(--fifa-muted)','الحد الأقصى = 25']].map(([color,text]) => (
                  <span key={text} style={{fontSize:11,color:color as string}}>{text}</span>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,paddingBottom:4}}>
                <button className="fifa-btn fifa-btn-gold" disabled={savingResult}
                  style={{minHeight:52,borderRadius:18,fontSize:14,fontWeight:900}}
                  onClick={saveResult}>
                  {savingResult?'⏳ جاري الحفظ...':'💾 حفظ النتيجة'}
                </button>
                <button className="fifa-btn fifa-btn-ghost"
                  style={{minHeight:52,borderRadius:18,fontSize:14,fontWeight:700}}
                  onClick={() => setShowModal(false)}>
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
