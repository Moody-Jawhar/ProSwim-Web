// Cinematic intro shown right after login. Pure CSS animation — deep-water
// gradient, expanding ripple rings behind the glowing logo, rising bubbles,
// drifting wave layers, shimmering title and staged feature chips, then a
// clean dissolve into the dashboard. Click anywhere (or wait) to enter.

import { useEffect, useState } from 'react';

const FEATURES = ['Students', 'Schedule', 'Attendance', 'Payments', 'AI Insights', 'Feedback'];

// Deterministic pseudo-random bubbles so renders are stable.
const BUBBLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 13) % 100,
  size: 6 + ((i * 17) % 14),
  delay: ((i * 29) % 30) / 10,
  duration: 5 + ((i * 13) % 40) / 10,
  opacity: 0.12 + ((i * 7) % 20) / 100,
}));

const TOTAL_MS = 5200;

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  function leave() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 700); // matches the fade-out duration
  }

  useEffect(() => {
    const t = setTimeout(leave, TOTAL_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={leave}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none"
      style={{
        background: 'radial-gradient(120% 120% at 50% 20%, #1d3a5f 0%, #14263f 45%, #0a1526 100%)',
        animation: leaving ? 'splash-out 0.7s ease forwards' : undefined,
      }}
    >
      <style>{`
        @keyframes splash-out { to { opacity: 0; transform: scale(1.06); } }
        @keyframes splash-ring {
          0% { transform: scale(0.4); opacity: 0.55; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes splash-logo {
          0% { transform: scale(0.3); opacity: 0; filter: blur(8px); }
          55% { transform: scale(1.08); opacity: 1; filter: blur(0); }
          75% { transform: scale(0.97); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-glow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.15); }
        }
        @keyframes splash-rise {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: var(--o, 0.2); }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
        @keyframes splash-title {
          0% { opacity: 0; letter-spacing: 0.6em; filter: blur(6px); }
          100% { opacity: 1; letter-spacing: 0.18em; filter: blur(0); }
        }
        @keyframes splash-line {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-chip {
          0% { opacity: 0; transform: translateY(10px) scale(0.85); }
          70% { transform: translateY(-2px) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes splash-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes splash-wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Rising bubbles */}
      {BUBBLES.map((b, i) => (
        <span key={i}
          className="absolute rounded-full border border-white/30 bottom-0"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background: 'rgba(255,255,255,0.06)',
            ['--o' as never]: b.opacity as never,
            animation: `splash-rise ${b.duration}s linear ${b.delay}s infinite`,
          }} />
      ))}

      {/* Logo with pulsing glow + ripple rings */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-56 h-56 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(45,125,196,0.55) 0%, rgba(45,125,196,0) 70%)',
            animation: 'splash-glow 2.6s ease-in-out infinite',
          }} />
        {[0, 0.6, 1.2].map((d) => (
          <div key={d} className="absolute w-44 h-44 rounded-full border-2 border-sky-300/40"
            style={{ animation: `splash-ring 2.4s ease-out ${0.5 + d}s infinite` }} />
        ))}
        <div className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl"
          style={{
            animation: 'splash-logo 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
            boxShadow: '0 0 60px rgba(45,125,196,0.55), 0 20px 50px rgba(0,0,0,0.45)',
          }}>
          <img src={`${import.meta.env.BASE_URL}ProSwimLogo.png`} alt="ProSwim" className="h-14 w-auto" />
        </div>
      </div>

      {/* Title with shimmer sweep */}
      <h1
        className="text-3xl md:text-4xl font-extrabold uppercase mb-3 text-transparent bg-clip-text"
        style={{
          backgroundImage: 'linear-gradient(110deg, #7db8e8 20%, #ffffff 40%, #bfe0ff 50%, #ffffff 60%, #7db8e8 80%)',
          backgroundSize: '200% auto',
          animation: 'splash-title 1s ease 0.9s both, splash-shimmer 2.6s linear 1.9s infinite',
        }}
      >
        Management Portal
      </h1>

      <p className="text-sm md:text-base text-sky-200/70 font-medium mb-8"
        style={{ animation: 'splash-line 0.7s ease 1.5s both' }}>
        Swim Safe. Build Confidence. Reach Your Potential.
      </p>

      {/* Feature chips cascading in */}
      <div className="flex flex-wrap justify-center gap-2 px-8 max-w-xl mb-10">
        {FEATURES.map((f, i) => (
          <span key={f}
            className="text-xs font-bold text-sky-100 border border-sky-300/30 rounded-full px-3.5 py-1.5 backdrop-blur-sm"
            style={{
              background: 'rgba(45,125,196,0.18)',
              animation: `splash-chip 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${1.9 + i * 0.14}s both`,
            }}>
            {f}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-sky-200/40 tracking-widest uppercase"
        style={{ animation: 'splash-line 0.8s ease 3s both' }}>
        Click anywhere to dive in
      </p>

      {/* Drifting wave layers */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 110 }}>
        {[{ o: 0.18, d: 14, y: 0 }, { o: 0.1, d: 22, y: 18 }].map((w, i) => (
          <svg key={i} viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="absolute bottom-0"
            style={{
              width: '200%', height: 110 - w.y, left: 0,
              animation: `splash-wave ${w.d}s linear infinite`,
            }}>
            <path
              d="M0,60 C150,100 300,20 450,60 C600,100 750,20 900,60 C1050,100 1150,40 1200,60 L1200,120 L0,120 Z M1200,60 C1350,100 1500,20 1650,60 C1800,100 1950,20 2100,60 C2250,100 2350,40 2400,60 L2400,120 L1200,120 Z"
              fill={`rgba(125, 184, 232, ${w.o})`} transform="scale(2,1)" />
          </svg>
        ))}
      </div>
    </div>
  );
}
