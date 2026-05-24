'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Player {
  user_id: string;
  user_email: string;
  display_name: string | null;
  total_points: number;
  predictions_count: number;
  profile_completed: boolean;
}

const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [myRank, setMyRank] = useState(0);
  const [myPoints, setMyPoints] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const maxPoints = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  // الـ search تعمل على كل البيانات المحملة (بس في أول صفحة)
  // لو في search نجيب كل البيانات، لو مفيش نعمل pagination server-side
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
    loadMyRank();
    loadPage(1);
  }, []);

  // لما يبحث، جيب كل البيانات مرة واحدة
  useEffect(() => {
    if (isSearching) {
      loadAllForSearch();
    } else {
      loadPage(currentPage);
    }
  }, [isSearching]);

  const loadMyRank = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    // اجيب ترتيبه: عدد اللي عندهم نقاط أكثر منه + 1
    const { data: myData } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', authData.user.id)
      .single();
    if (!myData) return;
    setMyPoints(myData.total_points || 0);
    const { count } = await supabase
      .from('user_points')
      .select('*', { count: 'exact', head: true })
      .gt('total_points', myData.total_points);
    setMyRank((count || 0) + 1);
  };

  const loadPage = async (page: number) => {
    if (page !== 1) setPageLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('user_points')
      .select('*', { count: 'exact' })
      .order('total_points', { ascending: false })
      .range(from, to);

    if (data) {
      if (page === 1 && data.length > 0) {
        maxPoints.current = data[0].total_points || 1;
      }
      const mapped: Player[] = data.map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        total_points: row.total_points || 0,
        predictions_count: row.predictions_count || 0,
        profile_completed: row.profile_completed || false,
      }));
      setPlayers(mapped);
      if (count !== null) setTotalCount(count);
    }
    setLoading(false);
    setPageLoading(false);
    setAnimated(false);
    setTimeout(() => setAnimated(true), 80);
  };

  // بيانات كاملة للـ search فقط
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const loadAllForSearch = async () => {
    if (allPlayers.length > 0) return; // cached
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .order('total_points', { ascending: false });
    if (data) {
      setAllPlayers(data.map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        display_name: row.full_name || null,
        total_points: row.total_points || 0,
        predictions_count: row.predictions_count || 0,
        profile_completed: row.profile_completed || false,
      })));
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadPage(page);
    // Scroll للقائمة
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getName = (p: Player) => p.display_name || p.user_email?.split('@')[0] || 'مجهول';
  const getInitials = (p: Player) => getName(p).slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  // اللي يتعرض: لو بيبحث من allPlayers، لو لأ من players (الصفحة الحالية)
  const sourceList = isSearching ? allPlayers : players;
  const filteredPlayers = isSearching
    ? sourceList.filter(p =>
        getName(p).toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sourceList;

  // الـ global rank: لو بنعرض صفحة معينة، الـ rank = (page-1)*PAGE_SIZE + index+1
  const getGlobalRank = (index: number) =>
    isSearching
      ? (players.findIndex(p => p.user_id === filteredPlayers[index].user_id) >= 0
          ? players.findIndex(p => p.user_id === filteredPlayers[index].user_id) + (currentPage - 1) * PAGE_SIZE + 1
          : index + 1)
      : (currentPage - 1) * PAGE_SIZE + index + 1;

  // Pagination — أرقام الصفحات
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const top3 = players.slice(0, 3); // دايماً من أول صفحة

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        :root {
          --bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;
          --line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;
          --gold:#d9b25f;--red:#c93a2f;--green:#27b06e;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Cairo',sans-serif;background:radial-gradient(circle at top right,rgba(201,58,47,.08),transparent 26%),radial-gradient(circle at top left,rgba(217,178,95,.08),transparent 28%),#070809;color:var(--text);direction:rtl;min-height:100vh;}
        a{text-decoration:none;color:inherit}
        @keyframes barGrow{from{width:0% !important}}
        @keyframes rowIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
        @keyframes rotateBorder{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .player-row{opacity:0;animation:rowIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards}
        .bar-fill{animation:barGrow 0.9s cubic-bezier(0.16,1,0.3,1) forwards}
        .top-float{animation:float 3.5s ease-in-out infinite}
        .skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;border-radius:16px}
        .nav-pill{padding:9px 20px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);font-weight:700;text-decoration:none;font-size:13px;font-family:'Cairo',sans-serif;transition:all .2s;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .nav-pill:hover{border-color:rgba(217,178,95,.25);color:#f2d79e}
        .nav-pill.primary{background:linear-gradient(135deg,#e0bc73,#b9892d);color:#211708;border:none;box-shadow:0 4px 14px rgba(217,178,95,.25)}
        .nav-pill.primary:hover{opacity:.88}
        .search-box{width:100%;padding:13px 18px;border-radius:16px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-family:'Cairo',sans-serif;font-size:14px;font-weight:600;outline:none;transition:border-color .2s;direction:rtl}
        .search-box:focus{border-color:rgba(217,178,95,.4)}
        .search-box::placeholder{color:var(--muted)}
        /* Pagination */
        .pg-btn{
          min-width:36px;height:36px;border-radius:10px;border:1px solid var(--line);
          background:var(--surface-2);color:var(--muted);font-family:'Cairo',sans-serif;
          font-weight:800;font-size:13px;cursor:pointer;
          display:inline-flex;align-items:center;justify-content:center;
          transition:all .18s;
        }
        .pg-btn:hover:not(:disabled){border-color:rgba(217,178,95,.3);color:var(--gold);background:rgba(217,178,95,.06)}
        .pg-btn.active{background:linear-gradient(135deg,#d9b25f,#a8761a);color:#211708;border-color:transparent}
        .pg-btn:disabled{opacity:.3;cursor:not-allowed}
        /* Logo */
        .logo-wrap{position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .logo-wrap::before{content:'';position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(rgba(217,178,95,.5),rgba(217,178,95,.08),rgba(217,178,95,.5));animation:rotateBorder 4s linear infinite}
        .logo-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--surface)}
        .logo-wrap img{position:relative;z-index:2;object-fit:contain;padding:6px;width:60px;height:60px}
        .logo-hero-wrap{position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center;animation:logoFloat 4s ease-in-out infinite}
        .logo-hero-wrap::before{content:'';position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(rgba(217,178,95,.6),rgba(217,178,95,.1),rgba(217,178,95,.6));animation:rotateBorder 4s linear infinite;z-index:0}
        .logo-hero-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--bg);z-index:1}
        .logo-hero-wrap img{position:relative;z-index:2;object-fit:contain;padding:10px;width:90px;height:90px;border-radius:50%}
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(7,8,9,.9)',backdropFilter:'blur(12px)',borderBottom:'1px solid var(--line)',padding:'12px 20px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <div className="logo-wrap">
          <img src="/logo-FF.png" alt="الشمعدان" width={60} height={60} loading="eager" />
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:15,color:'var(--gold)'}}>الشمعدان × كأس العالم 2026</div>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>
            {loading ? 'جاري التحميل...' : `${totalCount} متسابق · صفحة ${currentPage} من ${totalPages}`}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {currentUser
            ? <Link href="/dashboard" className="nav-pill primary">⚽ توقعاتي</Link>
            : <Link href="/login" className="nav-pill primary">🔑 انضم الآن</Link>}
          <Link href="/" className="nav-pill">🏠 الرئيسية</Link>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <div style={{textAlign:'center',padding:'52px 20px 36px',background:'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(217,178,95,.07),transparent)'}}>
        <div className="logo-hero-wrap" style={{margin:'0 auto 20px'}}>
          <img src="/logo-FF.png" alt="شعار الشمعدان" width={90} height={90} loading="eager" />
        </div>
        <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,letterSpacing:4,marginBottom:10}}>WORLD CUP 2026</div>
        <h1 style={{fontSize:'clamp(22px,5vw,36px)',fontWeight:900,marginBottom:8}}>🏆 صدارة المتسابقين</h1>
        <p style={{color:'var(--muted)',fontSize:13,fontWeight:700}}>
          {loading ? '⏳ جاري التحميل...' : `${totalCount} متسابق`}
        </p>
      </div>

      {/* ══ PODIUM — يتحمّل بس في الصفحة الأولى ══ */}
      {!loading && currentPage === 1 && !isSearching && top3.length >= 3 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:12,padding:'0 20px 40px',maxWidth:500,margin:'0 auto'}}>
          {[1,0,2].map((rank) => {
            const p = top3[rank];
            const isFirst = rank === 0;
            const podiumH = [190,150,120][rank];
            const cols = [
              {bg:'rgba(217,178,95,.9)',glow:'rgba(217,178,95,.4)',text:'#211708'},
              {bg:'rgba(180,180,190,.7)',glow:'rgba(200,200,210,.25)',text:'#111'},
              {bg:'rgba(180,120,60,.7)',glow:'rgba(180,120,60,.25)',text:'#f4f1e8'},
            ];
            const c = cols[rank];
            return (
              <div key={rank} className="top-float" style={{animationDelay:`${rank*0.3}s`,display:'flex',flexDirection:'column',alignItems:'center',flex:isFirst?1.15:1}}>
                {isFirst && <div style={{fontSize:22,marginBottom:4}}>👑</div>}
                <div style={{width:isFirst?62:50,height:isFirst?62:50,borderRadius:'50%',background:`linear-gradient(135deg,${c.bg},rgba(0,0,0,.3))`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:isFirst?20:16,color:c.text,marginBottom:8,boxShadow:`0 0 20px ${c.glow}`}}>
                  {getInitials(p)}
                </div>
                <div style={{fontWeight:800,fontSize:isFirst?13:11,textAlign:'center',maxWidth:80,lineHeight:1.3,marginBottom:4}}>{getName(p)}</div>
                <div style={{fontSize:isFirst?12:10,color:'var(--gold)',fontWeight:900,marginBottom:6}}>{p.total_points} <span style={{opacity:.7}}>نقطة</span></div>
                <div style={{width:'100%',height:podiumH,background:`linear-gradient(180deg,${c.bg},rgba(0,0,0,.2))`,borderRadius:'12px 12px 0 0',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:10,fontSize:22,boxShadow:`0 -4px 20px ${c.glow}`}}>
                  {medals[rank]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MAIN LIST ══ */}
      <div ref={listRef} style={{maxWidth:700,margin:'0 auto',padding:'0 16px 80px',scrollMarginTop:80}}>

        {/* MY RANK BANNER */}
        {!loading && currentUser && myRank > 0 && (
          <div style={{animation:'slideDown 0.5s cubic-bezier(0.16,1,0.3,1) forwards',background:'linear-gradient(135deg,rgba(217,178,95,.12),rgba(217,178,95,.04))',border:'1px solid rgba(217,178,95,.25)',borderRadius:18,padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:16}}>
            <div style={{fontSize:28,flexShrink:0}}>{myRank<=3?medals[myRank-1]:`#${myRank}`}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>ترتيبك الحالي</div>
              <div style={{fontWeight:900,fontSize:15}}>المركز #{myRank}</div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {/* زر الانتقال لصفحة الترتيب */}
              {!isSearching && myRank > PAGE_SIZE && (
                <button className="nav-pill" onClick={() => goToPage(Math.ceil(myRank / PAGE_SIZE))} style={{padding:'6px 14px',fontSize:12}}>
                  اعرض ترتيبي
                </button>
              )}
              <div style={{textAlign:'center'}}>
                <div style={{fontWeight:900,fontSize:22,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{myPoints}</div>
                <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>نقطة</div>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH */}
        {!loading && totalCount > 5 && (
          <div style={{position:'relative',marginBottom:16}}>
            <input type="text" value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);if(e.target.value) loadAllForSearch();}} placeholder="🔍 ابحث عن لاعب..." className="search-box" />
            {searchQuery && (
              <button onClick={()=>setSearchQuery('')} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:16,padding:4}}>✕</button>
            )}
          </div>
        )}

        {/* INFO BAR */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 4px'}}>
          <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>
            {isSearching
              ? `نتائج البحث (${filteredPlayers.length})`
              : `عرض ${(currentPage-1)*PAGE_SIZE+1}–${Math.min(currentPage*PAGE_SIZE,totalCount)} من ${totalCount}`
            }
          </div>
          {!isSearching && totalPages > 1 && (
            <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>
              صفحة {currentPage} / {totalPages}
            </div>
          )}
        </div>

        {/* SKELETONS */}
        {(loading || pageLoading) && [1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{height:72,marginBottom:8}} />
        ))}

        {/* EMPTY */}
        {!loading && !pageLoading && filteredPlayers.length === 0 && (
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{fontSize:42,marginBottom:12}}>{isSearching ? '🔍' : '🏆'}</div>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>{isSearching ? `لا توجد نتائج لـ "${searchQuery}"` : 'لم يبدأ السباق بعد!'}</div>
            {!isSearching && <Link href="/login" className="nav-pill primary" style={{marginTop:16}}>🔑 كن الأول</Link>}
          </div>
        )}

        {/* ROWS */}
        {!loading && !pageLoading && filteredPlayers.map((player, index) => {
          const isMe = player.user_id === currentUser?.id;
          const globalRank = isSearching
            ? allPlayers.findIndex(p => p.user_id === player.user_id) + 1
            : (currentPage - 1) * PAGE_SIZE + index + 1;
          const pct = maxPoints.current > 0 ? (player.total_points / maxPoints.current) * 100 : 0;
          const delay = `${Math.min(index, 10) * 0.04}s`;
          return (
            <div key={player.user_id} className="player-row" style={{animationDelay:delay,background:isMe?'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))':'linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))',border:`1px solid ${isMe?'rgba(217,178,95,.25)':'var(--line)'}`,borderRadius:16,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
              {/* Rank */}
              <div style={{width:32,textAlign:'center',fontWeight:900,fontSize:globalRank<=3?18:13,color:globalRank<=3?'var(--gold)':'var(--muted)',flexShrink:0}}>
                {globalRank<=3 ? medals[globalRank-1] : `#${globalRank}`}
              </div>
              {/* Avatar */}
              <div style={{width:38,height:38,borderRadius:'50%',background:isMe?'linear-gradient(135deg,rgba(217,178,95,.3),rgba(217,178,95,.1))':'var(--surface-3)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:isMe?'var(--gold)':'var(--muted)',flexShrink:0,border:isMe?'1px solid rgba(217,178,95,.3)':'1px solid var(--line)'}}>
                {getInitials(player)}
              </div>
              {/* Name + bar */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:5}}>
                  <span style={{fontWeight:800,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getName(player)}</span>
                  {isMe && <span style={{fontSize:10,padding:'1px 7px',borderRadius:999,background:'rgba(217,178,95,.15)',color:'#ffe3a6',fontWeight:700}}>أنت</span>}
                  {player.profile_completed && <span style={{fontSize:10,color:'var(--green)',fontWeight:700}}>✓</span>}
                  <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,marginRight:'auto'}}>{player.predictions_count} توقع</span>
                </div>
                <div style={{height:4,borderRadius:999,background:'rgba(255,255,255,.06)',overflow:'hidden'}}>
                  <div className={animated?'bar-fill':''} style={{height:'100%',borderRadius:999,background:isMe?'linear-gradient(90deg,#d9b25f,#a8761a)':'linear-gradient(90deg,rgba(217,178,95,.5),rgba(217,178,95,.2))',width:animated?`${pct}%`:'0%',animationDelay:delay}} />
                </div>
              </div>
              {/* Points */}
              <div style={{textAlign:'center',flexShrink:0}}>
                <div style={{fontWeight:900,fontSize:16,color:isMe?'var(--gold)':'var(--text)',fontVariantNumeric:'tabular-nums'}}>{player.total_points}</div>
                <div style={{fontSize:10,color:'var(--muted)',fontWeight:700}}>نقطة</div>
              </div>
            </div>
          );
        })}

        {/* ══ PAGINATION ══ */}
        {!loading && !isSearching && totalPages > 1 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:28,flexWrap:'wrap'}}>
            {/* السابق */}
            <button className="pg-btn" onClick={()=>goToPage(currentPage-1)} disabled={currentPage===1} title="الصفحة السابقة">
              ›
            </button>

            {/* أرقام */}
            {getPageNumbers().map((pg, i) =>
              pg === '...'
                ? <span key={`dot-${i}`} style={{color:'var(--muted)',fontSize:13,padding:'0 4px'}}>…</span>
                : <button key={pg} className={`pg-btn ${currentPage===pg?'active':''}`} onClick={()=>goToPage(pg as number)}>
                    {pg}
                  </button>
            )}

            {/* التالي */}
            <button className="pg-btn" onClick={()=>goToPage(currentPage+1)} disabled={currentPage===totalPages} title="الصفحة التالية">
              ‹
            </button>
          </div>
        )}

        {/* ✅ CTA للزوار */}
        {!loading && !currentUser && totalCount > 0 && (
          <div style={{textAlign:'center',marginTop:32,padding:'28px 24px',background:'linear-gradient(135deg,rgba(217,178,95,.08),rgba(217,178,95,.03))',border:'1px solid rgba(217,178,95,.15)',borderRadius:20}}>
            <div style={{fontSize:38,marginBottom:10}}>🏆</div>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>انضم وتنافس معهم!</div>
            <div style={{color:'var(--muted)',fontSize:13,marginBottom:20,lineHeight:1.7}}>سجّل دخولك وابدأ توقعاتك مجاناً</div>
            <Link href="/login" className="nav-pill primary">🔑 سجّل دخولك الآن</Link>
          </div>
        )}
      </div>
    </>
  );
}
