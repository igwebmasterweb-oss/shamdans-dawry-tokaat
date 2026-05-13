'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotifications, sendNotification, getNotificationText } from '../../lib/useNotifications';

export default function MyLeaguesPage() {
  const [user, setUser]               = useState<any>(null);
  const [userName, setUserName]       = useState('');
  const [leagues, setLeagues]         = useState<any[]>([]);
  const [allUsers, setAllUsers]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showNotif, setShowNotif]     = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [creating, setCreating]       = useState(false);
  const [message, setMessage]         = useState('');
  const [msgType, setMsgType]         = useState<'success'|'error'>('success');
  const [copyFeedback, setCopyFeedback] = useState('');
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const showMsg = (msg: string, type: 'success'|'error' = 'success') => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadData = useCallback(async (uid: string) => {
    const { data: memberRows } = await supabase
      .from('mini_league_members').select('league_id, role').eq('user_id', uid);
    if (!memberRows || memberRows.length === 0) { setLeagues([]); setLoading(false); return; }
    const leagueIds = memberRows.map((r: any) => r.league_id);
    const roleMap = new Map(memberRows.map((r: any) => [r.league_id, r.role]));
    const { data: leagueRows } = await supabase
      .from('mini_leagues').select('*').in('id', leagueIds).eq('is_active', true);
    const enriched = await Promise.all((leagueRows || []).map(async (lg: any) => {
      const { data: members } = await supabase
        .from('mini_league_standings').select('*').eq('league_id', lg.id).order('rank', { ascending: true });
      const myRank = members?.find((m: any) => m.user_id === uid)?.rank ?? '—';
      return { ...lg, role: roleMap.get(lg.id), memberCount: members?.length || 0, myRank, members: members || [] };
    }));
    setLeagues(enriched);
    setLoading(false);
  }, []);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_points').select('user_id, full_name, user_email').order('full_name', { ascending: true });
    setAllUsers(data || []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      const { data: up } = await supabase.from('user_points').select('full_name,user_email').eq('user_id', data.user.id).maybeSingle();
      setUserName(up?.full_name || up?.user_email?.split('@')[0] || 'مجهول');
      await loadData(data.user.id);
      await loadAllUsers();
    });
  }, [router, loadData, loadAllUsers]);

  // ── إنشاء ليج ──────────────────────────────────────────────
  const createLeague = async () => {
    if (!newLeagueName.trim() || !user) return;
    const ownedCount = leagues.filter(l => l.role === 'owner').length;
    if (ownedCount >= 5) { showMsg('وصلت للحد الأقصى (5 ليجات كمنشئ)', 'error'); return; }
    setCreating(true);
    try {
      const { data: codeRow } = await supabase.rpc('generate_league_code');
      const code = codeRow as string;
      const { data: lg, error } = await supabase
        .from('mini_leagues').insert({ name: newLeagueName.trim(), code, created_by: user.id }).select().single();
      if (error) throw error;
      await supabase.from('mini_league_members').insert({ league_id: lg.id, user_id: user.id, role: 'owner' });
      setNewLeagueName(''); setShowCreate(false);
      showMsg(`✅ تم إنشاء "${lg.name}" — كود: ${lg.code}`);
      await loadData(user.id);
    } catch (err: any) { showMsg('❌ ' + (err.message || 'خطأ في الإنشاء'), 'error'); }
    setCreating(false);
  };

  // ── الرد على دعوة ──────────────────────────────────────────
  const respondToInvite = async (notif: any, accept: boolean) => {
    const { league_id, league_name, from_user_id } = notif.data;
    try {
      await supabase.from('mini_league_invitations')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('league_id', league_id).eq('invited_user', user.id);
      if (accept) {
        await supabase.from('mini_league_members').insert({ league_id, user_id: user.id, role: 'member' });
        await sendNotification(from_user_id, 'invite_accepted', { league_id, league_name, invited_user_name: userName });
        showMsg(`✅ انضممت لـ "${league_name}"`);
        await loadData(user.id);
      } else {
        await sendNotification(from_user_id, 'invite_declined', { league_id, league_name, invited_user_name: userName });
        showMsg('تم رفض الدعوة');
      }
      await markRead(notif.id);
    } catch (err: any) { showMsg('❌ ' + err.message, 'error'); }
  };

  // ── مغادرة الليج ───────────────────────────────────────────
  const leaveLeague = async (lg: any) => {
    if (!confirm(`هل تريد مغادرة "${lg.name}"؟`)) return;
    await supabase.from('mini_league_members').delete().eq('league_id', lg.id).eq('user_id', user.id);
    showMsg(`غادرت "${lg.name}"`);
    await loadData(user.id);
  };

  // ── نسخ كود + رسالة واتساب ─────────────────────────────────
  const copyCode = (lg: any) => {
    const txt = `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\nالكود: ${lg.code}\nافتح التطبيق وروح ليجاتي ← إدخال الكود`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopyFeedback(lg.id);
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  };

  // ── تسجيل خروج ─────────────────────────────────────────────
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const medals = ['🥇','🥈','🥉'];
  const ownedLeagues = leagues.filter(l => l.role === 'owner').length;

  return (
    <div style={{ minHeight:'100vh', background:`radial-gradient(circle at top left,rgba(217,178,95,.12),transparent 28%),radial-gradient(circle at bottom right,rgba(201,58,47,.10),transparent 26%),#070809`, color:'#f4f1e8', fontFamily:"'Cairo',sans-serif", direction:'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root { --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125; --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a; --gold:#d9b25f; --red:#c93a2f; --green:#27b06e; }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rowIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .slide-down { animation:slideDown .25s ease forwards; }
        .row-in { animation:rowIn .35s cubic-bezier(.16,1,.3,1) forwards; opacity:0; }
        .nav-pill { padding:9px 20px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); font-weight:700; text-decoration:none; font-size:13px; font-family:'Cairo',sans-serif; transition:all .2s; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
        .nav-pill:hover { border-color:rgba(217,178,95,.25); color:#f2d79e; }
        .nav-pill.gold { background:linear-gradient(135deg,#e0bc73,#b9892d); color:#211708; border:none; box-shadow:0 4px 14px rgba(217,178,95,.25); }
        .nav-pill.danger { border-color:rgba(201,58,47,.25); color:#ff9c91; }
        .nav-pill.danger:hover { background:rgba(201,58,47,.1); }
        .card { background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01)); border:1px solid var(--line); border-radius:20px; padding:20px; transition:border-color .2s; }
        .card:hover { border-color:rgba(217,178,95,.2); }
        .action-btn { padding:9px 18px; border-radius:12px; border:none; color:#fff; cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:opacity .18s; }
        .action-btn:hover { opacity:.85; }
        .field-input { width:100%; padding:12px 16px; border-radius:14px; background:var(--surface-3); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:15px; outline:none; transition:border-color .2s; }
        .field-input:focus { border-color:rgba(217,178,95,.4); }
        .notif-item { padding:14px 16px; border-radius:14px; background:rgba(255,255,255,.025); border:1px solid var(--line); margin-bottom:8px; }
        .notif-item.unread { background:rgba(217,178,95,.06); border-color:rgba(217,178,95,.18); }
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{ background:'linear-gradient(180deg,rgba(217,178,95,.06),transparent),#111315', borderBottom:'1px solid var(--line)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:20, boxShadow:'0 4px 16px rgba(217,178,95,.25)', flexShrink:0 }}>🏆</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>ليجاتي</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>الشمعدان × كأس العالم 2026</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>

          {/* Notifications */}
          <div style={{ position:'relative' }}>
            <button className="nav-pill" onClick={()=>setShowNotif(!showNotif)}>
              🔔 الإشعارات
              {unreadCount > 0 && <span style={{ background:'var(--red)', color:'#fff', borderRadius:999, padding:'1px 7px', fontSize:11, fontWeight:800 }}>{unreadCount}</span>}
            </button>
            {showNotif && (
              <div className="slide-down" style={{ position:'absolute', top:'calc(100% + 10px)', left:0, width:340, background:'#1c1f23', border:'1px solid var(--line)', borderRadius:18, padding:16, zIndex:200, maxHeight:420, overflowY:'auto', boxShadow:'0 16px 40px rgba(0,0,0,.4)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontWeight:800, fontSize:14 }}>الإشعارات</span>
                  {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize:11, color:'var(--gold)', background:'none', border:'none', cursor:'pointer', fontFamily:"'Cairo',sans-serif", fontWeight:700 }}>قراءة الكل</button>}
                </div>
                {notifications.length === 0
                  ? <div style={{ textAlign:'center', padding:'30px 0', color:'var(--muted)', fontSize:13 }}>لا توجد إشعارات</div>
                  : notifications.map(n => (
                    <div key={n.id} className={`notif-item${!n.is_read?' unread':''}`} onClick={()=>!n.is_read&&markRead(n.id)}>
                      <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.5, marginBottom:n.type==='invite'&&!n.is_read?10:0 }}>{getNotificationText(n)}</p>
                      {n.type === 'invite' && !n.is_read && (
                        <div style={{ display:'flex', gap:8, marginTop:8 }}>
                          <button className="action-btn" style={{ background:'var(--green)', flex:1, padding:'8px 0' }} onClick={e=>{e.stopPropagation();respondToInvite(n,true)}}>✅ قبول</button>
                          <button className="action-btn" style={{ background:'rgba(201,58,47,.6)', flex:1, padding:'8px 0' }} onClick={e=>{e.stopPropagation();respondToInvite(n,false)}}>❌ رفض</button>
                        </div>
                      )}
                      <p style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>{new Date(n.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <Link href="/dashboard" className="nav-pill">⚽ توقعاتي</Link>
          <Link href="/leaderboard" className="nav-pill">🏁 الصدارة</Link>
          <button onClick={handleLogout} className="nav-pill danger">خروج</button>
        </div>
      </header>

      {/* MESSAGE */}
      {message && (
        <div className="slide-down" style={{ margin:'12px 24px', padding:'12px 18px', borderRadius:14, background:msgType==='success'?'rgba(39,176,110,.12)':'rgba(201,58,47,.12)', border:`1px solid ${msgType==='success'?'rgba(39,176,110,.28)':'rgba(201,58,47,.28)'}`, color:msgType==='success'?'#5effa8':'#ff9c91', fontWeight:700, fontSize:14 }}>
          {message}
        </div>
      )}

      <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 20px 60px' }}>

        {/* Page header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:'clamp(1.5rem,4vw,2.2rem)', fontWeight:800, margin:0 }}>🏆 ليجاتي</h1>
            <p style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
              {leagues.length} ليج · منشئ {ownedLeagues}/5
            </p>
          </div>
          {ownedLeagues < 5 && (
            <button className="nav-pill gold" onClick={()=>setShowCreate(!showCreate)}>
              {showCreate ? '✕ إلغاء' : '+ إنشاء ليج جديد'}
            </button>
          )}
        </div>

        {/* Create League Form */}
        {showCreate && (
          <div className="card slide-down" style={{ marginBottom:20 }}>
            <h3 style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>إنشاء ليج جديد</h3>
            <div style={{ display:'flex', gap:10 }}>
              <input className="field-input" placeholder="اسم الليج (مثال: ليج الشغل)" value={newLeagueName} onChange={e=>setNewLeagueName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createLeague()} style={{ flex:1 }} />
              <button className="action-btn" style={{ background:'linear-gradient(135deg,#e0bc73,#b9892d)', color:'#211708', padding:'0 24px' }} onClick={createLeague} disabled={creating||!newLeagueName.trim()}>
                {creating ? '⏳' : 'إنشاء'}
              </button>
            </div>
            <p style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>سيتم توليد كود تلقائياً — تقدر تدعو اللاعبين من صفحة الإدارة</p>
          </div>
        )}

        {/* Leagues List */}
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[1,2,3].map(i => <div key={i} style={{ height:96, borderRadius:20, background:'rgba(255,255,255,.03)' }} />)}
          </div>
        ) : leagues.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🏆</div>
            <p style={{ fontSize:15, color:'var(--muted)', marginBottom:20 }}>مفيش ليجات لسه — ابدأ الأول!</p>
            <button className="nav-pill gold" onClick={()=>setShowCreate(true)}>+ إنشاء ليج جديد</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {leagues.map((lg, i) => (
              <div key={lg.id} className="card row-in" style={{ animationDelay:`${i*.07}s`, borderColor:lg.role==='owner'?'rgba(217,178,95,.22)':'var(--line)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>

                  <div style={{ width:50, height:50, borderRadius:16, background:lg.role==='owner'?'linear-gradient(135deg,#f0cf84,#a97b26)':'rgba(217,178,95,.12)', border:'1px solid rgba(217,178,95,.2)', display:'grid', placeItems:'center', fontSize:22, flexShrink:0 }}>
                    {lg.role==='owner'?'👑':'🏆'}
                  </div>

                  <div style={{ flex:1, minWidth:150 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, fontSize:16 }}>{lg.name}</span>
                      {lg.role==='owner' && <span style={{ fontSize:10, padding:'2px 10px', borderRadius:999, background:'rgba(217,178,95,.14)', color:'var(--gold)', border:'1px solid rgba(217,178,95,.25)', fontWeight:700 }}>منشئ</span>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:4, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <span>🔑 {lg.code}</span>
                      <span>👥 {lg.memberCount}/25</span>
                      <span style={{ color:lg.myRank<=3?'var(--gold)':'var(--muted)' }}>
                        {lg.myRank<=3&&medals[lg.myRank-1]} أنت #{lg.myRank}
                      </span>
                      <span style={{ color:'rgba(255,255,255,.3)', fontSize:10 }}>
                        {new Date(lg.created_at).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                    {/* Share / Copy */}
                    <button onClick={()=>copyCode(lg)} className="action-btn" style={{ background:copyFeedback===lg.id?'rgba(39,176,110,.2)':'rgba(255,255,255,.06)', border:'1px solid var(--line)', color:copyFeedback===lg.id?'#5effa8':'var(--muted)' }}>
                      {copyFeedback===lg.id ? '✅ تم النسخ' : '📋 مشاركة'}
                    </button>
                    <Link href={`/mini-league/${lg.code}`} className="action-btn" style={{ background:'rgba(217,178,95,.14)', border:'1px solid rgba(217,178,95,.25)', color:'var(--gold)', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                      👁️ الصدارة
                    </Link>
                    {lg.role==='owner'
                      ? <Link href={`/mini-league/${lg.code}/manage`} className="action-btn" style={{ background:'var(--surface-3)', border:'1px solid var(--line)', color:'var(--muted)', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>⚙️ إدارة</Link>
                      : <button onClick={()=>leaveLeague(lg)} className="action-btn" style={{ background:'rgba(201,58,47,.1)', border:'1px solid rgba(201,58,47,.2)', color:'#ff9c91' }}>🚪 مغادرة</button>
                    }
                  </div>
                </div>

                {/* Mini standings preview */}
                {lg.members.length > 0 && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    {lg.members.slice(0,3).map((m: any) => (
                      <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.025)', borderRadius:12, padding:'7px 12px', fontSize:12 }}>
                        <span>{medals[m.rank-1] || `#${m.rank}`}</span>
                        <span style={{ fontWeight:700 }}>{m.full_name || m.user_email?.split('@')[0]}</span>
                        <span style={{ color:'var(--gold)', fontWeight:800 }}>{m.total_points||0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
