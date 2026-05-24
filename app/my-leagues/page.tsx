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
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('mini_league_members')
        .select('league_id, role')
        .eq('user_id', uid);
      if (memberErr) throw memberErr;
      if (!memberRows || memberRows.length === 0) {
        setLeagues([]);
        setLoading(false);
        return;
      }
      const leagueIds = memberRows.map((r: any) => r.league_id);
      const roleMap = new Map(memberRows.map((r: any) => [r.league_id, r.role]));
      const { data: leagueRows, error: lgErr } = await supabase
        .from('mini_leagues')
        .select('*')
        .in('id', leagueIds)
        .order('created_at', { ascending: false });
      if (lgErr) throw lgErr;
      const { data: allMembers } = await supabase
        .from('mini_league_members')
        .select('league_id, user_id')
        .in('league_id', leagueIds);
      const allMemberUserIds = [...new Set((allMembers || []).map((m: any) => m.user_id))];
      const { data: allPoints } = allMemberUserIds.length > 0
        ? await supabase.from('user_points').select('user_id, total_points, full_name, user_email').in('user_id', allMemberUserIds)
        : { data: [] };
      const pointsMap = new Map((allPoints || []).map((p: any) => [p.user_id, p]));
      const enriched = (leagueRows || []).map((lg: any) => {
        const lgMembers = (allMembers || []).filter((m: any) => m.league_id === lg.id);
        const memberCount = lgMembers.length;
        const sorted = lgMembers
          .map((m: any) => ({ user_id: m.user_id, pts: pointsMap.get(m.user_id)?.total_points || 0 }))
          .sort((a: any, b: any) => b.pts - a.pts);
        const myRankIdx = sorted.findIndex((m: any) => m.user_id === uid);
        const myRank = myRankIdx >= 0 ? myRankIdx + 1 : '—';
        const members = sorted.map((m: any, i: number) => ({
          user_id: m.user_id,
          name: pointsMap.get(m.user_id)?.full_name || pointsMap.get(m.user_id)?.user_email?.split('@')[0] || 'مجهول',
          pts: m.pts,
          rank: i + 1,
        }));
        return { ...lg, role: roleMap.get(lg.id) || 'member', memberCount, myRank, members };
      });
      setLeagues(enriched);
    } catch (err: any) {
      console.error('loadData error:', err);
      showMsg('❌ خطأ في تحميل البيانات: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
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
      const { data: up } = await supabase
        .from('user_points')
        .select('full_name, user_email')
        .eq('user_id', data.user.id)
        .maybeSingle();
      setUserName(up?.full_name || up?.user_email?.split('@')[0] || 'مجهول');
      await loadData(data.user.id);
      await loadAllUsers();
    });
  }, [router, loadData, loadAllUsers]);

  const createLeague = async () => {
    if (!newLeagueName.trim() || !user) return;
    const ownedCount = leagues.filter((l: any) => l.role === 'owner').length;
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
      const { error: memberErr } = await supabase.from('mini_league_members').insert({
        league_id: lg.id,
        user_id: user.id,
        role: 'owner',
      });
      if (memberErr) throw memberErr;
      setNewLeagueName('');
      setShowCreate(false);
      showMsg(`✅ تم إنشاء "${lg.name}" — كود: ${lg.code}`);
      await loadData(user.id);
    } catch (err: any) {
      showMsg('❌ ' + (err.message || 'خطأ في الإنشاء'), 'error');
    } finally {
      setCreating(false);
    }
  };

  // ✅ FIX: 'invite' بدل 'league_invite' ليطابق AppNotification type
  const respondToInvite = async (notif: any, accept: boolean) => {
    const { league_id, league_name, from_user_id } = notif.data;
    try {
      await supabase
        .from('mini_league_invitations')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('league_id', league_id)
        .eq('invited_user', user.id);
      if (accept) {
        await supabase.from('mini_league_members').insert({
          league_id,
          user_id: user.id,
          role: 'member',
        });
        await sendNotification(from_user_id, 'invite_accepted', {
          league_id,
          league_name,
          invited_user_name: userName,
        });
        showMsg(`✅ انضممت لـ "${league_name}"`);
        await loadData(user.id);
      } else {
        await sendNotification(from_user_id, 'invite_declined', {
          league_id,
          league_name,
          invited_user_name: userName,
        });
        showMsg('تم رفض الدعوة');
      }
      await markRead(notif.id);
    } catch (err: any) {
      showMsg('❌ ' + err.message, 'error');
    }
  };

  const leaveLeague = async (lg: any) => {
    if (!confirm(`هل تريد مغادرة "${lg.name}"؟`)) return;
    await supabase.from('mini_league_members').delete().eq('league_id', lg.id).eq('user_id', user.id);
    showMsg(`غادرت "${lg.name}"`);
    await loadData(user.id);
  };

  const deleteLeague = async (lg: any) => {
    if (lg.role !== 'owner') { showMsg('❌ فقط المنشئ يمكنه حذف الليج', 'error'); return; }
    if (!confirm(`هل تريد حذف "${lg.name}" نهائياً؟`)) return;
    await supabase.from('mini_league_invitations').delete().eq('league_id', lg.id);
    await supabase.from('mini_league_members').delete().eq('league_id', lg.id);
    await supabase.from('mini_leagues').delete().eq('id', lg.id);
    showMsg(`🗑️ تم حذف "${lg.name}"`);
    await loadData(user.id);
  };

  const copyCode = (lg: any) => {
    const txt = `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\nالكود: ${lg.code}\nافتح التطبيق وروح ليجاتي ← إدخال الكود`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopyFeedback(lg.id);
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  };

  const getLeagueShareText = (lg: any) =>
    `🏆 انضم لليج "${lg.name}" في الشمعدان × كأس العالم 2026!\n` +
    `سجّل دخولك عن طريق الرابط ده وهتنضم تلقائياً ⬇️\n` +
    `https://worldcup.shamaadan.com/login?league=${lg.code}`;

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const medals = ['🥇', '🥈', '🥉'];
  const ownedLeagues = leagues.filter((l: any) => l.role === 'owner').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root{--bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;--line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;--gold:#d9b25f}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);color:var(--text);font-family:'Cairo',sans-serif;direction:rtl;min-height:100vh}
        .nav-pill{padding:9px 18px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;text-decoration:none;transition:opacity .18s;display:inline-flex;align-items:center;gap:6px}
        .nav-pill.gold{background:linear-gradient(135deg,rgba(217,178,95,.18),rgba(217,178,95,.06));border-color:rgba(217,178,95,.28);color:var(--gold)}
        .nav-pill:disabled{opacity:.4;cursor:not-allowed}
        .nav-pill:hover:not(:disabled){opacity:.8}
        .action-btn{padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);cursor:pointer;font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;transition:opacity .18s}
        .action-btn:hover{opacity:.8}
        .field-input{width:100%;padding:12px 16px;border-radius:12px;background:var(--surface-3);border:1px solid var(--line);color:var(--text);font-family:'Cairo',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        @keyframes notifSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .notif-item{animation:notifSlide .2s ease}
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{ background: 'linear-gradient(180deg,rgba(217,178,95,.05),transparent),var(--surface)', borderBottom: '1px solid var(--line)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>ليجاتي</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{ownedLeagues}/5 ليجات منشأة — {leagues.length} مشارك فيها</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowCreate(!showCreate)} className="nav-pill gold" disabled={ownedLeagues >= 5}>
            {showCreate ? '✕ إلغاء' : '＋ إنشاء ليج'}
          </button>

          {/* ✅ FIX: markAllRead عند فتح modal + badge يدعم 9+ */}
          <button
            onClick={() => { setShowNotif(true); markAllRead(); }}
            className="nav-pill"
            style={{ position: 'relative' }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: '#c93a2f', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'grid', placeItems: 'center', padding: '0 4px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <Link href="/dashboard" className="nav-pill">← الداش</Link>
          <button onClick={handleLogout} className="nav-pill">خروج</button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
        {message && (
          <div style={{ padding: '12px 18px', borderRadius: 14, marginBottom: 14, fontSize: 13, fontWeight: 700, textAlign: 'center', background: msgType === 'success' ? 'rgba(39,176,110,.1)' : 'rgba(201,58,47,.1)', border: `1px solid ${msgType === 'success' ? 'rgba(39,176,110,.2)' : 'rgba(201,58,47,.2)'}`, color: msgType === 'success' ? '#94f0c0' : '#ff9090' }}>
            {message}
          </div>
        )}

        {showCreate && (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 18, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--gold)' }}>＋ إنشاء ليج جديد</div>
            <input type="text" value={newLeagueName} onChange={e => setNewLeagueName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createLeague()} placeholder="اسم الليج..." className="field-input" style={{ marginBottom: 12, direction: 'rtl' }} />
            <button onClick={createLeague} disabled={creating} className="action-btn" style={{ width: '100%', padding: 12, background: 'rgba(217,178,95,.12)', border: '1px solid rgba(217,178,95,.25)', color: 'var(--gold)', borderRadius: 12, fontSize: 14 }}>
              {creating ? '⏳ جاري الإنشاء...' : '✅ إنشاء'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontWeight: 700 }}>جاري التحميل...</div>
        ) : leagues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>مش مشترك في أي ليج بعد</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>أنشئ ليجك الخاص أو اطلب كود من صاحبك</div>
            <button onClick={() => setShowCreate(true)} className="nav-pill gold">＋ إنشاء ليج جديد</button>
          </div>
        ) : (
          <div>
            {leagues.map((lg: any) => (
              <div key={lg.id} style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{lg.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: lg.role === 'owner' ? 'rgba(217,178,95,.12)' : 'rgba(255,255,255,.06)', color: lg.role === 'owner' ? '#ffe3a6' : 'var(--muted)', fontWeight: 700 }}>{lg.role === 'owner' ? '👑 منشئ' : '👤 عضو'}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>👥 {lg.memberCount} أعضاء</span>
                      <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>📊 ترتيبك: {lg.myRank === '—' ? '—' : `#${lg.myRank}`}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'var(--surface-3)', border: '1px solid rgba(217,178,95,.15)', borderRadius: 12, padding: '8px 14px', minWidth: 90 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 3 }}>كود الانضمام</div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--gold)', letterSpacing: 3 }}>{lg.code}</div>
                  </div>
                </div>

                {lg.members && lg.members.length > 0 && (
                  <div style={{ background: 'var(--surface-3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>الترتيب داخل الليج</div>
                    {lg.members.map((m: any, i: number) => (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                        <span style={{ fontWeight: 800, width: 28, textAlign: 'center', flexShrink: 0 }}>{i < 3 ? medals[i] : `#${m.rank}`}</span>
                        <span style={{ flex: 1, fontWeight: 700 }}>{m.name}</span>
                        {m.user_id === user?.id && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(217,178,95,.1)', color: '#ffe3a6', fontWeight: 700 }}>أنت</span>}
                        <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 12, flexShrink: 0 }}>{m.pts}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Link href={`/mini-league/${lg.code}`} className="nav-pill gold" style={{ fontSize: 12, padding: '8px 14px' }}>🏆 دخول الليج</Link>
                  {lg.role === 'owner' && (
                    <Link href={`/mini-league/${lg.code}/manage`} className="nav-pill" style={{ fontSize: 12, padding: '8px 14px' }}>⚙️ إدارة الليج</Link>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => copyCode(lg)} className="action-btn" style={{ background: copyFeedback === lg.id ? 'rgba(39,176,110,.2)' : 'rgba(255,255,255,.06)', color: copyFeedback === lg.id ? '#94f0c0' : 'var(--text)' }}>
                    {copyFeedback === lg.id ? '✅ تم النسخ' : '📋 نسخ الكود'}
                  </button>
                  <button onClick={() => shareLeagueWhatsApp(lg)} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0' }}>💬 واتساب</button>
                  <button onClick={() => shareLeagueFacebook(lg)} className="action-btn" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#93c5fd' }}>📘 فيسبوك</button>
                  <button onClick={() => shareLeagueMessenger(lg)} className="action-btn" style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#c4b5fd' }}>⚡ ماسنجر</button>
                  <button onClick={() => openShareModal(lg)} className="action-btn" style={{ background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.2)', color: '#ffe3a6' }}>📤 مشاركة</button>
                  {lg.role !== 'owner' && (
                    <button onClick={() => leaveLeague(lg)} className="action-btn" style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91', marginRight: 'auto' }}>🚪 مغادرة</button>
                  )}
                  {lg.role === 'owner' && (
                    <button onClick={() => deleteLeague(lg)} className="action-btn" style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91', marginRight: 'auto' }}>🗑️ حذف</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ══ SHARE MODAL ══ */}
      {shareLeague && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShareLeague(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,178,95,.2)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>مشاركة ليج {shareLeague.name}</div>
              <button onClick={() => setShareLeague(null)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { shareLeagueWhatsApp(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0', padding: '14px', borderRadius: 14 }}>💬 واتساب</button>
              <button onClick={() => { shareLeagueFacebook(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#93c5fd', padding: '14px', borderRadius: 14 }}>📘 فيسبوك</button>
              <button onClick={() => { shareLeagueMessenger(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#c4b5fd', padding: '14px', borderRadius: 14 }}>⚡ ماسنجر</button>
              <button onClick={() => { copyCode(shareLeague); setShareLeague(null); }} className="action-btn" style={{ background: 'rgba(255,255,255,.06)', padding: '14px', borderRadius: 14 }}>📋 نسخ الكود</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ NOTIFICATIONS MODAL ══ */}
      {showNotif && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowNotif(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🔔 الإشعارات</div>
              <button onClick={() => setShowNotif(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>

            {/* Empty state */}
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>لا توجد إشعارات بعد</div>
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)', opacity: .7 }}>هتظهر هنا لما حد يدعوك لليج أو يقبل دعوتك</div>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} className="notif-item" style={{
                  padding: '14px 0',
                  borderBottom: '1px solid var(--line)',
                  opacity: n.is_read ? 0.5 : 1,
                  transition: 'opacity .25s',
                }}>
                  {/* ✅ FIX: getNotificationText بدل n.message || n.type */}
                  <div style={{
                    fontSize: 13,
                    fontWeight: n.is_read ? 600 : 800,
                    lineHeight: 1.65,
                    color: n.is_read ? 'var(--muted)' : 'var(--text)',
                    marginBottom: 5,
                  }}>
                    {getNotificationText(n)}
                  </div>

                  {/* وقت الإشعار */}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: n.type === 'invite' && !n.is_read ? 10 : 0 }}>
                    {new Date(n.created_at).toLocaleDateString('ar-EG', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>

                  {/* ✅ FIX: n.type === 'invite' (مش 'league_invite') + n.is_read (مش n.read) */}
                  {n.type === 'invite' && !n.is_read && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => respondToInvite(n, true)}
                        className="action-btn"
                        style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0', borderRadius: 12, padding: '8px 20px', fontSize: 13 }}
                      >
                        ✅ قبول
                      </button>
                      <button
                        onClick={() => respondToInvite(n, false)}
                        className="action-btn"
                        style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91', borderRadius: 12, padding: '8px 20px', fontSize: 13 }}
                      >
                        ❌ رفض
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
