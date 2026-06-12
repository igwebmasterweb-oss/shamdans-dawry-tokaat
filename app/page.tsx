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
    { pts: '+10', label: 'نتيجة كاملة', icon: '🎯', desc: 'توقعت النتيجة الدقيقة بالأهداف كما انتهت المباراة' },
    { pts: '+5', label: 'فائز أو تعادل', icon: '✅', desc: 'توقعت الفائز أو التعادل بشكل صحيح بدون النتيجة الكاملة' },
    { pts: '+3', label: 'أول هداف', icon: '⚽', desc: 'توقعت اسم أول هداف في المباراة بشكل صحيح' },
    { pts: '+3', label: 'كرت أحمر', icon: '🟥', desc: 'توقعت وجود بطاقة حمراء في المباراة بشكل صحيح' },
    { pts: '+3', label: 'ركلة جزاء', icon: '🥅', desc: 'توقعت وجود ركلة جزاء في المباراة بشكل صحيح' },
  ];

  const bonusCards = [
    { pts: '+5', label: 'استكمال الملف الشخصي', icon: '👤', desc: 'أضف اسم الظهور ورقم الموبايل وربط حساب فيسبوك' },
    { pts: '+5', label: 'كل دعوة ناجحة', icon: '🎁', desc: 'على كل صديق يسجل من خلال رابط الدعوة الخاص بك' },
    { pts: '50', label: 'حد أقصى للدعوات', icon: '🏆', desc: 'يمكنك جمع حتى 50 نقطة من دعوات الأصدقاء' },
    { pts: 'هدية', label: 'مشاركون سابقون', icon: '✨', desc: 'بعض المشاركين السابقين لهم نقاط هدية ضمن حملات الشمعدان' },
  ];

  const steps = [
    { n: '01', title: 'سجّل وكمل حسابك', desc: 'سجّل دخولك، وأكمل بيانات ملفك الشخصي للحصول على نقاط المكافآت وزيادة فرصك في الصدارة' },
    { n: '02', title: 'توقّع قبل بداية المباراة', desc: 'اختار النتيجة، الفائز، أول هداف، والكروت والجزاء قبل صافرة البداية، ويمكنك التعديل قبل الإغلاق' },
    { n: '03', title: 'تابع تحديث النتائج وتصدّر', desc: 'بعد اعتماد النتائج تُضاف النقاط إلى حسابك وتظهر في الترتيب العام والميني ليج الخاصة بك' },
  ];

  const prizes = [
    {
      phase: 'المرحلة الأولى',
      date: '17 يونيو 2026',
      desc: 'نهاية الجولة الأولى في المجموعات',
      note: 'أعلى نقاط في المرحلة — وعند التساوي تُقسَّم الجائزة بالتساوي',
      reward: '5,000 جنيه',
      icon: '🏅',
      color: 'rgba(217,178,95,.15)',
      borderColor: 'rgba(217,178,95,.3)',
    },
    {
      phase: 'المرحلة الثانية',
      date: '23 يونيو 2026',
      desc: 'نهاية الجولة الثانية في المجموعات',
      note: 'أعلى نقاط في المرحلة — وعند التساوي تُقسَّم الجائزة بالتساوي',
      reward: '5,000 جنيه',
      icon: '🏅',
      color: 'rgba(217,178,95,.15)',
      borderColor: 'rgba(217,178,95,.3)',
    },
    {
      phase: 'المرحلة الثالثة',
      date: '27 يونيو 2026',
      desc: 'نهاية دور المجموعات',
      note: 'أعلى نقاط في المرحلة — وعند التساوي تُقسَّم الجائزة بالتساوي',
      reward: '5,000 جنيه',
      icon: '🏅',
      color: 'rgba(217,178,95,.15)',
      borderColor: 'rgba(217,178,95,.3)',
    },
    {
      phase: 'دور الـ 32',
      date: '3 يوليو 2026',
      desc: 'نهاية دور الـ 32',
      note: 'أعلى نقاط في المرحلة — وعند التساوي تُقسَّم الجائزة بالتساوي',
      reward: '5,000 جنيه',
      icon: '🏅',
      color: 'rgba(217,178,95,.15)',
      borderColor: 'rgba(217,178,95,.3)',
    },
  ];

  const grandPrizes = [
    { rank: '🥇 المركز الأول', reward: '3 سبائك ذهب', sub: '', color: '#d9b25f', glow: 'rgba(217,178,95,.35)' },
    { rank: '🥈 المركز الثاني', reward: '2 سبيكة ذهب', sub: '', color: '#b0b8c1', glow: 'rgba(176,184,193,.2)' },
    { rank: '🥉 المركز الثالث', reward: '1 سبيكة ذهب', sub: '', color: '#cd7f32', glow: 'rgba(205,127,50,.2)' },
  ];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

        :root{
          --bg:#070809;
          --surface:#111315;
          --surface-2:#171a1d;
          --surface-3:#1d2125;
          --line:rgba(255,255,255,.08);
          --text:#f4f1e8;
          --muted:#a8a39a;
          --gold:#d9b25f;
          --red:#c93a2f;
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
          border:1px solid var(--line);
          border-radius:16px;
          padding:16px;
          text-align:center;
          transition:border-color .2s,transform .2s;
        }

        .pts-card:hover{border-color:rgba(217,178,95,.25);transform:translateY(-2px)}

        .step-card{
          background:var(--surface);
          border:1px solid var(--line);
          border-radius:18px;
          padding:20px 22px;
          display:flex;
          gap:16px;
          align-items:flex-start;
          transition:border-color .2s;
        }

        .step-card:hover{border-color:rgba(217,178,95,.2)}

        .stat-skeleton{
          background:linear-gradient(90deg,var(--line) 25%,rgba(255,255,255,.06) 50%,var(--line) 75%);
          background-size:200% 100%;
          animation:shimmer 1.5s ease-in-out infinite;
          border-radius:8px;
          display:inline-block;
          width:52px;
          height:22px;
        }

        .prize-phase-card{
          background:linear-gradient(135deg,rgba(217,178,95,.08),rgba(217,178,95,.03));
          border:1px solid rgba(217,178,95,.2);
          border-radius:16px;
          padding:18px 20px;
          display:flex;
          align-items:center;
          gap:16px;
          transition:border-color .2s,transform .2s;
        }

        .prize-phase-card:hover{border-color:rgba(217,178,95,.4);transform:translateY(-2px)}

        .grand-prize-card{
          border-radius:20px;
          padding:28px 20px;
          text-align:center;
          transition:transform .2s;
        }

        .grand-prize-card:hover{transform:translateY(-4px)}

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
          will-change:transform;
          -webkit-transform:translateX(-50%);
        }

        .section-note{
          margin-top:22px;
          padding:18px 20px;
          border-radius:18px;
          border:1px solid rgba(217,178,95,.14);
          background:linear-gradient(180deg,rgba(217,178,95,.06),rgba(255,255,255,.015));
        }

        .section-note p{
          color:var(--muted);
          line-height:1.9;
          font-size:14px;
        }

        .section-note strong{
          color:var(--text);
          font-weight:800;
        }

        .bonus-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
          gap:14px;
          margin-top:18px;
        }

        .bonus-card{
          background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01));
          border:1px solid var(--line);
          border-radius:16px;
          padding:16px;
          text-align:center;
          transition:border-color .2s,transform .2s;
        }

        .bonus-card:hover{border-color:rgba(217,178,95,.25);transform:translateY(-2px)}
      `}</style>

      <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        {/* ══ NAVBAR ══ */}
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
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
                  <Link href="/auth" className="cta-btn primary">
                    ابدأ الآن
                  </Link>
                  <Link href="/leaderboard" className="cta-btn secondary">
                    🏆 الصدارة
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ══ HERO ══ */}
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
              سجل. توقع. <span style={{ color: 'var(--gold)' }}>اجمع نقاط واتصدّر.</span>
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
                  <Link href="/auth" className="cta-btn primary">
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
                { value: stats.users, label: 'متسابق مسجّل', icon: '👥', dynamic: true },
                { value: stats.predictions, label: 'توقع مقدَّم', icon: '📊', dynamic: true },
                { value: 48, label: 'منتخب مشارك', icon: '🌍', dynamic: false },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))',
                    border: '1px solid var(--line)',
                    borderRadius: 18,
                    padding: '18px 16px',
                  }}
                >
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

            <div style={{ marginTop: 26, color: 'var(--muted)', fontSize: 14 }}>↓ اكتشف المزيد</div>
          </div>
        </section>

        {/* ══ POINTS SECTION ══ */}
        <section style={{ padding: '50px 20px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>نظام النقاط</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, marginBottom: 10 }}>
                كل توقع صح = نقاط 🎯
              </h2>
              <p style={{ color: 'var(--muted)', maxWidth: 760, margin: '0 auto', lineHeight: 1.9 }}>
                عشان تكون في الصدارة وتكسب الجوائز الكبرى وسبائك الذهب، صممنا نظام نقاط ممتع وسهل يجمع بين
                دقة التوقع وتفاعلك داخل المنصة.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                gap: 14,
              }}
            >
              {pointsCards.map((c, i) => (
                <div key={i} className="pts-card">
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', marginBottom: 6 }}>{c.pts}</div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>{c.desc}</div>
                </div>
              ))}
            </div>

            <div className="section-note">
              <p>
                <strong>الحد الأقصى في المباراة الواحدة يصل إلى 25 نقطة</strong>، وتقدر تعدّل توقعاتك براحتك
                طول ما المباراة لسه ما بدأتش. وبمجرد بداية الماتش بيتقفل باب التوقعات تلقائيًا ولا تقدر
                تعدّل بعد كده. ولو اخترت غلط في وجود <strong>بطاقة حمراء</strong> أو <strong>ركلة جزاء</strong>{' '}
                هيتخصم منك <strong>-1 نقطة</strong> بدل ما تزيد، فركّز كويس في اختياراتك.
              </p>
            </div>

            <div style={{ textAlign: 'center', marginTop: 42, marginBottom: 18 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>نقاط المكافآت والحساب</div>
              <h3 style={{ fontSize: 'clamp(22px,3vw,34px)', fontWeight: 900, marginBottom: 10 }}>
                كبّر رصيدك بنقاط الولاء 🎁
              </h3>
              <p style={{ color: 'var(--muted)', maxWidth: 760, margin: '0 auto', lineHeight: 1.9 }}>
                مش بس المباريات اللي بتكسبك — تقدر تزود نقاط حسابك من استكمال بياناتك، دعوة أصحابك، وبعض
                المكافآت الخاصة المرتبطة بحملات الشمعدان.
              </p>
            </div>

            <div className="bonus-grid">
              {bonusCards.map((c, i) => (
                <div key={i} className="bonus-card">
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', marginBottom: 6 }}>{c.pts}</div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>{c.desc}</div>
                </div>
              ))}
            </div>

            <div className="section-note">
              <p>
                بعد اعتماد النتائج يتم تحديث نقاطك داخل الحساب وتظهر في <strong>الترتيب العام</strong> وداخل{' '}
                <strong>الميني ليج</strong> الخاصة بك. يعني التوقعات الصحيحة لا ترفعك فقط في كل مباراة، لكنها
                تبني رصيدك الكلي خطوة بخطوة طوال البطولة.
              </p>
            </div>
          </div>
        </section>

        {/* ══ PRIZES SECTION ══ */}
        <section style={{ padding: '34px 20px 56px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>🏆 جوائز دوري التوقعات</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, marginBottom: 10 }}>
                العب واكسب جوائز حقيقية
              </h2>
              <p style={{ color: 'var(--muted)', maxWidth: 760, margin: '0 auto', lineHeight: 1.9 }}>
                المسابقة متقسمة لمراحل عشان الحماس يفضل مستمر، وكل مرحلة لها فائز، بالإضافة إلى الجوائز
                الكبرى التراكمية في نهاية البطولة.
              </p>
            </div>

            <div style={{ marginBottom: 18, color: 'var(--text)', fontWeight: 900, fontSize: 20 }}>
              جوائز المراحل — 5,000 جنيه لكل بطل مرحلة
            </div>

            <div style={{ display: 'grid', gap: 14, marginBottom: 30 }}>
              {prizes.map((p, i) => (
                <div key={i} className="prize-phase-card">
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      minWidth: 58,
                      borderRadius: 16,
                      display: 'grid',
                      placeItems: 'center',
                      background: p.color,
                      border: `1px solid ${p.borderColor}`,
                      fontSize: 24,
                    }}
                  >
                    {p.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                      }}
                    >
                      <strong style={{ fontSize: 18 }}>{p.phase}</strong>
                      <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 14 }}>{p.date}</span>
                    </div>
                    <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{p.desc}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{p.note}</div>
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      color: 'var(--gold)',
                      fontSize: 18,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.reward}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                border: '1px solid rgba(217,178,95,.2)',
                borderRadius: 22,
                padding: '26px 20px',
                background: 'linear-gradient(180deg,rgba(217,178,95,.06),rgba(255,255,255,.015))',
              }}
            >
              <div style={{ marginBottom: 20, color: 'var(--text)', fontWeight: 900, fontSize: 22 }}>
                الجائزة الكبرى — 19 يوليو 2026 — نهاية البطولة
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                  gap: 16,
                }}
              >
                {grandPrizes.map((g, i) => (
                  <div
                    key={i}
                    className="grand-prize-card"
                    style={{
                      background: `linear-gradient(180deg, ${g.glow}, rgba(255,255,255,.02))`,
                      border: `1px solid ${g.glow}`,
                    }}
                  >
                    <div style={{ fontSize: 34, marginBottom: 10 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                    <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
                      {g.rank.replace(/🥇|🥈|🥉/g, '').trim()}
                    </div>
                    <div style={{ color: g.color, fontWeight: 900, fontSize: 24 }}>{g.reward}</div>
                    {g.sub ? (
                      <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>{g.sub}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              <p style={{ color: 'var(--muted)', lineHeight: 1.9, marginTop: 18, fontSize: 14 }}>
                * الجائزة الكبرى <strong style={{ color: 'var(--text)' }}>تراكمية</strong> — يعني مجموع النقاط
                من بداية البطولة حتى نهايتها، وأعلى 3 متسابقين في الترتيب العام هم أصحاب الذهب في النهاية.
              </p>
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section style={{ padding: '20px 20px 60px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>كيف تلعب؟</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, marginBottom: 10 }}>
                3 خطوات بس 🚀
              </h2>
              <p style={{ color: 'var(--muted)', maxWidth: 760, margin: '0 auto', lineHeight: 1.9 }}>
                ابدأ بسهولة، ثم تابع نتائجك ونقاطك أولًا بأول، ونافس أصحابك على الترتيب العام أو داخل دوري
                خاص بك.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              {steps.map((s, i) => (
                <div key={i} className="step-card">
                  <div
                    style={{
                      minWidth: 48,
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(217,178,95,.12)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(217,178,95,.22)',
                      fontWeight: 900,
                    }}
                  >
                    {s.n}
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{s.title}</div>
                    <div style={{ color: 'var(--muted)', lineHeight: 1.9, fontSize: 14 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-note" style={{ marginTop: 20 }}>
              <p>
                المنصة لا تقتصر على التنافس العام فقط؛ تقدر تعمل <strong>ميني ليج</strong> خاصة بك وتشارك كود
                الدعوة مع أصحابك، عشان تتنافسوا بشكل حصري وتشوفوا مين أحسن محلل فيكم خلال البطولة.
              </p>
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ══ */}
        <section style={{ padding: '10px 20px 80px' }}>
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              border: '1px solid rgba(217,178,95,.18)',
              borderRadius: 28,
              background: 'linear-gradient(180deg,rgba(217,178,95,.07),rgba(255,255,255,.02))',
              padding: '34px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: 'var(--gold)', fontWeight: 900, marginBottom: 10 }}>الشمعدان</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, marginBottom: 12 }}>
              جاهز تثبت إنك أحسن محلل؟
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: 720, margin: '0 auto 22px', lineHeight: 1.9 }}>
              سجّل دخولك دلوقتي وابدأ توقعاتك مجانًا، واجمع نقاطك من المباريات والمكافآت ونافس على الجوائز
              الكبرى حتى نهاية كأس العالم.
            </p>

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
        </section>

        {/* ══ FOOTER ══ */}
        <footer style={{ borderTop: '1px solid var(--line)', padding: '22px 20px 30px' }}>
          <div
            style={{
              maxWidth: 1180,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/logo-FF.png"
                alt="الشمعدان"
                style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: '50%' }}
              />
              <div>
                <div style={{ fontWeight: 900 }}>الشمعدان</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>دوري توقعات كأس العالم</div>
              </div>
            </div>

            <p style={{ color: 'var(--muted)', fontSize: 13 }}>© 2026 الشمعدان — كأس العالم</p>
          </div>
        </footer>
      </main>
    </>
  );
}
