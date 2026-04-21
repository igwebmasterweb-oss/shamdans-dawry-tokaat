'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="fifa-admin" dir="rtl" style={{minHeight:'100vh'}}>

      {/* Nav */}
      <nav style={{
        position:'fixed',top:0,left:0,right:0,zIndex:50,
        background:'rgba(7,8,9,.85)',
        backdropFilter:'blur(12px)',
        borderBottom:'1px solid var(--fifa-line)',
      }}>
        <div style={{maxWidth:960,margin:'0 auto',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{
              width:36,height:36,borderRadius:10,
              background:'linear-gradient(135deg,#f0cf84,#a97b26)',
              display:'grid',placeItems:'center',
              fontSize:18,boxShadow:'0 4px 12px rgba(217,178,95,.25)',
            }}>🏆</div>
            <span style={{fontWeight:900,color:'var(--fifa-gold)',fontSize:16}}>الشمعدان</span>
            <span style={{color:'var(--fifa-muted)'}}>×</span>
            <span style={{fontWeight:700,color:'var(--fifa-text)',fontSize:15}}>كأس العالم 2026</span>
          </div>
          <Link href="/login">
            <button className="fifa-btn fifa-btn-gold" style={{padding:'10px 22px',fontSize:13}}>
              سجّل دلوقتي
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        minHeight:'100vh',padding:'80px 20px 40px',textAlign:'center',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',display:'flex',flexDirection:'column',gap:32}}>

          {/* Badge */}
          <div style={{display:'inline-flex',alignSelf:'center',alignItems:'center',gap:8,
            background:'rgba(217,178,95,.10)',border:'1px solid rgba(217,178,95,.25)',
            color:'#f2d79e',fontSize:12,fontWeight:700,padding:'8px 16px',borderRadius:999,
          }}>
            <span style={{width:7,height:7,borderRadius:'50%',background:'var(--fifa-gold)',
              display:'inline-block',animation:'pulse 1.5s infinite'}}/>
            كأس العالم 2026 — المكسيك · كندا · الولايات المتحدة
          </div>

          {/* Title */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <span style={{fontSize:72}}>🏆</span>
            <h1 style={{fontSize:'clamp(48px,8vw,80px)',fontWeight:900,color:'var(--fifa-text)',lineHeight:1.1,margin:0}}>
              الشمعدان
            </h1>
            <p style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,color:'var(--fifa-gold)',margin:0}}>
              × كأس العالم 2026
            </p>
          </div>

          {/* Tagline */}
          <p style={{fontSize:'clamp(16px,2.5vw,20px)',color:'var(--fifa-muted)',lineHeight:1.7,margin:0}}>
            أحلى من الماتش.. اللي بيحصل جنبيه
          </p>

          {/* Points system */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {[
              {icon:'🏆',label:'نتيجة كاملة',pts:'10'},
              {icon:'✅',label:'الفايز صح',  pts:'5' },
              {icon:'⚽',label:'أول هدف',    pts:'+3'},
              {icon:'🎯',label:'سؤال المفاجأة',pts:'+5'},
            ].map(item => (
              <div key={item.label} className="fifa-stat" style={{padding:'16px 10px'}}>
                <p style={{fontSize:26,margin:'0 0 6px'}}>{item.icon}</p>
                <p style={{fontSize:22,fontWeight:900,color:'var(--fifa-gold)',margin:'0 0 4px'}}>{item.pts}</p>
                <p style={{fontSize:11,color:'var(--fifa-muted)',margin:0}}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="fifa-panel" style={{textAlign:'right',padding:'20px 24px'}}>
            <p style={{fontSize:13,fontWeight:800,color:'var(--fifa-text)',marginBottom:14}}>⚡ إزاي اللعبة؟</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {n:'١',t:'قبل الماتش تدخل توقعاتك (النتيجة، أول هدف، سؤال مفاجأة)'},
                {n:'٢',t:'بعد الماتش بيتحسبلك النقاط أوتوماتيك'},
                {n:'٣',t:'اللي بيعمل أعلى نقاط في آخر المونديال هو الشمعدان 🏆'},
              ].map(s => (
                <div key={s.n} style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <span style={{
                    width:24,height:24,borderRadius:'50%',background:'var(--fifa-gold-soft)',
                    border:'1px solid rgba(217,178,95,.3)',color:'var(--fifa-gold)',
                    fontSize:11,fontWeight:900,display:'grid',placeItems:'center',flexShrink:0,marginTop:1,
                  }}>{s.n}</span>
                  <p style={{fontSize:13,color:'var(--fifa-muted)',margin:0,lineHeight:1.6}}>{s.t}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <Link href="/login" style={{width:'100%',maxWidth:360}}>
              <button className="fifa-btn fifa-btn-gold" style={{
                width:'100%',fontSize:18,fontWeight:900,
                padding:'18px 32px',borderRadius:20,
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              }}>
                ابدأ التوقعات دلوقتي
                <span style={{fontSize:22}}>🔥</span>
              </button>
            </Link>
            <p style={{fontSize:12,color:'var(--fifa-muted)',margin:0}}>
              مفيش باسورد — رابط على إيميلك وبس 🔐
            </p>
          </div>

        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1} 50%{opacity:.4}
        }
        @media(max-width:500px){
          .pts-grid{grid-template-columns:1fr 1fr!important}
        }
      `}</style>
    </div>
  );
}
