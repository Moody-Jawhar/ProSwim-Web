// Ambient rising bubbles, the portal's little signature. One component,
// tinted per context: blue at home, green on the way in, red on the way out.
// Absolutely positioned and click-through; give the parent `relative` and
// `overflow-hidden`.

const LAYOUTS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 13) % 100,
  size: 8 + ((i * 17) % 18),
  delay: ((i * 29) % 24) / 10,
  duration: 6 + ((i * 13) % 50) / 10,
  opacity: 0.08 + ((i * 7) % 14) / 100,
}));

const TINTS = {
  blue: { border: 'rgba(30,92,151,0.30)', fill: 'rgba(45,125,196,0.05)' },
  green: { border: 'rgba(5,150,105,0.35)', fill: 'rgba(16,185,129,0.06)' },
  red: { border: 'rgba(220,38,38,0.35)', fill: 'rgba(239,68,68,0.06)' },
  white: { border: 'rgba(255,255,255,0.35)', fill: 'rgba(255,255,255,0.08)' },
} as const;

export function Bubbles({ tint = 'blue', speed = 1, overlay = false }: {
  tint?: keyof typeof TINTS;
  speed?: number; // >1 = faster rise (sign-out uses this)
  /** Float above the page content (still click-through) so cards can't hide the bubbles. */
  overlay?: boolean;
}) {
  const c = TINTS[tint];
  return (
    <div className={`${overlay ? 'fixed z-40' : 'absolute'} inset-0 overflow-hidden pointer-events-none`} aria-hidden>
      <style>{`
        @keyframes bubble-rise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: var(--o, 0.1); }
          100% { transform: translateY(-105vh) scale(1.15); opacity: 0; }
        }
      `}</style>
      {LAYOUTS.map((b, i) => (
        <span key={i}
          className="absolute rounded-full"
          style={{
            left: `${b.left}%`,
            bottom: -30,
            width: b.size,
            height: b.size,
            border: `1.5px solid ${c.border}`,
            boxShadow: overlay ? `inset 0 0 6px ${c.fill}` : undefined,
            background: c.fill,
            ['--o' as never]: b.opacity as never,
            animation: `bubble-rise ${b.duration / speed}s linear ${b.delay / speed}s infinite`,
          }} />
      ))}
    </div>
  );
}
