// Post-login welcome. Deliberately quiet: the logo settles in, a personal
// greeting and the date fade up, a single wave line draws itself underneath,
// and the screen breathes out into the dashboard. No glows, no confetti.
// it should feel like the room lights coming on, not a product launch.

import { useEffect, useState } from 'react';
import { getStoredUser } from '../api/portalApi';
import { Bubbles } from './Bubbles';

const TOTAL_MS = 3400;

function greetingFor(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const user = getStoredUser();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];
  const now = new Date();
  const greeting = `${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ''}`;
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  function leave() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 600);
  }

  useEffect(() => {
    const t = setTimeout(leave, TOTAL_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={leave}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer select-none"
      style={{
        background: '#f7f9fc',
        transition: 'opacity 0.6s ease',
        opacity: leaving ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes wel-rise {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes wel-draw {
          0% { stroke-dashoffset: 240; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Green: the color of the way in */}
      <Bubbles tint="green" />

      <img
        src={`${import.meta.env.BASE_URL}ProSwimLogo.png`}
        alt="ProSwim"
        className="h-12 w-auto mb-10"
        style={{ animation: 'wel-rise 0.9s ease 0.1s both' }}
      />

      <p
        className="text-2xl md:text-3xl font-semibold text-slate-800 mb-2"
        style={{ animation: 'wel-rise 0.9s ease 0.6s both' }}
      >
        {greeting}
      </p>

      <p
        className="text-sm text-slate-400 mb-6"
        style={{ animation: 'wel-rise 0.9s ease 1.1s both' }}
      >
        {dateLine}
      </p>

      {/* One wave line, drawing itself like a pen stroke */}
      <svg width="220" height="18" viewBox="0 0 220 18" fill="none"
        style={{ animation: 'wel-rise 0.6s ease 1.4s both' }}>
        <path
          d="M4 12 C 26 2, 48 2, 70 12 S 114 22, 136 12 S 180 2, 216 10"
          stroke="#1e5c97" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="240"
          style={{ animation: 'wel-draw 1.3s ease 1.5s both' }}
        />
      </svg>
    </div>
  );
}
