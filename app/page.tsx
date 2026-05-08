'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0f1e 0%,#1a0a2e 50%,#0a1628 100%)',color:'#fff',fontFamily:'Tajawal,Cairo,sans-serif',direction:'rtl'}}>

      {/* Nav */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:24}}>🏆</span>
          <span style={{fontWeight:800,fontSize:16}}>الشمعدان &nbsp;×&nbsp; كأس العالم 2026</span>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Link href="/leaderboard" style={{padding:'8px 18px',borderRadius:100,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.8)',fontWeight:700,textDecoration:'none',fontSize:13,fontFamily:'Tajawal,sans-serif'}}>
            🏁 الصدارة
          </Link>
          <Link href="/login" style={{padding:'8px 18px',borderRadius:100,background:'linear-gradient(135deg,#e8002d,#b8001d)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:13,fontFamily:'Tajawal,sans-serif'}}>
            سجّل دلوقتي
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{textAlign:'center',padding:'60px 20px 40px'}}>

        {/* Badge */}
        <div style={{display:'inline-block',padding:'6px 18px',borderRadius:100,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',fontSize:12,marginBottom:24,color:'rgba(255,255,255,0.7)'}}>
          كأس العالم 2026 — المكسيك · كندا · الولايات المتحدة
        </div>

        {/* Title */}
        <div style={{fontSize:48,marginBottom:8}}>🏆</div>
        <h1 style={{fontSize:'clamp(2.5rem,8vw,5rem)',fontWeight:900,margin:'0 0 8px',lineHeight:1.1}}>الشمعدان</h1>
        <h2 style={{fontSize:'clamp(1rem,3vw,1.5rem)',fontWeight:400,margin:'0 0 24px',color:'rgba(255,255,255,0.5)'}}>× كأس العالم 2026</h2>

        {/* Tagline */}
        <p style={{fontSize:'clamp(1rem,2.5vw,1.25rem)',color:'rgba(255,255,255,0.7)',marginBottom:40}}>
          أحلى من الماتش.. اللي بيحصل جنبيه
        </p>

        {/* Points system */}
        <div className="pts-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,maxWidth:600,margin:'0 auto 40px'}}>
          {[
            {icon:'🏆',label:'نتيجة كاملة',pts:'10'},
            {icon:'✅',label:'الفايز صح',   pts:'5' },
            {icon:'⚽',label:'أول هدف',      pts:'+3'},
            {icon:'🎯',label:'سؤال المفاجأة',pts:'+5'},
          ].map(item => (
            <div key={item.label} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'16px 8px',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:6}}>{item.icon}</div>
              <div style={{fontSize:22,fontWeight:900,color:'#fbbf24',marginBottom:4}}>{item.pts}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{maxWidth:500,margin:'0 auto 40px',textAlign:'right'}}>
          <h3 style={{textAlign:'center',marginBottom:20,fontSize:18,fontWeight:700}}>⚡ إزاي اللعبة؟</h3>
          {[
            {n:'١',t:'قبل الماتش تدخل توقعاتك (النتيجة، أول هدف، سؤال مفاجأة)'},
            {n:'٢',t:'بعد الماتش بيتحسبلك النقاط أوتوماتيك'},
            {n:'٣',t:'اللي بيعمل أعلى نقاط في آخر المونديال هو الشمعدان 🏆'},
          ].map(s => (
            <div key={s.n} style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:14}}>
              <div style={{minWidth:32,height:32,borderRadius:'50%',background:'rgba(232,0,45,0.2)',border:'1px solid rgba(232,0,45,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#ff6b6b',flexShrink:0}}>{s.n}</div>
              <p style={{margin:0,fontSize:14,color:'rgba(255,255,255,0.7)',lineHeight:1.6,paddingTop:4}}>{s.t}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href="/login" style={{padding:'14px 36px',borderRadius:100,background:'linear-gradient(135deg,#e8002d,#b8001d)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:16,fontFamily:'Tajawal,sans-serif',boxShadow:'0 4px 20px rgba(232,0,45,0.35)'}}>
            ابدأ التوقعات دلوقتي 🔥
          </Link>
          <Link href="/leaderboard" style={{padding:'14px 36px',borderRadius:100,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.85)',fontWeight:800,textDecoration:'none',fontSize:16,fontFamily:'Tajawal,sans-serif'}}>
            🏁 شوف الصدارة
          </Link>
        </div>

        <p style={{marginTop:16,fontSize:12,color:'rgba(255,255,255,0.3)'}}>
          مفيش باسورد — رابط على إيميلك وبس 🔐
        </p>
      </section>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @media(max-width:500px){ .pts-grid{ grid-template-columns:1fr 1fr!important } }
      `}</style>
    </main>
  );
}
