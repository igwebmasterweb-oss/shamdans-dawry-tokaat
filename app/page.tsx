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
    { pts: '+10', label: 'نتيجة كاملة', icon: '🎯', desc: 'توقعت النتيجة النهائية بدقة.' },
    { pts: '+5', label: 'فائز أو تعادل', icon: '✅', desc: 'اخترت اتجاه النتيجة بشكل صحيح.' },
    { pts: '+3', label: 'أول هداف', icon: '⚽', desc: 'توقعت أول لاعب يسجل. واذا كان من ضمن المسجلين +1' },
    { pts: '+3', label: 'كرت أحمر', icon: '🟥', desc: 'توقعت وجود بطاقة حمراء.' },
    { pts: '+3', label: 'ركلة جزاء', icon: '🥅', desc: 'توقعت وجود ركلة جزاء.' },
  ];

  const steps = [
    { n: '01', title: 'سجل وكمل حسابك', desc: 'ابدأ التسجيل واستفد من نقاط المكافآت المرتبطة بالحساب.' },
    { n: '02', title: 'توقع قبل البداية', desc: 'اختار النتيجة والعناصر الإضافية قبل انطلاق المباراة ويمكنك التعديل قبل الإغلاق.' },
    { n: '03', title: 'تابع نقاطك وتصدر', desc: 'بعد اعتماد النتائج تظهر نقاطك في الحساب والترتيب العام والميني ليج.' },
  ];

  const prizes = [
    {
      phase: 'المرحلة الأولى',
      date: '17 يونيو 2026',
      desc: 'نهاية الجولة الأولى في المجموعات، وعند التساوي تُقسم الجائزة.',
      reward: '5,000 جنيه',
      icon: '🏅',
    },
    {
      phase: 'المرحلة الثانية',
      date: '23 يونيو 2026',
      desc: 'نهاية الجولة الثانية في المجموعات، وعند التساوي تُقسم الجائزة.',
      reward: '5,000 جنيه',
      icon: '🏅',
    },
    {
      phase: 'المرحلة الثالثة',
      date: '27 يونيو 2026',
      desc: 'نهاية دور المجموعات، وعند التساوي تُقسم الجائزة.',
      reward: '5,000 جنيه',
      icon: '🏅',
    },
    {
      phase: 'دور الـ 32',
      date: '3 يوليو 2026',
      desc: 'أعلى نقاط في هذه المرحلة يحصل على الجائزة.',
      reward: '5,000 جنيه',
      icon: '🏅',
    },
  ];

  const grandPrizes = [
    { rank: '🥇 المركز الأول', reward: '3 سبائك ذهب' },
    { rank: '🥈 المركز الثاني', reward: '2 سبيكة ذهب' },
    { rank: '🥉 المركز الثالث', reward: '1 سبيكة ذهب' },
  ];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

        :root{
          --bg:#070809;
          --surface:#111315;
          --surface-2:#171a1d;
          --line:rgba(255,255,255,.08);
          --text:#f4f1e8;
          --muted:#a8a39a;
          --gold:#d9b25f;
          --green:#27b06e;
        }

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        body{
          background:var(--bg);
          color:var(--text);
          font-family:'Cairo',sans-serif;
          direction:rtl;
          min-height:100vh;
          overflow-x:hidden;
          -webkit-font-smoothing:antialiased;
          -moz-osx-font-smoothing:grayscale;
          text-rendering:optimizeLegibility;
        }

        a{text-decoration:none;color:inherit}

        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
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
          margin:0 auto 28px;
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

        .pts-card,.step-card,.phase-card,.callout-card,.stat-card,.gold-card{
          background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
          border:1px solid var(--line);
          border-radius:18px;
        }

        .pts-card{
          padding:16px;
          text-align:center;
          transition:border-color .2s,transform .2s;
        }

        .pts-card:hover,.step-card:hover,.phase-card:hover,.gold-card:hover{border-color:rgba(217,178,95,.25);transform:translateY(-2px)}

        .step-card{
          padding:20px;
          display:flex;
          gap:14px;
          align-items:flex-start;
          transition:border-color .2s,transform .2s;
        }

        .phase-card{
          padding:18px 18px 16px;
          display:flex;
          flex-direction:column;
          gap:14px;
          min-height:170px;
          transition:border-color .2s,transform .2s;
        }

        .callout-card{padding:18px 20px;margin-top:18px}
        .stat-card{padding:18px 16px}
        .gold-card{padding:24px 18px;text-align:center;transition:border-color .2s,transform .2s}

        .stat-skeleton{
          background:linear-gradient(90deg,var(--line) 25%,rgba(255,255,255,.06) 50%,var(--line) 75%);
          background-size:200% 100%;
          animation:shimmer 1.5s ease-in-out infinite;
          border-radius:8px;
          display:inline-block;
          width:52px;
          height:22px;
        }

        .wc-bg-img{
          position:absolute;
          bottom:0;
          left:50%;
          transform:translateX(-50%);
          width:min(420px,80vw);
          opacity:0.15;
          pointer-events:none;
          user-select:none;
          filter:grayscale(1);
          z-index:0;
        }

        .topbar-inner{
          position:relative;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          min-height:78px;
          padding:16px 0;
        }

        .brand-center{
          position:absolute;
          left:50%;
          transform:translateX(-50%);
          display:flex;
          align-items:center;
          gap:12px;
          text-align:center;
        }

        .ghost-space{width:160px}

        @media (max-width:760px){
          .topbar-inner{
            display:flex;
            flex-direction:column;
            justify-content:center;
            min-height:auto;
            padding:16px 0 18px;
          }
          .brand-center{
            position:static;
            transform:none;
            order:1;
            margin-bottom:6px;
          }
          .nav-actions{order:2;justify-content:center !important}
          .ghost-space{display:none}
        }
      `}</style>

      <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            backdropFilter: 'blur(12px)',
            background: 'rgba(7,8,9,.72)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
            <div className="topbar-inner">
              <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {isLoggedIn ? (
                  <>
                    <Link href="/dashboard" className="cta-btn dashboard">
                      ← داشبوردي
                    </Link>
                    <Link href="/leaderboard" className="cta-btn secondary">
                      🏆 الصدارة
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="cta-btn primary">
                      ابدأ الآن
                    </Link>
                    <Link href="/leaderboard" className="cta-btn secondary">
                      الصدارة
                    </Link>
                  </>
                )}
              </div>

              <div className="brand-center">
                <img
                  src="/logo-FF.png"
                  alt="الشمعدان"
                  style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: '50%' }}
                />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>الشمعدان</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>دوري توقعات كأس العالم 2026</div>
                </div>
              </div>

              <div className="ghost-space" />
            </div>
          </div>
        </header>

        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '72px 20px 60px',
            textAlign: 'center',
          }}
        >
          <img src="/world-cup-bg.png" alt="" className="wc-bg-img" />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 980, margin: '0 auto' }}>
            <div className="logo-hero-wrap fade-up">
              <img src="/logo-FF.png" alt="شعار الشمعدان" className="logo-hero-img" />
            </div>

            <div
              className="fade-up-d1"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(217,178,95,.18)',
                background: 'rgba(217,178,95,.08)',
                color: 'var(--gold)',
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              الشمعدان × كأس العالم 2026
            </div>

            <h1
              className="fade-up-d1"
              style={{
                fontSize: 'clamp(34px,6vw,68px)',
                lineHeight: 1.15,
                fontWeight: 900,
                marginBottom: 14,
              }}
            >
              سجل. توقع. <span style={{ color: 'var(--gold)' }}>اجمع نقاط واتصدر.</span>
            </h1>

            <p
              className="fade-up-d2"
              style={{
                maxWidth: 760,
                margin: '0 auto 26px',
                color: 'var(--muted)',
                fontSize: 'clamp(15px,2vw,20px)',
                lineHeight: 1.9,
              }}
            >
              لعبة توقعات كأس العالم الأكثر إثارة — توقّع نتائج الماتشات واجمع نقاط، نافس على الجوائز الكبرى
              وسبائك الذهب، وادخل ميني ليج خاصة مع أصحابك.
            </p>

            <div
              className="fade-up-d3"
              style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 34 }}
            >
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="cta-btn dashboard">
                    ← ادخل داشبوردك
                  </Link>
                  <Link href="/leaderboard" className="cta-btn secondary">
                    🏆 الصدارة
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="cta-btn primary">
                    ⚽ ابدأ التوقعات
                  </Link>
                  <Link href="/leaderboard" className="cta-btn secondary">
                    🏆 الصدارة
                  </Link>
                </>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                gap: 14,
                maxWidth: 860,
                margin: '0 auto',
              }}
            >
              {[
                { value: stats.users, label: 'متسابق مسجل', icon: '👥', dynamic: true },
                { value: stats.predictions, label: 'توقع مقدم', icon: '📊', dynamic: true },
                { value: 48, label: 'منتخب مشارك', icon: '🌍', dynamic: false },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', minHeight: 36 }}>
                    {s.dynamic && !statsLoaded ? (
                      <span className="stat-skeleton" />
                    ) : (
                      s.value.toLocaleString('ar-EG')
                    )}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 14 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '44px 20px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 8 }}>نظام النقاط</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.2, marginBottom: 10 }}>كل توقع صح = نقاط</h2>
              <p style={{ maxWidth: 760, margin: '0 auto', color: 'var(--muted)', lineHeight: 1.9 }}>
                النسخة دي محافظة على نفس الشكل العام تقريبًا، لكن بالمحتوى المطلوب وبطريقة أخف على الصفحة الأولى.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 14,
              }}
            >
              {pointsCards.map((c, i) => (
                <div key={i} className="pts-card">
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{c.pts}</div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{c.desc}</div>
                </div>
              ))}
            </div>

            <div className="callout-card">
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.9 }}>
                <strong style={{ color: 'var(--text)' }}>حتى 25 نقطة</strong> في المباراة الواحدة، ويمكنك تعديل
                توقعك قبل بداية المباراة. الخطأ في توقع <strong style={{ color: 'var(--text)' }}>الكرت الأحمر</strong>{' '}
                أو <strong style={{ color: 'var(--text)' }}>ركلة الجزاء</strong> ={' '}
                <strong style={{ color: 'var(--text)' }}>-1 نقطة</strong>، وبعد اعتماد النتائج تتم إضافة النقاط إلى
                حسابك تلقائيًا.
              </p>
            </div>

            <div className="callout-card">
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.9 }}>
                <strong style={{ color: 'var(--text)' }}>مكافآت إضافية:</strong> +5 نقاط عند استكمال الملف الشخصي، +5
                نقاط لكل دعوة ناجحة من رابطك، وبحد أقصى 50 نقطة من الدعوات. واذا كنت من مشاركي مسابقة حلمك فيها هتاخد بونص توصل ل 50 نقطة
              </p>
            </div>
          </div>
        </section>

        <section style={{ padding: '44px 20px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 8 }}>كيف تلعب؟</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.2, marginBottom: 10 }}>3 خطوات فقط</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              {steps.map((s, i) => (
                <div key={i} className="step-card">
                  <div
                    style={{
                      minWidth: 46,
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(217,178,95,.12)',
                      border: '1px solid rgba(217,178,95,.22)',
                      color: 'var(--gold)',
                      fontWeight: 900,
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{s.title}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.8 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '44px 20px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 8 }}>الجوائز</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.2, marginBottom: 10 }}>جوائز حقيقية طوال البطولة</h2>
              <p style={{ maxWidth: 760, margin: '0 auto', color: 'var(--muted)', lineHeight: 1.9 }}>
                تم ترتيب بطاقات الجوائز في صفين، كل صف فيه بطاقتان، مع وضع التاريخ في سطر منفصل والجائزة في آخر
                البطاقة بشكل أوضح.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                gap: 16,
              }}
            >
              {prizes.map((p, i) => (
                <div
                  key={i}
                  className="phase-card"
                  style={{ gridColumn: typeof window === 'undefined' ? undefined : undefined }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 14,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(217,178,95,.12)',
                        border: '1px solid rgba(217,178,95,.24)',
                        fontSize: 22,
                        flex: '0 0 auto',
                      }}
                    >
                      {p.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, lineHeight: 1.4, marginBottom: 4, fontWeight: 900 }}>{p.phase}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.8 }}>{p.desc}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 'auto',
                      paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,.06)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{p.date}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{p.reward}</div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: '24px 20px',
                borderRadius: 22,
                border: '1px solid rgba(217,178,95,.18)',
                background: 'linear-gradient(180deg,rgba(217,178,95,.06),rgba(255,255,255,.015))',
              }}
            >
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 8 }}>الجائزة الكبرى — 19 يوليو 2026</div>
              <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', marginBottom: 0 }}>سبائك ذهب لأصحاب المراكز الأولى</h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                  gap: 16,
                  marginTop: 16,
                }}
              >
                {grandPrizes.map((g, i) => (
                  <div key={i} className="gold-card">
                    <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{g.rank}</div>
                    <div style={{ fontSize: 24, color: 'var(--gold)', fontWeight: 900 }}>{g.reward}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  maxWidth: 980,
                  margin: '22px auto 0',
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(39,176,110,.08)',
                  border: '1px solid rgba(39,176,110,.2)',
                  color: '#a9eac7',
                  fontSize: 13,
                }}
              >
                الجائزة الكبرى تراكمية من بداية البطولة حتى نهايتها، لذلك كل نقطة تفرق في السباق النهائي.
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: '10px 20px 78px' }}>
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              border: '1px solid rgba(217,178,95,.18)',
              borderRadius: 28,
              background: 'linear-gradient(180deg,rgba(217,178,95,.07),rgba(255,255,255,.02))',
              padding: '34px 22px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>الشمعدان</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, marginBottom: 12 }}>
              جاهز تثبت إنك أحسن محلل؟
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: 720, margin: '0 auto 20px', lineHeight: 1.9 }}>
              سجّل دخولك دلوقتي وابدأ توقعاتك مجانًا، واجمع نقاطك من المباريات والمكافآت ونافس على الجوائز
              الكبرى حتى نهاية كأس العالم.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {isLoggedIn ? (
                <Link href="/dashboard" className="cta-btn dashboard">
                  ← ادخل داشبوردك
                </Link>
              ) : (
                <Link href="/auth" className="cta-btn primary">
                  🏆 انضم الآن مجاناً
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
