'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState({ users: 0, predictions: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setIsLoggedIn(true);
    });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: users }, { count: predictions }] = await Promise.all([
        supabase.from('user_points').select('*', { count: 'exact', head: true }),
        supabase.from('predictions').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ users: users || 0, predictions: predictions || 0 });
      setStatsLoaded(true);
    };
    fetchStats();
  }, []);

  const pointsCards = [
    { pts: '+10', label: 'نتيجة كاملة', icon: '🎯', desc: 'النتيجة الدقيقة بالأهداف' },
    { pts: '+5',  label: 'الفائز / تعادل', icon: '✅', desc: 'توقعت مين هيفوز أو تعادل' },
    { pts: '+3',  label: 'أول هدف', icon: '⚽', desc: 'توقعت أول هداف في الماتش' },
    { pts: '+2',  label: 'وقت إضافي', icon: '⏱️', desc: 'الماتش راح لوقت إضافي' },
    { pts: '+2',  label: 'كرت أحمر', icon: '🟥', desc: 'كان فيه كرت أحمر في الماتش' },
    { pts: '+2',  label: 'ركلة جزاء', icon: '🥅', desc: 'كان فيه بينالتي في الماتش' },
    { pts: '+2',  label: 'الفريقين سجّلا', icon: '🔄', desc: 'كلا الفريقين سجّل هدفاً' },
  ];

  const steps = [
    { n: '01', title: 'سجّل دخولك', desc: 'عن طريق الإيميل أو فيسبوك أو رقم الموبايل' },
    { n: '02', title: 'توقّع نتائج الماتشات', desc: 'اختار الفائز وسجّل التوقعات قبل صافرة البداية' },
    { n: '03', title: 'احصد النقاط وتصدّر', desc: 'كل توقع صح بيضيف نقاط وترتفع في الصدارة' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        :root{
          --bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;
          --line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;
          --gold:#d9b25f;--red:#c93a2f;--green:#27b06e;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);color:var(--text);font-family:'Cairo',sans-serif;direction:rtl;min-height:100vh;overflow-x:hidden}
        a{text-decoration:none;color:inherit}

        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(217,178,95,.15)}50%{box-shadow:0 0 40px rgba(217,178,95,.35)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes rotateBorder{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

        .fade-up{animation:fadeUp .6s ease forwards}
        .fade-up-d1{animation:fadeUp .6s .1s ease both}
        .fade-up-d2{animation:fadeUp .6s .2s ease both}
        .fade-up-d3{animation:fadeUp .6s .3s ease both}

        .cta-btn{
          display:inline-flex;align-items:center;gap:8px;
          padding:14px 32px;border-radius:999px;font-family:'Cairo',sans-serif;
          font-size:15px;font-weight:800;cursor:pointer;border:none;
          transition:opacity .18s,transform .18s;
        }
        .cta-btn:hover{opacity:.88;transform:translateY(-1px)}
        .cta-btn.primary{background:linear-gradient(135deg,#d9b25f,#a8761a);color:#0a0800}
        .cta-btn.secondary{background:transparent;border:1.5px solid rgba(217,178,95,.35);color:var(--gold)}
        .cta-btn.dashboard{
          background:linear-gradient(135deg,rgba(39,176,110,.2),rgba(39,176,110,.08));
          border:1.5px solid rgba(39,176,110,.35);color:#94f0c0;
        }

        .logo-hero-wrap{
          position:relative;
          width:160px;height:160px;
          display:flex;align-items:center;justify-content:center;
          animation:logoFloat 4s ease-in-out infinite;
          margin-bottom:28px;
        }
        .logo-hero-wrap::before{
          content:'';
          position:absolute;inset:-3px;
          border-radius:50%;
          background:conic-gradient(rgba(217,178,95,.6),rgba(217,178,95,.1),rgba(217,178,95,.6));
          animation:rotateBorder 4s linear infinite;
          z-index:0;
        }
        .logo-hero-wrap::after{
          content:'';
          position:absolute;inset:0;
          border-radius:50%;
          background:var(--bg);
          z-index:1;
        }
        .logo-hero-img{
          position:relative;z-index:2;
          width:130px;height:130px;
          object-fit:contain;
          background:transparent;
          border-radius:50%;
          padding:8px;
        }

        .pts-card{
          background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
          border:1px solid var(--line);border-radius:16px;padding:16px;
          text-align:center;transition:border-color .2s,transform .2s;
        }
        .pts-card:hover{border-color:rgba(217,178,95,.25);transform:translateY(-2px)}

        .step-card{
          background:var(--surface);border:1px solid var(--line);
          border-radius:18px;padding:20px 22px;
          display:flex;gap:16px;align-items:flex-start;
          transition:border-color .2s;
        }
        .step-card:hover{border-color:rgba(217,178,95,.2)}

        .stat-skeleton{
          background:linear-gradient(90deg,var(--line) 25%,rgba(255,255,255,.06) 50%,var(--line) 75%);
          background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;
          border-radius:8px;display:inline-block;width:52px;height:22px;
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{
        position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100,
        background: 'rgba(7,8,9,.88)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(217,178,95,.25)', background: 'rgba(217,178,95,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/logo-FF.png" alt="الشمعدان" width={28} height={28} loading="eager"
              style={{ objectFit: 'contain', width: 26, height: 26 }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)' }}>الشمعدان</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="cta-btn dashboard" style={{ padding: '8px 18px', fontSize: 13 }}>← داشبوردي</Link>
              <Link href="/leaderboard" className="cta-btn secondary" style={{ padding: '8px 18px', fontSize: 13 }}>🏆 الصدارة</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="cta-btn primary" style={{ padding: '8px 18px', fontSize: 13 }}>ابدأ الآن</Link>
              <Link href="/leaderboard" className="cta-btn secondary" style={{ padding: '8px 18px', fontSize: 13 }}>🏆 الصدارة</Link>
            </>
          )}
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '100px 20px 60px',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(217,178,95,.08) 0%, transparent 70%), var(--bg)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', border: '1px solid rgba(217,178,95,.04)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(217,178,95,.06)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

        <div className="fade-up logo-hero-wrap">
          <img
            src="/logo-FF.png"
            alt="شعار الشمعدان"
            className="logo-hero-img"
          />
        </div>

        <div className="fade-up-d1">
          <div style={{ fontSize: 'clamp(11px,2.5vw,13px)', color: 'var(--gold)', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>
            الشمعدان × كأس العالم 2026
          </div>
          <h1 style={{ fontSize: 'clamp(26px,7vw,54px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>
            توقّع. تنافس.{' '}
            <span style={{ background: 'linear-gradient(90deg,#d9b25f,#ffe9a0,#d9b25f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              تصدّر.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(14px,2.5vw,16px)', color: 'var(--muted)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.9 }}>
            لعبة توقعات كأس العالم الأكثر إثارة — توقّع نتائج الماتشات واجمع نقاط وتنافس مع أصحابك في ليجات خاصة
          </p>
        </div>

        <div className="fade-up-d2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 52 }}>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="cta-btn dashboard" style={{ animation: 'glow 3s ease-in-out infinite' }}>← ادخل داشبوردك</Link>
              <Link href="/leaderboard" className="cta-btn secondary">🏆 الصدارة</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="cta-btn primary" style={{ animation: 'glow 3s ease-in-out infinite' }}>⚽ ابدأ التوقعات</Link>
              <Link href="/leaderboard" className="cta-btn secondary">🏆 الصدارة</Link>
            </>
          )}
        </div>

        <div className="fade-up-d3" style={{ display: 'flex', gap: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { value: stats.users, label: 'متسابق مسجّل', icon: '👥', dynamic: true },
            { value: stats.predictions, label: 'توقع مقدَّم', icon: '📊', dynamic: true },
            { value: 48, label: 'منتخب مشارك', icon: '🌍', dynamic: false },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--gold)', minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.dynamic && !statsLoaded ? <span className="stat-skeleton" /> : s.value.toLocaleString('ar-EG')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', animation: 'pulse 2s ease-in-out infinite', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>↓ اكتشف المزيد</div>
      </section>

      {/* ══ POINTS SECTION ══ */}
      <section style={{ padding: 'clamp(48px,8vw,96px) 20px', maxWidth: 840, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>نظام النقاط</div>
          <h2 style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 900, marginBottom: 10 }}>كل توقع صح = نقاط 🎯</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.8 }}>كلما كانت توقعاتك أدق، كلما تصدّرت الصدارة أسرع</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
          {pointsCards.map((c, i) => (
            <div key={i} className="pts-card">
              <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{c.pts}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section style={{ padding: 'clamp(48px,8vw,96px) 20px', maxWidth: 620, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>كيف تلعب؟</div>
          <h2 style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 900 }}>3 خطوات بس 🚀</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => (
            <div key={i} className="step-card">
              <div style={{ fontWeight: 900, fontSize: 28, color: 'rgba(217,178,95,.25)', flexShrink: 0, lineHeight: 1 }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section style={{
        maxWidth: 580, marginInline: 'auto', marginBottom: 80,
        background: 'linear-gradient(135deg,rgba(217,178,95,.1),rgba(217,178,95,.04))',
        border: '1px solid rgba(217,178,95,.2)', borderRadius: 24,
        padding: 'clamp(32px,6vw,52px) 32px', textAlign: 'center',
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(217,178,95,.06)', border: '1px solid rgba(217,178,95,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <img src="/logo-FF.png" alt="الشمعدان" width={56} height={56} loading="lazy"
            style={{ objectFit: 'contain', width: 52, height: 52 }} />
        </div>
        <h2 style={{ fontSize: 'clamp(17px,4vw,24px)', fontWeight: 900, marginBottom: 10 }}>جاهز تثبت إنك أحسن محلل؟</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28, lineHeight: 1.8 }}>سجّل دخولك دلوقتي وابدأ توقعاتك — مجاناً تماماً</p>
        {isLoggedIn
          ? <Link href="/dashboard" className="cta-btn dashboard">← ادخل داشبوردك</Link>
          : <Link href="/login" className="cta-btn primary">🏆 انضم الآن مجاناً</Link>
        }
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(217,178,95,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo-FF.png" alt="الشمعدان" width={22} height={22} loading="lazy" style={{ objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--gold)' }}>الشمعدان</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>© 2026 الشمعدان — كأس العالم</p>
      </footer>
    </>
  );
}
