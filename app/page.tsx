'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at top left, rgba(217,178,95,.12), transparent 30%),
        radial-gradient(circle at bottom right, rgba(201,58,47,.10), transparent 30%),
        #070809
      `,
      color: '#f4f1e8',
      fontFamily: "'Cairo', sans-serif",
      direction: 'rtl',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root {
          --bg: #070809;
          --surface: #111315;
          --surface-2: #171a1d;
          --surface-3: #1d2125;
          --line: rgba(255,255,255,.08);
          --text: #f4f1e8;
          --muted: #a8a39a;
          --gold: #d9b25f;
          --red: #c93a2f;
          --green: #27b06e;
          --shadow: 0 16px 40px rgba(0,0,0,.35);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; }
        .nav-link {
          padding: 9px 20px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid var(--line);
          color: var(--muted); font-weight: 700; text-decoration: none;
          font-size: 13px; font-family: 'Cairo', sans-serif;
          transition: all .2s;
        }
        .nav-link:hover { background: rgba(217,178,95,.1); border-color: rgba(217,178,95,.25); color: #f2d79e; }
        .btn-primary {
          padding: 14px 38px; border-radius: 999px;
          background: linear-gradient(135deg, #e0bc73, #b9892d);
          color: #211708; font-weight: 800; text-decoration: none;
          font-size: 16px; font-family: 'Cairo', sans-serif;
          box-shadow: 0 8px 28px rgba(217,178,95,.28);
          transition: opacity .2s; display: inline-block;
        }
        .btn-primary:hover { opacity: .88; }
        .btn-ghost {
          padding: 14px 38px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid var(--line);
          color: var(--muted); font-weight: 800; text-decoration: none;
          font-size: 16px; font-family: 'Cairo', sans-serif;
          transition: all .2s; display: inline-block;
        }
        .btn-ghost:hover { border-color: rgba(217,178,95,.25); color: #f2d79e; }
        .pts-card {
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));
          border: 1px solid var(--line); border-radius: 22px; padding: 20px 14px;
          text-align: center; transition: border-color .2s;
        }
        .pts-card:hover { border-color: rgba(217,178,95,.22); }
        .step-num {
          min-width: 34px; height: 34px; border-radius: 50%;
          background: rgba(217,178,95,.1); border: 1px solid rgba(217,178,95,.22);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800; color: #f2d79e; flex-shrink: 0;
        }
        @media (max-width: 500px) {
          .pts-grid { grid-template-columns: 1fr 1fr !important; }
          .cta-btns { flex-direction: column; align-items: stretch; }
          .cta-btns a { text-align: center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid var(--line)',
        background: 'rgba(7,8,9,.8)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #f0cf84, #a97b26)',
            display: 'grid', placeItems: 'center', fontSize: 20,
            boxShadow: '0 4px 16px rgba(217,178,95,.25)', flexShrink: 0,
          }}>🏆</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f4f1e8' }}>الشمعدان</div>
            <div style={{ fontSize: 11, color: '#a8a39a' }}>× كأس العالم 2026</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/leaderboard" className="nav-link">🏁 الصدارة</Link>
          <Link href="/login" style={{
            padding: '9px 20px', borderRadius: 999,
            background: 'linear-gradient(135deg, #e0bc73, #b9892d)',
            color: '#211708', fontWeight: 800, textDecoration: 'none',
            fontSize: 13, fontFamily: 'Cairo, sans-serif',
            boxShadow: '0 4px 14px rgba(217,178,95,.25)',
          }}>سجّل دلوقتي</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: '70px 20px 50px' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 18px', borderRadius: 999,
          background: 'rgba(217,178,95,.1)', border: '1px solid rgba(217,178,95,.22)',
          fontSize: 12, marginBottom: 28, color: '#f2d79e', fontWeight: 700,
        }}>
          🌍 كأس العالم 2026 — المكسيك · كندا · الولايات المتحدة
        </div>

        {/* Logo + Title */}
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #f0cf84, #a97b26)',
          display: 'grid', placeItems: 'center', fontSize: 38,
          boxShadow: '0 12px 40px rgba(217,178,95,.3)',
        }}>🏆</div>

        <h1 style={{ fontSize: 'clamp(2.8rem, 9vw, 5.5rem)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.05, color: '#f4f1e8' }}>
          الشمعدان
        </h1>
        <h2 style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)', fontWeight: 400, margin: '0 0 20px', color: '#a8a39a' }}>
          × كأس العالم 2026
        </h2>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#a8a39a', marginBottom: 50, maxWidth: '36ch', margin: '0 auto 50px' }}>
          أحلى من الماتش.. اللي بيحصل جنبيه 🔥
        </p>

        {/* Points cards */}
        <div className="pts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 620, margin: '0 auto 50px' }}>
          {[
            { icon: '🏆', label: 'نتيجة كاملة', pts: '10' },
            { icon: '✅', label: 'الفايز صح',   pts: '5'  },
            { icon: '⚽', label: 'أول هدف',      pts: '+3' },
            { icon: '🎯', label: 'سؤال المفاجأة', pts: '+5' },
          ].map(item => (
            <div key={item.label} className="pts-card">
              <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#d9b25f', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{item.pts}</div>
              <div style={{ fontSize: 11, color: '#a8a39a', lineHeight: 1.4 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 480, margin: '0 auto 50px', textAlign: 'right' }}>
          <h3 style={{ textAlign: 'center', marginBottom: 22, fontSize: 17, fontWeight: 800, color: '#f4f1e8' }}>⚡ إزاي اللعبة؟</h3>
          {[
            { n: '١', t: 'قبل الماتش تدخل توقعاتك (النتيجة، أول هدف، سؤال مفاجأة)' },
            { n: '٢', t: 'بعد الماتش بيتحسبلك النقاط أوتوماتيك' },
            { n: '٣', t: 'اللي بيعمل أعلى نقاط في آخر المونديال هو الشمعدان 🏆' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="step-num">{s.n}</div>
              <p style={{ margin: 0, fontSize: 14, color: '#a8a39a', lineHeight: 1.7, paddingTop: 6 }}>{s.t}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="cta-btns" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" className="btn-primary">ابدأ التوقعات دلوقتي 🔥</Link>
          <Link href="/leaderboard" className="btn-ghost">🏁 شوف الصدارة</Link>
        </div>

        <p style={{ marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,.2)' }}>
          مفيش باسورد — رابط على إيميلك وبس 🔐
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ textAlign: 'center', padding: '24px 20px 40px', borderTop: '1px solid var(--line)', marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #f0cf84, #a97b26)', display: 'grid', placeItems: 'center', fontSize: 14 }}>🏆</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a8a39a' }}>الشمعدان × كأس العالم 2026</span>
        </div>
      </footer>
    </main>
  );
}
