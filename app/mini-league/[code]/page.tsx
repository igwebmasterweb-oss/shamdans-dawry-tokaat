'use client';
import { supabase } from '../../../lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function MiniLeaguePage() {
  const [user, setUser]         = useState<any>(null);
  const [league, setLeague]     = useState<any>(null);
  const [members, setMembers]   = useState<any[]>([]);
  const [myRole, setMyRole]     = useState<'owner'|'member'|null>(null);
  const [loading, setLoading]   = useState(true);
  const [animated, setAnimated] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const channelRef = useRef<any>(null);
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const loadLeague = useCallback(async (uid: string) => {
    const { data: lg } = await supabase
      .from('mini_leagues').select('*').eq('code', code).maybeSingle();
    if (!lg) { router.push('/my-leagues'); return; }
    setLeague(lg);
    const { data: mem } = await supabase
      .from('mini_league_members').select('role').eq('league_id', lg.id).eq('user_id', uid).maybeSingle();
    if (!mem) { router.push('/my-leagues'); return; }
    setMyRole(mem.role as 'owner'|'member');
    const { data: standings } = await supabase
      .from('mini_league_standings').select('*').eq('league_id', lg.id).order('rank', { ascending: true });
    setMembers(standings || []);
    setLoading(false);
    setTimeout(() => setAnimated(true), 100);
    return lg;
  }, [code, router]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      const lg = await loadLeague(data.user.id);
      if (!lg) return;

      // ── Realtime: تحديث الصدارة تلقائياً ──────────────────
      channelRef.current = supabase
        .channel(`league-${lg.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mini_league_members', filter: `league_id=eq.${lg.id}` },
          async () => {
            const { data: standings } = await supabase
              .from('mini_league_standings').select('*').eq('league_id', lg.id).order('rank', { ascending: true });
            setMembers(standings || []);
          }
        )
        // ✅ FIX 3: نستمع لتغيير نقاط الأعضاء برضه
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_points' },
          async () => {
            const { data: standings } = await supabase
              .from('mini_league_standings').select('*').eq('league_id', lg.id).order('rank', { ascending: true });
            setMembers(standings || []);
          }
        )
        .subscribe();
    });
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [router, loadLeague]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const copyCode = () => {
    if (!league) return;
    const txt = `🏆 انضم لليج "${league.name}" في الشمعدان × كأس العالم 2026!\n` +
      `سجّل دخولك عن طريق الرابط ده وهتنضم تلقائياً ⬇️\n` +
      `https://worldcup.shamaadan.com/login?league=${league.code}`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const medals = ['🥇','🥈','🥉'];
  const maxPts = members.length > 0 ? Math.max(...members.map(m => m.total_points || 0), 1) : 1;

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#070809', color:'#f4f1e8', fontFamily:"'Cairo',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:30, margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(217,178,95,.25)' }}>🏆</div>
        <p style={{ color:'#a8a39a' }}>جاري التحميل...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:`radial-gradient(circle at top left,rgba(217,178,95,.10),transparent 28%),#070809`, color:'#f4f1e8', fontFamily:"'Cairo',sans-serif", direction:'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root { --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125; --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a; --gold:#d9b25f; }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes rowIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes barGrow { from{width:0%!important} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .player-row { opacity:0; animation:rowIn .4s cubic-bezier(.16,1,.3,1) forwards; }
        .bar-fill { animation:barGrow 1s cubic-bezier(.16,1,.3,1) forwards; }
        .top-float { animation:float 3.5s ease-in-out infinite; }
        .nav-pill { padding:9px 20px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); font-weight:700; text-decoration:none; font-size:13px; font-family:'Cairo',sans-serif; transition:all .2s; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
        .nav-pill:hover { border-color:rgba(217,178,95,.25); color:#f2d79e; }
        .nav-pill.gold { background:linear-gradient(135deg,#e0bc73,#b9892d); color:#211708; border:none; }
        .nav-pill.danger { border-color:rgba(201,58,47,.25); color:#ff9c91; }
        .nav-pill.danger:hover { background:rgba(201,58,47,.1); }
        .realtime-dot { width:7px; height:7px; border-radius:50%; background:#27b06e; box-shadow:0 0 6px #27b06e; animation:pulse 2s ease-in-out infinite; display:inline-block; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'linear-gradient(180deg,rgba(217,178,95,.06),transparent),#111315', borderBottom:'1px solid var(--line)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:20, boxShadow:'0 4px 16px rgba(217,178,95,.25)' }}>🏆</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, display:'flex', alignItems:'center', gap:8 }}>
              {league?.name}
              <span className="realtime-dot" title="مباشر" />
            </div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>🔑 {league?.code} · {members.length}/25 عضو · {new Date(league?.created_at).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={copyCode} className="nav-pill" style={{ borderColor:copyFeedback?'rgba(39,176,110,.3)':'', color:copyFeedback?'#5effa8':'' }}>
            {copyFeedback ? '✅ تم النسخ' : '📋 مشاركة'}
          </button>
          {myRole==='owner' && <Link href={`/mini-league/${code}/manage`} className="nav-pill gold">⚙️ إدارة الليج</Link>}
          <Link href="/my-leagues" className="nav-pill">← ليجاتي</Link>
          <button onClick={handleLogout} className="nav-pill danger">خروج</button>
        </div>
      </header>

      {/* PODIUM */}
      {members.length >= 3 && (
        <div style={{ maxWidth:680, margin:'40px auto 0', padding:'0 20px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:14 }}>
            {[1,0,2].map(rank => {
              const m = members[rank];
              const isFirst = rank===0;
              const heights: Record<number,number> = {0:190, 1:150, 2:120};
              const podiumColors = [
                { bg:'rgba(217,178,95,.9)', glow:'rgba(217,178,95,.35)', text:'#211708' },
                { bg:'rgba(180,180,190,.7)', glow:'rgba(200,200,210,.25)', text:'#111' },
                { bg:'rgba(180,120,60,.7)',  glow:'rgba(180,120,60,.25)',  text:'#f4f1e8' },
              ];
              const col = podiumColors[rank];
              const name = m.full_name || m.user_email?.split('@')[0] || '?';
              return (
                <div key={m.user_id} className={isFirst?'top-float':''} style={{ flex:1, maxWidth:200, display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:isFirst?70:54, height:isFirst?70:54, borderRadius:'50%', background:col.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isFirst?20:16, fontWeight:800, color:col.text, boxShadow:`0 0 ${isFirst?28:14}px ${col.glow}`, marginBottom:8 }}>
                    {name.slice(0,2)}
                  </div>
                  <div style={{ fontWeight:800, fontSize:isFirst?15:13, textAlign:'center', marginBottom:4, maxWidth:'90%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                  <div style={{ fontSize:isFirst?20:16, fontWeight:800, color:'var(--gold)', marginBottom:10, fontVariantNumeric:'tabular-nums' }}>
                    {m.total_points||0} <span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}>نقطة</span>
                  </div>
                  <div style={{ width:'100%', height:heights[rank], background:`linear-gradient(180deg,${col.bg}22,${col.bg}0a)`, border:`1px solid ${col.bg}44`, borderBottom:'none', borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>
                    {medals[rank]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height:5, background:'linear-gradient(90deg,transparent,var(--gold),rgba(217,178,95,.4),var(--gold),transparent)', borderRadius:3 }} />
        </div>
      )}

      {/* FULL LIST */}
      <div style={{ maxWidth:800, margin:'40px auto 60px', padding:'0 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ height:1, flex:1, background:'var(--line)' }} />
          <span style={{ fontSize:11, color:'var(--muted)', letterSpacing:'.15em', textTransform:'uppercase', fontWeight:700 }}>الترتيب الكامل</span>
          <div style={{ height:1, flex:1, background:'var(--line)' }} />
        </div>
        {members.map((m, index) => {
          const isMe = m.user_id === user?.id;
          const pct = maxPts > 0 ? ((m.total_points||0) / maxPts) * 100 : 0;
          const name = m.full_name || m.user_email?.split('@')[0] || '?';
          return (
            <div key={m.user_id} className="player-row" style={{ animationDelay:`${index*.06}s`, marginBottom:10, background:isMe?'linear-gradient(90deg,rgba(217,178,95,.10),rgba(255,255,255,.02))':'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))', border:isMe?'1px solid rgba(217,178,95,.28)':'1px solid var(--line)', borderRadius:20, padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ minWidth:38, textAlign:'center', fontWeight:900, fontSize:index<3?22:15, color:index<3?'var(--gold)':'var(--muted)', fontVariantNumeric:'tabular-nums' }}>
                  {index<3?medals[index]:`#${index+1}`}
                </div>
                <div style={{ width:42, height:42, borderRadius:'50%', flexShrink:0, background:index===0?'linear-gradient(135deg,#f0cf84,#a97b26)':'linear-gradient(135deg,rgba(217,178,95,.3),rgba(217,178,95,.1))', border:'1px solid rgba(217,178,95,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, color:index===0?'#211708':'var(--gold)' }}>
                  {name.slice(0,2)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:14 }}>{name}</span>
                    {isMe && <span style={{ fontSize:10, padding:'2px 10px', borderRadius:999, background:'rgba(217,178,95,.14)', color:'var(--gold)', fontWeight:700, border:'1px solid rgba(217,178,95,.25)' }}>أنت</span>}
                    {m.role==='owner' && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:'rgba(255,255,255,.06)', color:'var(--muted)', border:'1px solid var(--line)' }}>👑</span>}
                    <span style={{ fontSize:11, color:'var(--muted)', marginRight:'auto' }}>{m.predictions_count||0} توقع</span>
                  </div>
                  <div style={{ height:7, borderRadius:999, background:'rgba(255,255,255,.05)', overflow:'hidden' }}>
                    <div className={animated?'bar-fill':''} style={{ height:'100%', width:animated?`${Math.max(pct,2)}%`:'0%', background:index===0?'linear-gradient(90deg,#f0cf84,#d9b25f)':'linear-gradient(90deg,rgba(217,178,95,.7),rgba(217,178,95,.3))', borderRadius:999, boxShadow:index===0?'0 0 8px rgba(217,178,95,.4)':'none', animationDelay:`${index*.06}s` }} />
                  </div>
                </div>
                <div style={{ minWidth:58, textAlign:'center', background:index<3?'rgba(217,178,95,.1)':'var(--surface-2)', border:index<3?'1px solid rgba(217,178,95,.2)':'1px solid var(--line)', borderRadius:14, padding:'8px 12px' }}>
                  <div style={{ fontSize:20, fontWeight:800, color:index<3?'var(--gold)':'var(--text)', fontVariantNumeric:'tabular-nums' }}>{m.total_points||0}</div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>نقطة</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
