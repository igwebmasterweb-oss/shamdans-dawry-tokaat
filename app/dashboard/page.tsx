'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser]               = useState<any>(null);
  const [matches, setMatches]         = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'predict'|'my'|'leaders'>('predict');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  const [predForms, setPredForms]     = useState<Record<number,any>>({});
  const [submitting, setSubmitting]   = useState<number|null>(null);
  const [messages, setMessages]       = useState<Record<number,string>>({});

  const router = useRouter();
  const rounds = ['Group Stage - 1','Group Stage - 2','Group Stage - 3'];
  const roundLabels: Record<string,string> = {
    'Group Stage - 1':'الجولة الأولى',
    'Group Stage - 2':'الجولة الثانية',
    'Group Stage - 3':'الجولة الثالثة',
  };

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      loadData(data.user.id);
    });
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const res  = await fetch('/api/fixtures');
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

      const { data: userPreds } = await supabase
        .from('predictions').select('*').eq('user_id', userId);
      setPredictions(userPreds || []);

      const { data: allPreds } = await supabase
        .from('predictions').select('user_id,user_email,points');
      const grouped: any = {};
      allPreds?.forEach((row: any) => {
        if (!grouped[row.user_id])
          grouped[row.user_id] = {user_id:row.user_id,user_email:row.user_email,totalPoints:0,count:0};
        grouped[row.user_id].totalPoints += row.points||0;
        grouped[row.user_id].count += 1;
      });
      setLeaderboard(Object.values(grouped).sort((a:any,b:any) => b.totalPoints-a.totalPoints));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const getForm = (match: any) => {
    if (predForms[match.fixture.id]) return predForms[match.fixture.id];
    const ex = predictions.find(p => p.fixture_id===match.fixture.id);
    return {
      homeScore:      ex?.predicted_home_score   ?? 0,
      awayScore:      ex?.predicted_away_score   ?? 0,
      firstScorer:    ex?.predicted_first_scorer ?? '',
      extraTime:      ex?.predicted_extra_time   ?? false,
      surpriseAnswer: ex?.surprise_answer        ?? '',
    };
  };

  const setForm = (fixtureId: number, patch: any) =>
    setPredForms(prev => ({...prev,[fixtureId]:{...getForm({fixture:{id:fixtureId}}),...patch}}));

  const submitPrediction = async (match: any) => {
    if (!user) return;
    setSubmitting(match.fixture.id);
    const form = getForm(match);
    try {
      const ex = predictions.find(p => p.fixture_id===match.fixture.id);
      const payload = {
        user_id:                user.id,
        user_email:             user.email,
        fixture_id:             match.fixture.id,
        home_team:              match.teams.home.name,
        away_team:              match.teams.away.name,
        predicted_home_score:   form.homeScore,
        predicted_away_score:   form.awayScore,
        predicted_first_scorer: form.firstScorer||null,
        predicted_extra_time:   form.extraTime,
        surprise_answer:        form.surpriseAnswer||null,
        submitted_at:           new Date().toISOString(),
        points:                 ex?.points ?? 0,
        actual_home_score:      null,
        actual_away_score:      null,
      };
      if (ex) await supabase.from('predictions').update(payload).eq('id',ex.id);
      else     await supabase.from('predictions').insert(payload);

      const { data } = await supabase.from('predictions').select('*').eq('user_id',user.id);
      setPredictions(data||[]);
      setMessages(m=>({...m,[match.fixture.id]:'✅ تم الحفظ!'}));
      setTimeout(()=>setMessages(m=>({...m,[match.fixture.id]:''})),3000);
    } catch {
      setMessages(m=>({...m,[match.fixture.id]:'❌ خطأ في الحفظ'}));
    }
    setSubmitting(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="fifa-admin" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:48,marginBottom:12,animation:'pulse 1.5s infinite'}}>🏆</p>
        <p style={{color:'var(--fifa-muted)',fontSize:14}}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );

  const myPoints = predictions.reduce((s,p)=>s+(p.points||0),0);
  const myRank   = leaderboard.findIndex(p=>p.user_id===user?.id)+1;
  const filteredMatches = matches.filter(m=>m.league.round===activeRound);
  const medals = ['🥇','🥈','🥉'];

  return (
    <main className="fifa-admin" dir="rtl" style={{minHeight:'100vh',padding:'0 0 40px'}}>
      <div style={{maxWidth:680,margin:'0 auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14}}>

        {/* ── HEADER ── */}
        <header className="fifa-panel" style={{
          padding:'18px 20px',
          background:'linear-gradient(180deg,rgba(217,178,95,.08),transparent 20%),var(--fifa-surface)',
        }}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{
                width:44,height:44,borderRadius:14,
                background:'linear-gradient(135deg,#f0cf84,#a97b26)',
                display:'grid',placeItems:'center',fontSize:22,
                boxShadow:'0 8px 20px rgba(217,178,95,.22)',flexShrink:0,
              }}>🏆</div>
              <div>
                <h1 style={{fontSize:16,fontWeight:900,color:'var(--fifa-gold)',margin:0,lineHeight:1.2}}>
                  الشمعدان × كأس العالم
                </h1>
                <p style={{fontSize:12,color:'var(--fifa-muted)',margin:'3px 0 0'}}>
                  أهلاً {user?.email?.split('@')[0]}! 👋
                </p>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              <div style={{
                display:'flex',alignItems:'center',gap:14,
                background:'var(--fifa-surface-3)',
                border:'1px solid var(--fifa-line)',
                borderRadius:18,padding:'10px 16px',
              }}>
                <div style={{textAlign:'center'}}>
                  <p style={{fontSize:22,fontWeight:900,color:'var(--fifa-gold)',lineHeight:1,margin:0}}>{myPoints}</p>
                  <p style={{fontSize:11,color:'var(--fifa-muted)',margin:'3px 0 0'}}>نقطة</p>
                </div>
                {myRank>0 && (
                  <>
                    <div style={{width:1,height:32,background:'var(--fifa-line)'}}/>
                    <div style={{textAlign:'center'}}>
                      <p style={{fontSize:22,fontWeight:900,color:'var(--fifa-green)',lineHeight:1,margin:0}}>#{myRank}</p>
                      <p style={{fontSize:11,color:'var(--fifa-muted)',margin:'3px 0 0'}}>ترتيب</p>
                    </div>
                  </>
                )}
              </div>
              <button className="fifa-btn fifa-btn-ghost" onClick={handleLogout} style={{padding:'10px 14px'}}>
                خروج
              </button>
            </div>
          </div>
        </header>

        {/* ── TABS ── */}
        <div style={{display:'flex',gap:8}}>
          {(['predict','my','leaders'] as const).map(tab => (
            <button key={tab}
              className={`fifa-tab${activeTab===tab?' fifa-tab-active':''}`}
              style={{flex:1,borderRadius:18}}
              onClick={()=>setActiveTab(tab)}>
              {tab==='predict'?'⚽ التوقعات':tab==='my'?'📋 توقعاتي':'🏆 الصدارة'}
            </button>
          ))}
        </div>

        {/* ════════════ PREDICT TAB ════════════ */}
        {activeTab==='predict' && (
          <section style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Round tabs */}
            <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
              {rounds.map(r=>(
                <button key={r}
                  className={`fifa-round-tab${activeRound===r?' fifa-round-tab-active':''}`}
                  style={{flexShrink:0}}
                  onClick={()=>setActiveRound(r)}>
                  {roundLabels[r]}
                  <span style={{marginRight:4,opacity:.4,fontSize:11}}>({matches.filter(m=>m.league.round===r).length})</span>
                </button>
              ))}
            </div>

            {filteredMatches.length===0 ? (
              <div className="fifa-panel" style={{padding:'60px 20px',textAlign:'center',color:'var(--fifa-muted)'}}>
                لا توجد ماتشات في هذه الجولة
              </div>
            ) : filteredMatches.map(match=>{
              const existing  = predictions.find(p=>p.fixture_id===match.fixture.id);
              const form      = getForm(match);
              const hasResult = match.actual_home_score!==null && match.actual_home_score!==undefined;
              const msg       = messages[match.fixture.id];

              return (
                <article key={match.fixture.id}
                  className="fifa-card"
                  style={{
                    borderColor: !match.is_open
                      ? 'var(--fifa-line)'
                      : existing
                        ? 'rgba(39,176,110,.35)'
                        : 'rgba(201,58,47,.35)',
                    display:'flex',flexDirection:'column',gap:14,
                  }}>

                  {/* match header */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:match.is_open?'var(--fifa-green)':'var(--fifa-muted)'}}/>
                        <h2 style={{fontSize:15,fontWeight:900,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {match.teams.home.name} <span style={{color:'var(--fifa-muted)',fontWeight:400}}>×</span> {match.teams.away.name}
                        </h2>
                      </div>
                      <p style={{fontSize:11,color:'var(--fifa-muted)',margin:0}}>
                        {new Date(match.fixture.date).toLocaleDateString('ar-EG',{weekday:'long',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                      <span className={match.is_open?'fifa-pill-open':'fifa-pill-closed'}>
                        {match.is_open?'مفتوح':'مغلق'}
                      </span>
                      {existing && <span style={{fontSize:11,color:'var(--fifa-green)',fontWeight:700}}>✅ محفوظ</span>}
                    </div>
                  </div>

                  {/* result box */}
                  {hasResult && (
                    <div className="fifa-result-box">
                      <p style={{color:'#5effa8',fontWeight:900,fontSize:26,margin:'0 0 4px'}}>
                        {match.actual_home_score} — {match.actual_away_score}
                      </p>
                      <p style={{color:'var(--fifa-muted)',fontSize:11,margin:0}}>النتيجة الفعلية</p>
                      {match.first_scorer && <p style={{color:'#facc15',fontSize:11,marginTop:6}}>⚽ أول هدف: {match.first_scorer}</p>}
                      {existing && (
                        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(39,176,110,.15)'}}>
                          <p style={{margin:0,fontSize:14,color:'var(--fifa-text)'}}>
                            نقاطك: <strong style={{color:'var(--fifa-gold)',fontSize:22}}>{existing.points||0}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* prediction form */}
                  {match.is_open && (
                    <div style={{display:'flex',flexDirection:'column',gap:14}}>
                      {/* score */}
                      <div>
                        <p style={{fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:10}}>توقع النتيجة</p>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          {[
                            {key:'homeScore',team:match.teams.home.name},
                            {key:'awayScore',team:match.teams.away.name},
                          ].map(({key,team})=>(
                            <div key={key} style={{background:'var(--fifa-surface-3)',borderRadius:18,padding:'14px 12px',textAlign:'center'}}>
                              <p style={{fontSize:11,color:'var(--fifa-muted)',marginBottom:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{team}</p>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                                <button
                                  onClick={()=>setForm(match.fixture.id,{[key]:Math.max(0,(form[key]||0)-1)})}
                                  style={{width:36,height:36,borderRadius:12,background:'var(--fifa-surface-2)',border:'1px solid var(--fifa-line)',color:'var(--fifa-text)',fontSize:18,fontWeight:900,display:'grid',placeItems:'center',cursor:'pointer'}}>
                                  −
                                </button>
                                <span style={{fontSize:38,fontWeight:900,width:44,textAlign:'center',fontVariantNumeric:'tabular-nums'}}>
                                  {form[key]||0}
                                </span>
                                <button
                                  onClick={()=>setForm(match.fixture.id,{[key]:(form[key]||0)+1})}
                                  style={{width:36,height:36,borderRadius:12,background:'var(--fifa-red)',border:'none',color:'#fff',fontSize:18,fontWeight:900,display:'grid',placeItems:'center',cursor:'pointer'}}>
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* first scorer */}
                      <div>
                        <label style={{display:'block',fontSize:12,color:'var(--fifa-muted)',fontWeight:700,marginBottom:8}}>
                          ⚽ أول هدف <span style={{color:'#facc15'}}>+3 نقاط</span>
                        </label>
                        <input type="text" value={form.firstScorer}
                          onChange={e=>setForm(match.fixture.id,{firstScorer:e.target.value})}
                          className="fifa-field-input" placeholder="مثال: مبابي"/>
                      </div>

                      {/* extra time */}
                      <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:52,background:'var(--fifa-surface-3)',border:'1px solid var(--fifa-line)',padding:'14px 16px',borderRadius:18,cursor:'pointer'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <input type="checkbox" checked={form.extraTime}
                            onChange={e=>setForm(match.fixture.id,{extraTime:e.target.checked})}
                            style={{width:18,height:18,accentColor:'var(--fifa-red)',flexShrink:0}}/>
                          <span style={{fontSize:13}}>⏱️ الماتش هيروح لوقت إضافي؟</span>
                        </div>
                        <span style={{fontSize:11,color:'#facc15',fontWeight:700,flexShrink:0}}>+2 نقاط</span>
                      </label>

                      {/* surprise question */}
                      {match.surprise_question && (
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:8,color:'#c084fc'}}>
                            🎯 {match.surprise_question} <span style={{color:'#d8b4fe'}}>+5 نقاط</span>
                          </label>
                          <input type="text" value={form.surpriseAnswer}
                            onChange={e=>setForm(match.fixture.id,{surpriseAnswer:e.target.value})}
                            className="fifa-field-input"
                            style={{borderColor:'rgba(192,132,252,.25)'}}
                            placeholder="إجابتك..."/>
                        </div>
                      )}

                      {/* message */}
                      {msg && (
                        <div className={msg.includes('✅')?'fifa-msg-success':'fifa-msg-error'}>
                          {msg}
                        </div>
                      )}

                      {/* submit */}
                      <button
                        className="fifa-btn fifa-btn-gold"
                        disabled={submitting===match.fixture.id}
                        style={{width:'100%',minHeight:54,fontSize:16,fontWeight:900,borderRadius:18,opacity:submitting===match.fixture.id?.7:1}}
                        onClick={()=>submitPrediction(match)}>
                        {submitting===match.fixture.id ? '⏳ جاري الحفظ...' : existing ? '💾 تحديث التوقع' : '⚽ حفظ التوقع'}
                      </button>
                    </div>
                  )}

                  {/* closed with saved prediction */}
                  {!match.is_open && !hasResult && existing && (
                    <div style={{background:'var(--fifa-surface-3)',border:'1px solid var(--fifa-line)',borderRadius:16,padding:'12px 16px'}}>
                      <p style={{fontSize:11,color:'var(--fifa-muted)',margin:'0 0 6px',fontWeight:600}}>توقعك المسجّل</p>
                      <p style={{fontSize:22,fontWeight:900,margin:'0 0 4px'}}>{existing.predicted_home_score} — {existing.predicted_away_score}</p>
                      {existing.predicted_first_scorer && (
                        <p style={{fontSize:11,color:'#facc15',margin:0}}>⚽ {existing.predicted_first_scorer}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {/* ════════════ MY PREDICTIONS TAB ════════════ */}
        {activeTab==='my' && (
          <section style={{display:'flex',flexDirection:'column',gap:10}}>
            <div className="fifa-panel" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px'}}>
              <h2 style={{fontSize:18,fontWeight:900,margin:0}}>توقعاتي</h2>
              <div style={{background:'rgba(217,178,95,.10)',border:'1px solid rgba(217,178,95,.22)',color:'var(--fifa-gold)',fontWeight:900,padding:'8px 16px',borderRadius:999,fontSize:14}}>
                🏆 {myPoints} نقطة
              </div>
            </div>

            {predictions.length===0 ? (
              <div className="fifa-panel" style={{padding:'60px 20px',textAlign:'center',color:'var(--fifa-muted)'}}>
                لم تقدم أي توقعات بعد
              </div>
            ) : predictions.map(p=>{
              const hasResult = p.actual_home_score!==null;
              return (
                <div key={p.id} className="fifa-card" style={hasResult&&p.points>=10?{borderColor:'rgba(217,178,95,.25)',background:'linear-gradient(90deg,rgba(217,178,95,.07),rgba(255,255,255,.015))'}:{}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
                      <p style={{fontSize:14,fontWeight:800,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.home_team} × {p.away_team}</p>
                      <p style={{fontSize:12,color:'var(--fifa-muted)',margin:0}}>
                        توقعك: <strong style={{color:'var(--fifa-text)'}}>{p.predicted_home_score} — {p.predicted_away_score}</strong>
                        {p.predicted_first_scorer && <span style={{color:'#facc15',marginRight:8}}> ⚽ {p.predicted_first_scorer}</span>}
                      </p>
                      {hasResult && (
                        <p style={{fontSize:12,color:'var(--fifa-muted)',margin:0}}>
                          الفعلية: <strong style={{color:'#5effa8'}}>{p.actual_home_score} — {p.actual_away_score}</strong>
                        </p>
                      )}
                    </div>
                    <span style={{
                      flexShrink:0,fontWeight:900,fontSize:18,padding:'6px 14px',borderRadius:14,
                      background: !hasResult?'var(--fifa-surface-3)':p.points>=10?'rgba(217,178,95,.12)':p.points>=5?'rgba(39,176,110,.12)':'var(--fifa-surface-3)',
                      color: !hasResult?'var(--fifa-muted)':p.points>=10?'#ffe3a6':p.points>=5?'#5effa8':'var(--fifa-muted)',
                    }}>
                      {hasResult?`${p.points||0}`:'⏳'}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ════════════ LEADERBOARD TAB ════════════ */}
        {activeTab==='leaders' && (
          <section style={{display:'flex',flexDirection:'column',gap:8}}>
            <div className="fifa-panel" style={{padding:'16px 20px'}}>
              <h2 style={{fontSize:18,fontWeight:900,margin:0}}>🏆 ترتيب المتسابقين</h2>
            </div>

            {leaderboard.length===0 ? (
              <div className="fifa-panel" style={{padding:'60px 20px',textAlign:'center',color:'var(--fifa-muted)'}}>لا توجد نتائج بعد</div>
            ) : leaderboard.map((player:any,i)=>{
              const isMe = player.user_id===user?.id;
              return (
                <div key={player.user_id} className="fifa-card"
                  style={isMe
                    ? {borderColor:'rgba(201,58,47,.4)',background:'linear-gradient(90deg,rgba(201,58,47,.08),rgba(255,255,255,.015))'}
                    : i<3
                      ? {borderColor:'rgba(217,178,95,.2)',background:'linear-gradient(90deg,rgba(217,178,95,.05),rgba(255,255,255,.01))'}
                      : {}}>
                  <div style={{display:'grid',gridTemplateColumns:'40px 1fr auto',alignItems:'center',gap:12}}>
                    <div style={{width:40,height:40,borderRadius:12,background:'rgba(217,178,95,.08)',border:'1px solid rgba(217,178,95,.12)',display:'grid',placeItems:'center',fontSize:i<3?20:13,fontWeight:900,color:'var(--fifa-muted)'}}>
                      {i<3?medals[i]:`#${i+1}`}
                    </div>
                    <div>
                      <p style={{fontSize:14,fontWeight:800,margin:0,color:isMe?'#ff9c91':'var(--fifa-text)'}}>
                        {player.user_email?.split('@')[0]}
                        {isMe&&<span style={{fontSize:11,color:'rgba(201,58,47,.7)',marginRight:6}}>(أنت)</span>}
                      </p>
                      <p style={{fontSize:11,color:'var(--fifa-muted)',margin:'2px 0 0'}}>{player.count} توقع</p>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <strong style={{display:'block',fontSize:24,fontWeight:900,color:i===0?'var(--fifa-gold)':i===1?'#d1d5db':i===2?'#b45309':'var(--fifa-text)'}}>
                        {player.totalPoints}
                      </strong>
                      <span style={{fontSize:11,color:'var(--fifa-muted)'}}>نقطة</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

      </div>
    </main>
  );
}
