'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotifications, sendNotification, getNotificationText } from '../../lib/useNotifications';

export default function MyLeaguesPage() {
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [shareLeague, setShareLeague] = useState<any>(null);
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadData = useCallback(async (uid: string) => {
    setLoading(true);

    const { data: memberRows } = await supabase
      .from('mini_league_members')
      .select('league_id, role')
      .eq('user_id', uid);

    if (!memberRows || memberRows.length === 0) {
      setLeagues([]);
      setLoading(false);
      return;
    }

    const leagueIds = memberRows.map((r: any) => r.league_id);
    const roleMap = new Map(memberRows.map((r: any) => [r.league_id, r.role]));

    const { data: leagueRows } = await supabase
      .from('mini_leagues')
      .select('*')
      .in('id', leagueIds)
      .order('created_at', { ascending: false });

const enriched = await Promise.all((leagueRows || []).map(async (lg: any) => {
  // ✅ FIX النهائي: نستخدم mini_league_members بدل standings
  const { data: membersData } = await supabase
    .from('mini_league_members')
    .select('user_id, role, joined_at')
    .eq('league_id', lg.id);

  const memberCount = membersData?.length || 0;
  const myRole = membersData?.find(m => m.user_id === user.id)?.role || 'member';

  return {
    ...lg,
    role: myRole,
    memberCount,
    myRank: '—',
    members: membersData || []
  };
}));
      const myRank = members?.find((m: any) => m.user_id === uid)?.rank ?? '—';
      return { ...lg, role: roleMap.get(lg.id), memberCount: members?.length || 0, myRank, members: members || [] };
    }));

    setLeagues(enriched);
    setLoading(false);
  }, []);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_points')
      .select('user_id, full_name, user_email')
      .order('full_name', { ascending: true });
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
        .from('mini_leagues')
        .insert({ name: newLeagueName.trim(), code, created_by: user.id })
        .select()
        .single();
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
        .eq('league_id', league_id)
        .eq('invited_user', user.id);
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

  // ── نسخ كود ───────────────────────────────────────────────
  const copyCode = (lg: any) => {
    const txt = `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\nالكود: ${lg.code}\nافتح التطبيق وروح ليجاتي ← إدخال الكود`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopyFeedback(lg.id);
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  };

  // ── مشاركة الليج ──────────────────────────────────────────
  const getLeagueShareText = (lg: any) =>
    `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\nالكود: ${lg.code}\nسجّل من هنا: https://worldcup.shamaadan.com/login`;

  const shareLeagueWhatsApp = (lg: any) => {
    if (typeof window === 'undefined') return;
    window.open(`https://wa.me/?text=${encodeURIComponent(getLeagueShareText(lg))}`, '_blank');
  };

  const shareLeagueFacebook = (lg: any) => {
    if (typeof window === 'undefined') return;
    const url = encodeURIComponent('https://worldcup.shamaadan.com/login');
    const quote = encodeURIComponent(`🏆 انضم لليج "${lg.name}" في الشمعدان! الكود: ${lg.code}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank', 'width=600,height=400');
  };

  const shareLeagueMessenger = (lg: any) => {
    if (typeof window === 'undefined') return;
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

  // ── تسجيل خروج ────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const medals = ['🥇', '🥈', '🥉'];
  const ownedLeagues = leagues.filter(l => l.role === 'owner').length;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(217,178,95,.1),transparent),#070809', color: '#f4f1e8', fontFamily: 'Cairo, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg:#070809; --surface:#111315; --surface-2:#171a1d; --surface-3:#1d2125;
          --line:rgba(255,255,255,.08); --text:#f4f1e8; --muted:#a8a39a;
          --gold:#d9b25f; --red:#c93a2f; --green:#27b06e;
        }
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
      <header style={{ background: 'rgba(7,8,9,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#d9b25f' }}>ليجاتي</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>الشمعدان × كأس العالم 2026</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={handleLogout} className="nav-pill danger">خروج</button>
            <Link href="/dashboard" className="nav-pill">⚽ توقعاتي</Link>
            <Link href="/dashboard" className="nav-pill">🏁 الصدارة</Link>
            <button onClick={() => setShowNotif(!showNotif)} className="nav-pill gold" style={{ position: 'relative' }}>
              🔔 الإشعارات
              {unreadCount > 0 && <span style={{ background: '#c93a2f', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{unreadCount}</span>}
            </button>
          </div>
        </div>

        {/* Notifications dropdown */}
        {showNotif && (
          <div className="slide-down" style={{ position: 'absolute', left: 20, right: 20, top: '100%', maxWidth: 400, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,.5)', zIndex: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>الإشعارات</span>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Cairo, sans-serif' }}>قراءة الكل</button>}
            </div>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>لا توجد إشعارات</div>
            ) : notifications.map((n: any) => (
              <div key={n.id} className={`notif-item${!n.is_read ? ' unread' : ''}`} onClick={() => { if (!n.is_read) markRead(n.id); }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{getNotificationText(n)}</div>
                {n.type === 'invite' && !n.is_read && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={e => { e.stopPropagation(); respondToInvite(n, true); }} style={{ fontSize: 12, background: 'rgba(39,176,110,.2)', border: 'none', color: '#94f0c0', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>✅ قبول</button>
                    <button onClick={e => { e.stopPropagation(); respondToInvite(n, false); }} style={{ fontSize: 12, background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: 'var(--muted)', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>❌ رفض</button>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{new Date(n.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ══ MAIN ══ */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* Toast message */}
        {message && (
          <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 14, background: msgType === 'success' ? 'rgba(39,176,110,.12)' : 'rgba(201,58,47,.12)', border: `1px solid ${msgType === 'success' ? 'rgba(39,176,110,.25)' : 'rgba(201,58,47,.25)'}`, color: msgType === 'success' ? '#94f0c0' : '#ff9c91', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>
            {message}
          </div>
        )}

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>🏆 ليجاتي</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{ownedLeagues}/5 ليجات منشأة — {leagues.length} مشارك فيها</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowCreate(!showCreate)} className="nav-pill gold" disabled={ownedLeagues >= 5}>
              {showCreate ? '✕ إلغاء' : '＋ إنشاء ليج جديد'}
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card slide-down" style={{ marginBottom: 20, background: 'var(--surface-2)', border: '1px solid rgba(217,178,95,.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#d9b25f', marginBottom: 14 }}>＋ إنشاء ليج جديد</div>
            <input
              type="text"
              value={newLeagueName}
              onChange={e => setNewLeagueName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createLeague()}
              placeholder="اسم الليج..."
              className="field-input"
              style={{ marginBottom: 12, direction: 'rtl' }}
            />
            <button onClick={createLeague} disabled={creating || !newLeagueName.trim()} className="nav-pill gold" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {creating ? '⏳ جاري الإنشاء...' : '✅ إنشاء'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 700 }}>جاري التحميل...</div>
          </div>
        ) : leagues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>مش مشترك في أي ليج بعد</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>أنشئ ليجك الخاص أو اطلب كود من صاحبك</div>
            <button onClick={() => setShowCreate(true)} className="nav-pill gold">＋ إنشاء ليج جديد</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {leagues.map((lg, idx) => (
              <div key={lg.id} className="card row-in" style={{ animationDelay: `${idx * 60}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{lg.name}</span>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: lg.role === 'owner' ? 'rgba(217,178,95,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${lg.role === 'owner' ? 'rgba(217,178,95,.3)' : 'var(--line)'}`, color: lg.role === 'owner' ? '#ffe3a6' : 'var(--muted)' }}>
                        {lg.role === 'owner' ? '👑 منشئ' : '👤 عضو'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>👥 {lg.memberCount} أعضاء</span>
                      <span>📊 ترتيبك: <strong style={{ color: '#d9b25f' }}>{lg.myRank === '—' ? '—' : `#${lg.myRank}`}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: 'var(--surface-3)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 12, padding: '6px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 800, color: '#d9b25f', letterSpacing: 1 }}>
                      {lg.code}
                    </div>
                    <button onClick={() => copyCode(lg)} className="action-btn" style={{ background: copyFeedback === lg.id ? 'rgba(39,176,110,.2)' : 'rgba(255,255,255,.06)', color: copyFeedback === lg.id ? '#94f0c0' : 'var(--text)' }}>
                      {copyFeedback === lg.id ? '✅' : '📋'}
                    </button>
                  </div>
                </div>

                {/* League standings */}
                {lg.members.length > 0 && (
                  <div style={{ background: 'var(--surface-3)', borderRadius: 14, padding: '12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 10 }}>الترتيب</div>
                    {lg.members.slice(0, 5).map((m: any, i: number) => (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: i < Math.min(lg.members.length, 5) - 1 ? '1px solid var(--line)' : 'none' }}>
                        <span style={{ fontSize: 16, minWidth: 24 }}>{i < 3 ? medals[i] : `${i + 1}.`}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: m.user_id === user?.id ? 700 : 500, color: m.user_id === user?.id ? '#d9b25f' : 'var(--text)' }}>
                          {m.user_name || '—'} {m.user_id === user?.id && <span style={{ fontSize: 10, color: '#d9b25f' }}>← أنت</span>}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#d9b25f' }}>{m.total_points || 0}</span>
                      </div>
                    ))}
                    {lg.members.length > 5 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>+ {lg.members.length - 5} أعضاء</div>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => shareLeagueWhatsApp(lg)} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0' }}>💬 واتساب</button>
                  <button onClick={() => shareLeagueFacebook(lg)} className="action-btn" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#93c5fd' }}>📘 فيسبوك</button>
                  <button onClick={() => shareLeagueMessenger(lg)} className="action-btn" style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#c4b5fd' }}>⚡ ماسنجر</button>
                  <button onClick={() => openShareModal(lg)} className="action-btn" style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', color: '#ffe3a6' }}>📤 مشاركة</button>
                  {lg.role !== 'owner' && (
                    <button onClick={() => leaveLeague(lg)} className="action-btn" style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91', marginRight: 'auto' }}>🚪 مغادرة</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share modal fallback */}
      {shareLeague && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShareLeague(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#d9b25f' }}>مشاركة ليج {shareLeague.name}</span>
              <button onClick={() => setShareLeague(null)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => { shareLeagueWhatsApp(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0', padding: '12px', borderRadius: 14 }}>💬 واتساب</button>
              <button onClick={() => { shareLeagueFacebook(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#93c5fd', padding: '12px', borderRadius: 14 }}>📘 فيسبوك</button>
              <button onClick={() => { shareLeagueMessenger(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#c4b5fd', padding: '12px', borderRadius: 14 }}>⚡ ماسنجر</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
