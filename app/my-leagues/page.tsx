'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotifications, sendNotification } from '../../lib/useNotifications';

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
      const { data: allPoints } = await supabase
        .from('user_points')
        .select('user_id, total_points, full_name, user_email')
        .in('user_id', allMemberUserIds);

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

      // ✅ FIX: إضافة الـ owner كـ member تلقائياً
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
    if (!confirm(`هل تريد حذف "${lg.name}" نهائياً؟`)) return;
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
        :root {
          --bg: #070809; --surface: #111315; --surface-2: #171a1d;
          --surface-3: #1d2125; --line: rgba(255,255,255,.08);
          --text: #f4f1e8; --muted: #a8a39a; --gold: #d9b25f;
          --gold-soft: rgba(217,178,95,.14); --red: #c93a2f;
          --green: #27b06e; --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Cairo, sans-serif; background: radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%), radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%), #070809; color: var(--text); direction: rtl; min-height: 100vh; }
        .nav-pill { padding: 10px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); cursor: pointer; font-family: Cairo, sans-serif; font-size: 13px; font-weight: 700; transition: all .2s; text-decoration: none; display: inline-flex; align-items: center; }
        .nav-pill:hover { background: var(--surface-3); color: var(--text); }
        .nav-pill.gold { border-color: rgba(217,178,95,.3); background: rgba(217,178,95,.1); color: #ffe3a6; }
        .nav-pill.gold:hover { background: rgba(217,178,95,.18); }
        .nav-pill:disabled { opacity: .4; cursor: not-allowed; }
        .league-card { background: linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015)); border: 1px solid var(--line); border-radius: 24px; padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow); }
        .league-card.owner { border-color: rgba(217,178,95,.2); }
        .action-btn { padding: 9px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(255,255,255,.06); color: var(--text); cursor: pointer; font-family: Cairo, sans-serif; font-size: 13px; font-weight: 700; transition: all .2s; white-space: nowrap; min-height: 40px; }
        .action-btn:hover { background: rgba(255,255,255,.1); }
        .field-input { width: 100%; padding: 13px 16px; border-radius: 14px; background: var(--surface-3); border: 1px solid var(--line); color: var(--text); font-family: Cairo, sans-serif; font-size: 14px; outline: none; transition: border-color .2s; }
        .field-input:focus { border-color: rgba(217,178,95,.4); }
        .member-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(255,255,255,.02); border: 1px solid var(--line); border-radius: 14px; margin-bottom: 8px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); backdrop-filter: blur(6px); display: grid; place-items: center; z-index: 1000; padding: 20px; }
        .modal-box { background: linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015),var(--surface)); border: 1px solid rgba(217,178,95,.2); border-radius: 28px; padding: 28px; width: 100%; max-width: 460px; box-shadow: 0 24px 64px rgba(0,0,0,.6); }
        .enter-league-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: 14px; background: rgba(217,178,95,.12); border: 1px solid rgba(217,178,95,.3); color: #ffe3a6; cursor: pointer; font-family: Cairo, sans-serif; font-size: 13px; font-weight: 700; transition: all .2s; text-decoration: none; }
        .enter-league-btn:hover { background: rgba(217,178,95,.22); }
        .manage-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid var(--line); color: var(--muted); cursor: pointer; font-family: Cairo, sans-serif; font-size: 13px; font-weight: 700; transition: all .2s; text-decoration: none; }
        .manage-btn:hover { background: rgba(255,255,255,.12); color: var(--text); }
      `}</style>

      {/* ══ HEADER ══ */}
      <div dir="rtl" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))', borderBottom: '1px solid var(--line)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ fontSize: 22, textDecoration: 'none' }}>🏆</Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>ليجاتي</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ownedLeagues}/5 ليجات منشأة — {leagues.length} مشارك فيها</div>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="nav-pill gold" disabled={ownedLeagues >= 5}>
            {showCreate ? '✕ إلغاء' : '＋ إنشاء ليج'}
          </button>
          <button onClick={() => setShowNotif(true)} className="nav-pill" style={{ position: 'relative' }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -6, left: -6, background: 'var(--red)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '2px 6px', minWidth: 18, textAlign: 'center' }}>{unreadCount}</span>
            )}
          </button>
          <Link href="/dashboard" className="nav-pill">← الداش</Link>
          <button onClick={handleLogout} className="nav-pill" style={{ borderColor: 'rgba(201,58,47,.25)', background: 'rgba(201,58,47,.06)', color: '#ff9c91' }}>خروج</button>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div dir="rtl" style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {message && (
          <div style={{ padding: '14px 20px', borderRadius: 16, marginBottom: 16, fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, textAlign: 'center', background: msgType === 'success' ? 'rgba(39,176,110,.12)' : 'rgba(201,58,47,.12)', border: `1px solid ${msgType === 'success' ? 'rgba(39,176,110,.25)' : 'rgba(201,58,47,.25)'}`, color: msgType === 'success' ? '#94f0c0' : '#ff9c91' }}>
            {message}
          </div>
        )}

        {showCreate && (
          <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))', border: '1px solid rgba(217,178,95,.2)', borderRadius: 24, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: 'var(--gold)' }}>＋ إنشاء ليج جديد</div>
            <input type="text" value={newLeagueName} onChange={e => setNewLeagueName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createLeague()} placeholder="اسم الليج..." className="field-input" style={{ marginBottom: 12, direction: 'rtl' }} />
            <button onClick={createLeague} disabled={creating || !newLeagueName.trim()} className="nav-pill gold" style={{ width: '100%', justifyContent: 'center', borderRadius: 14, padding: '13px', fontSize: 14 }}>
              {creating ? '⏳ جاري الإنشاء...' : '✅ إنشاء'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <div>جاري التحميل...</div>
          </div>
        ) : leagues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>مش مشترك في أي ليج بعد</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>أنشئ ليجك الخاص أو اطلب كود من صاحبك</div>
            <button onClick={() => setShowCreate(true)} className="nav-pill gold">＋ إنشاء ليج جديد</button>
          </div>
        ) : (
          <div>
            {leagues.map((lg: any) => (
              <div key={lg.id} className={`league-card${lg.role === 'owner' ? ' owner' : ''}`}>

                {/* League header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{lg.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 700, background: lg.role === 'owner' ? 'rgba(217,178,95,.12)' : 'rgba(255,255,255,.06)', border: `1px solid ${lg.role === 'owner' ? 'rgba(217,178,95,.25)' : 'var(--line)'}`, color: lg.role === 'owner' ? '#ffe3a6' : 'var(--muted)' }}>
                        {lg.role === 'owner' ? '👑 منشئ' : '👤 عضو'}
                      </span>
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 700, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
                        👥 {lg.memberCount} أعضاء
                      </span>
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 700, background: 'rgba(217,178,95,.08)', border: '1px solid rgba(217,178,95,.18)', color: 'var(--gold)' }}>
                        📊 ترتيبك: {lg.myRank === '—' ? '—' : `#${lg.myRank}`}
                      </span>
                    </div>
                  </div>
                  {/* ✅ FIX: كود الانضمام */}
                  <div style={{ textAlign: 'center', background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 14, padding: '8px 14px', minWidth: 90 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>كود الانضمام</div>
                    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{lg.code}</div>
                  </div>
                </div>

                {/* Members list */}
                {lg.members && lg.members.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>الترتيب داخل الليج</div>
                    {lg.members.map((m: any, i: number) => (
                      <div key={m.user_id} className="member-row" style={m.user_id === user?.id ? { borderColor: 'rgba(217,178,95,.25)', background: 'rgba(217,178,95,.06)' } : {}}>
                        <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(217,178,95,.1)', display: 'grid', placeItems: 'center', fontSize: i < 3 ? 16 : 12, fontWeight: 800, flexShrink: 0 }}>
                          {i < 3 ? medals[i] : `#${m.rank}`}
                        </div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                          {m.name}
                          {m.user_id === user?.id && <span style={{ background: 'rgba(217,178,95,.15)', color: 'var(--gold)', borderRadius: 999, padding: '2px 8px', fontSize: 11, marginRight: 6 }}>أنت</span>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{m.pts}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ✅ FIX: أزرار الدخول والإدارة */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <Link href={`/mini-league/${lg.code}`} className="enter-league-btn">
                    🏆 دخول الليج
                  </Link>
                  {lg.role === 'owner' && (
                    <Link href={`/mini-league/${lg.code}/manage`} className="manage-btn">
                      ⚙️ إدارة الليج
                    </Link>
                  )}
                </div>

                {/* Actions */}
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
      </div>

      {/* ══ SHARE MODAL ══ */}
      {shareLeague && (
        <div className="modal-overlay" onClick={() => setShareLeague(null)}>
          <div className="modal-box" onClick={(e: any) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18 }}>مشاركة ليج {shareLeague.name}</h3>
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
        <div className="modal-overlay" onClick={() => setShowNotif(false)}>
          <div className="modal-box" style={{ maxHeight: '80vh', overflowY: 'auto' }} onClick={(e: any) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 18 }}>🔔 الإشعارات</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && <button onClick={markAllRead} className="action-btn" style={{ fontSize: 12, padding: '6px 12px' }}>قراءة الكل</button>}
                <button onClick={() => setShowNotif(false)} style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'grid', placeItems: 'center' }}>✕</button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div>لا توجد إشعارات</div>
              </div>
            ) : notifications.map((n: any) => (
              <div key={n.id} style={{ padding: '14px 16px', borderRadius: 16, marginBottom: 10, background: n.read ? 'rgba(255,255,255,.02)' : 'rgba(217,178,95,.06)', border: `1px solid ${n.read ? 'var(--line)' : 'rgba(217,178,95,.18)'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>{n.message || n.type}</div>
                {n.type === 'league_invite' && !n.read && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => respondToInvite(n, true)} className="action-btn" style={{ background: 'rgba(39,176,110,.15)', border: '1px solid rgba(39,176,110,.25)', color: '#94f0c0' }}>✅ قبول</button>
                    <button onClick={() => respondToInvite(n, false)} className="action-btn" style={{ background: 'rgba(201,58,47,.1)', border: '1px solid rgba(201,58,47,.2)', color: '#ff9c91' }}>❌ رفض</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
