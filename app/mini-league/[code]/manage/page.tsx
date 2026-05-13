'use client';
import { supabase } from '../../../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { sendNotification } from '../../../../lib/useNotifications';

export default function ManageLeaguePage() {
  const [user, setUser]         = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [league, setLeague]     = useState<any>(null);
  const [members, setMembers]   = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [message, setMessage]   = useState('');
  const [msgType, setMsgType]   = useState<'success'|'error'>('success');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviting, setInviting] = useState('');
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const showMsg = (msg: string, type: 'success'|'error' = 'success') => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadAll = useCallback(async (uid: string) => {
    const { data: lg } = await supabase
      .from('mini_leagues').select('*').eq('code', code).maybeSingle();
    if (!lg || lg.created_by !== uid) { router.push('/my-leagues'); return; }
    setLeague(lg);

    const [{ data: mems }, { data: invites }, { data: users }] = await Promise.all([
      supabase.from('mini_league_standings').select('*').eq('league_id', lg.id).order('rank'),
      supabase.from('mini_league_invitations').select('*, invited_user_profile:user_points!invited_user(full_name,user_email)').eq('league_id', lg.id).eq('status', 'pending'),
      supabase.from('user_points').select('user_id, full_name, user_email').order('full_name'),
    ]);

    setMembers(mems || []);
    setPendingInvites(invites || []);
    // استثني الأعضاء الحاليين + الـ pending invitations من قائمة الدعوة
    const memberIds = new Set((mems||[]).map((m: any) => m.user_id));
    const invitedIds = new Set((invites||[]).map((i: any) => i.invited_user));
    setAllUsers((users||[]).filter(u => !memberIds.has(u.user_id) && !invitedIds.has(u.user_id)));
    setLoading(false);
  }, [code, router]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      const { data: up } = await supabase.from('user_points').select('full_name').eq('user_id', data.user.id).maybeSingle();
      setUserName(up?.full_name || '');
      await loadAll(data.user.id);
    });
  }, [router, loadAll]);

  // دعوة يوزر
  const inviteUser = async (target: any) => {
    if (!league || !user) return;
    if (members.length >= 25) { showMsg('الليج وصل الحد الأقصى (25 عضو)', 'error'); return; }
    setInviting(target.user_id);
    try {
      const { error } = await supabase.from('mini_league_invitations').insert({
        league_id: league.id, invited_by: user.id, invited_user: target.user_id,
      });
      if (error) throw error;
      await sendNotification(target.user_id, 'invite', {
        league_id: league.id, league_name: league.name,
        from_user_id: user.id, from_name: userName || 'أحد',
      });
      showMsg(`✅ تم إرسال الدعوة لـ ${target.full_name || target.user_email}`);
      setInviteSearch('');
      await loadAll(user.id);
    } catch (err: any) {
      showMsg('❌ ' + (err.message || 'خطأ'), 'error');
    }
    setInviting('');
  };

  // طرد عضو
  const kickMember = async (memberId: string, memberName: string) => {
    if (!league) return;
    if (!confirm(`هل تريد طرد "${memberName}" من الليج؟`)) return;
    await supabase.from('mini_league_members').delete()
      .eq('league_id', league.id).eq('user_id', memberId);
    await sendNotification(memberId, 'kicked', { league_id: league.id, league_name: league.name });
    showMsg(`تم طرد ${memberName}`);
    await loadAll(user.id);
  };

  // حذف الليج
  const deleteLeague = async () => {
    if (!league) return;
    // إشعار كل الأعضاء
    const otherMembers = members.filter(m => m.user_id !== user?.id);
    await Promise.all(otherMembers.map(m =>
      sendNotification(m.user_id, 'league_deleted', { league_name: league.name })
    ));
    await supabase.from('mini_leagues').update({ is_active: false }).eq('id', league.id);
    router.push('/my-leagues');
  };

  const filteredUsers = allUsers.filter(u => {
    const q = inviteSearch.toLowerCase();
    return (u.full_name||'').toLowerCase().includes(q) || (u.user_email||'').toLowerCase().includes(q);
  });

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#070809', color:'#f4f1e8', fontFamily:"'Cairo',sans-serif" }}>
      <p style={{ color:'#a8a39a' }}>جاري التحميل...</p>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:`radial-gradient(circle at top left,rgba(217,178,95,.10),transparent 28%),#070809`, color:'#f4f1e8', fontFamily:"'Cairo',sans-serif", direction:'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root { --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125; --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a; --gold:#d9b25f; --red:#c93a2f; }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .slide-down { animation:slideDown .25s ease forwards; }
        .card { background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01)); border:1px solid var(--line); border-radius:20px; padding:20px; }
        .action-btn { padding:8px 16px; border-radius:12px; border:none; cursor:pointer; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; transition:opacity .18s; }
        .action-btn:hover { opacity:.82; }
        .field-input { width:100%; padding:11px 16px; border-radius:14px; background:var(--surface-3); border:1px solid var(--line); color:var(--text); font-family:'Cairo',sans-serif; font-size:14px; outline:none; transition:border-color .2s; }
        .field-input:focus { border-color:rgba(217,178,95,.4); }
        .field-input::placeholder { color:var(--muted); }
        .nav-pill { padding:9px 20px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); font-weight:700; text-decoration:none; font-size:13px; font-family:'Cairo',sans-serif; transition:all .2s; }
        .nav-pill:hover { border-color:rgba(217,178,95,.25); color:#f2d79e; }
        .member-row { display:flex; align-items:center; gap:12; padding:12px 16px; border-radius:16px; background:rgba(255,255,255,.025); border:1px solid var(--line); margin-bottom:8px; }
        .user-row { display:flex; align-items:center; gap:12; padding:11px 14px; border-radius:14px; background:rgba(255,255,255,.02); border:1px solid var(--line); margin-bottom:7px; cursor:pointer; transition:border-color .18s; }
        .user-row:hover { border-color:rgba(217,178,95,.2); }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'linear-gradient(180deg,rgba(217,178,95,.06),transparent),#111315', borderBottom:'1px solid var(--line)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#f0cf84,#a97b26)', display:'grid', placeItems:'center', fontSize:20 }}>⚙️</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>إدارة: {league?.name}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>🔑 {league?.code} · {members.length}/25 عضو</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Link href={`/mini-league/${code}`} className="nav-pill">👁️ الصدارة</Link>
          <Link href="/my-leagues" className="nav-pill">← ليجاتي</Link>
        </div>
      </header>

      {/* MESSAGE */}
      {message && (
        <div className="slide-down" style={{ margin:'12px 24px', padding:'12px 18px', borderRadius:14, background:msgType==='success'?'rgba(39,176,110,.12)':'rgba(201,58,47,.12)', border:`1px solid ${msgType==='success'?'rgba(39,176,110,.28)':'rgba(201,58,47,.28)'}`, color:msgType==='success'?'#5effa8':'#ff9c91', fontWeight:700, fontSize:14 }}>
          {message}
        </div>
      )}

      <div style={{ maxWidth:800, margin:'0 auto', padding:'28px 20px 80px', display:'flex', flexDirection:'column', gap:24 }}>

        {/* League Code Card */}
        <div className="card" style={{ borderColor:'rgba(217,178,95,.2)', background:'linear-gradient(135deg,rgba(217,178,95,.07),rgba(255,255,255,.02))' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>كود الليج</p>
              <div style={{ fontSize:32, fontWeight:900, letterSpacing:'.2em', color:'var(--gold)', fontVariantNumeric:'tabular-nums' }}>{league?.code}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>الأعضاء</p>
              <div style={{ fontSize:32, fontWeight:900, color:'var(--text)' }}>{members.length}<span style={{ fontSize:16, color:'var(--muted)', fontWeight:400 }}>/25</span></div>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>دعوات معلقة</p>
              <div style={{ fontSize:32, fontWeight:900, color:'var(--text)' }}>{pendingInvites.length}</div>
            </div>
          </div>
        </div>

        {/* Invite Section */}
        <div className="card">
          <h2 style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>🙋 دعوة لاعبين</h2>
          <input className="field-input" placeholder="ابحث بالاسم أو الإيميل..." value={inviteSearch} onChange={e=>setInviteSearch(e.target.value)} style={{ marginBottom:14 }} />
          <div style={{ maxHeight:280, overflowY:'auto', paddingLeft:2 }}>
            {filteredUsers.length === 0
              ? <p style={{ color:'var(--muted)', fontSize:13, textAlign:'center', padding:'20px 0' }}>{inviteSearch ? 'لا نتائج' : 'كل اللاعبين مدعوون أو أعضاء بالفعل'}</p>
              : filteredUsers.slice(0,20).map(u => (
                <div key={u.user_id} className="user-row" onClick={()=>inviteUser(u)}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,rgba(217,178,95,.3),rgba(217,178,95,.1))', display:'grid', placeItems:'center', fontWeight:800, fontSize:13, color:'var(--gold)', flexShrink:0 }}>
                    {(u.full_name||u.user_email||'?').slice(0,2)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.full_name || '—'}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{u.user_email}</div>
                  </div>
                  {inviting === u.user_id
                    ? <span style={{ fontSize:12, color:'var(--muted)' }}>⏳</span>
                    : <span className="action-btn" style={{ background:'rgba(217,178,95,.14)', color:'var(--gold)', border:'1px solid rgba(217,178,95,.25)', pointerEvents:'none' }}>دعوة →</span>
                  }
                </div>
              ))
            }
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>⏳ دعوات معلقة ({pendingInvites.length})</h2>
            {pendingInvites.map(inv => (
              <div key={inv.id} className="member-row" style={{ borderColor:'rgba(217,178,95,.14)', background:'rgba(217,178,95,.04)' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(217,178,95,.12)', display:'grid', placeItems:'center', fontSize:13, fontWeight:800, color:'var(--gold)' }}>
                  {(inv.invited_user_profile?.full_name||inv.invited_user_profile?.user_email||'?').slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{inv.invited_user_profile?.full_name||'—'}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{inv.invited_user_profile?.user_email}</div>
                </div>
                <span style={{ fontSize:11, padding:'4px 12px', borderRadius:999, background:'rgba(217,178,95,.12)', color:'var(--gold)', border:'1px solid rgba(217,178,95,.22)', fontWeight:700 }}>⏳ منتظر</span>
              </div>
            ))}
          </div>
        )}

        {/* Members */}
        <div className="card">
          <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>👥 الأعضاء ({members.length})</h2>
          {members.map((m, i) => {
            const name = m.full_name || m.user_email?.split('@')[0] || '?';
            const isOwner = m.role === 'owner';
            return (
              <div key={m.user_id} className="member-row">
                <span style={{ minWidth:32, fontWeight:800, color:'var(--muted)', textAlign:'center' }}>#{i+1}</span>
                <div style={{ width:38, height:38, borderRadius:'50%', background:isOwner?'linear-gradient(135deg,#f0cf84,#a97b26)':'rgba(217,178,95,.12)', display:'grid', placeItems:'center', fontWeight:800, fontSize:13, color:isOwner?'#211708':'var(--gold)', flexShrink:0 }}>
                  {name.slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{name}</span>
                    {isOwner && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:'rgba(217,178,95,.14)', color:'var(--gold)', fontWeight:700 }}>👑 منشئ</span>}
                    {m.user_id === user?.id && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:'rgba(255,255,255,.06)', color:'var(--muted)' }}>أنت</span>}
                  </div>
                  <span style={{ fontSize:12, color:'var(--gold)', fontWeight:800 }}>{m.total_points||0} نقطة</span>
                </div>
                {!isOwner && (
                  <button className="action-btn" style={{ background:'rgba(201,58,47,.15)', color:'#ff9c91', border:'1px solid rgba(201,58,47,.25)' }}
                    onClick={()=>kickMember(m.user_id, name)}>
                    طرد
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ borderColor:'rgba(201,58,47,.22)', background:'rgba(201,58,47,.04)' }}>
          <h2 style={{ fontSize:16, fontWeight:800, marginBottom:8, color:'#ff9c91' }}>⚠️ منطقة الخطر</h2>
          <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16 }}>حذف الليج نهائي — سيتم إشعار جميع الأعضاء</p>
          {!showDeleteConfirm
            ? <button className="action-btn" style={{ background:'rgba(201,58,47,.15)', color:'#ff9c91', border:'1px solid rgba(201,58,47,.25)', padding:'10px 24px' }} onClick={()=>setShowDeleteConfirm(true)}>
                🗑️ حذف الليج نهائياً
              </button>
            : (
              <div className="slide-down" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <button className="action-btn" style={{ background:'var(--red)', color:'#fff', padding:'10px 24px' }} onClick={deleteLeague}>
                  نعم، احذف الليج
                </button>
                <button className="action-btn" style={{ background:'var(--surface-3)', color:'var(--muted)', border:'1px solid var(--line)', padding:'10px 24px' }} onClick={()=>setShowDeleteConfirm(false)}>
                  إلغاء
                </button>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
