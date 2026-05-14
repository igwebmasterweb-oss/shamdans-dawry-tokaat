'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotifications, sendNotification, getNotificationText } from '../../lib/useNotifications';

export default function MyLeaguesPage() {
  const [user, setUser]       = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success'|'error'>('success');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [shareLeague, setShareLeague] = useState<any>(null);
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
      .from('mini_leagues').select('*').in('id', leagueIds);
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
      setNewLeagueName('');
      setShowCreate(false);
      showMsg(`✅ تم إنشاء "${lg.name}" — كود: ${lg.code}`);
      await loadData(user.id);
    } catch (err: any) {
      showMsg('❌ ' + (err.message || 'خطأ في الإنشاء'), 'error');
    }
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
    } catch (err: any) {
      showMsg('❌ ' + err.message, 'error');
    }
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

  // ── مشاركة الليج ─────────────────────────────────────────────
  const getLeagueShareText = (lg: any) => `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\nالكود: ${lg.code}\nسجّل من هنا: https://worldcup.shamaadan.com/login`;
  const shareLeagueWhatsApp = (lg: any) => { window.open(`https://wa.me/?text=${encodeURIComponent(getLeagueShareText(lg))}`, '_blank'); };
  const shareLeagueFacebook = (lg: any) => {
    const url = encodeURIComponent('https://worldcup.shamaadan.com/login');
    const quote = encodeURIComponent(`🏆 انضم لليج "${lg.name}" في الشمعدان! الكود: ${lg.code}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank', 'width=600,height=400');
  };
  const shareLeagueMessenger = (lg: any) => {
    const url = encodeURIComponent('https://worldcup.shamaadan.com/login');
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=1302682795390354&redirect_uri=${url}`, '_blank');
  };
  const openShareModal = (lg: any) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: `ليج ${lg.name}`, text: getLeagueShareText(lg), url: 'https://worldcup.shamaadan.com/login' });
    } else {
      setShareLeague(lg);
    }
  };

  // ── تسجيل خروج ─────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const medals = ['🥇','🥈','🥉'];
  const ownedLeagues = leagues.filter(l => l.role === 'owner').length;

  return (
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
    <div dir="rtl" style={{minHeight:'100vh',background:'radial-gradient(ellipse 80% 50% at 50% 30%,hsla(45,50%,20%,.15),var(--bg))',color:'var(--text)',fontFamily:'"Cairo",sans-serif',overflow:'hidden',userSelect:'none'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',maxWidth:1100,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <button onClick={handleLogout} className="nav-pill danger">خروج</button>
          <Link href="/dashboard" className="nav-pill">⚽ توقعاتي</Link>
          <Link href="/leaderboard" className="nav-pill">🏁 الصدارة</Link>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>setShowNotif(!showNotif)} className="nav-pill gold" style={{position:'relative'}}>
            🔔 الإشعارات
            {unreadCount > 0 && <span style={{position:'absolute',top:-6,right:-6,background:'var(--gold)',color:'#211708',fontSize:10,fontWeight:800,padding:'1px 5px',borderRadius:999,minWidth:15,textAlign:'center'}}>{unreadCount}</span>}
          </button>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:16,fontWeight:800,background:'linear-gradient(135deg,#f7d880,#b9892d)',backgroundClip:'text',color:'transparent'}}>ليجاتي 🏆</div>
            <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>الشمعدان × كأس العالم 2026</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {showNotif && (
        <div style={{maxWidth:400,margin:'0 auto',padding:16}} className="slide-down">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:800}}>الإشعارات {unreadCount > 0 && <button onClick={markAllRead} style={{fontSize:11,color:'var(--gold)',background:'none',border:'none',cursor:'pointer'}}>قراءة الكل</button>}</div>
          </div>
          {notifications.length === 0 ? (
            <div style={{fontSize:13,color:'var(--muted)',textAlign:'center',padding:20}}>لا توجد إشعارات</div>
          ) : notifications.map(n => (
            <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={()=>{if(!n.is_read)markRead(n.id)}}>
              <div style={{fontSize:14,fontWeight:700}}>{getNotificationText(n)}</div>
              {n.type === 'invite' && !n.is_read && (
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={(e)=>{e.stopPropagation();respondToInvite(n,true)}} style={{fontSize:12,background:'rgba(201,58,47,.2)',border:'none',color:'#ff9c91',padding:'4px 12px',borderRadius:8,cursor:'pointer'}}>✅ قبول</button>
                  <button onClick={(e)=>{e.stopPropagation();respondToInvite(n,false)}} style={{fontSize:12,background:'rgba(201,58,47,.1)',border:'1px solid rgba(201,58,47,.2)',color:'var(--muted)',padding:'4px 12px',borderRadius:8,cursor:'pointer'}}>❌ رفض</button>
                </div>
              )}
              <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>{new Date(n.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          ))}
        </div>
      )}
