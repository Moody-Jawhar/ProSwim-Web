// Photo banner with the brand gradient overlay. Images are the pool shots
// from proswim-lb.com, served locally from /heroes.

const SLIDES = ['/heroes/slide1.jpg', '/heroes/slide2.jpg', '/heroes/slide3.jpg', '/heroes/slide4.jpg'];

export function PageHero({ title, subtitle, slide = 0, right, compact = false }: {
  title: string;
  subtitle?: string;
  slide?: number;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  const img = SLIDES[slide % SLIDES.length];
  return (
    <div
      className={`hero-in relative overflow-hidden rounded-2xl mb-6 ${compact ? 'min-h-[84px]' : 'min-h-[108px]'}`}
      style={{
        backgroundImage:
          `linear-gradient(90deg, rgba(30,54,88,0.92) 0%, rgba(30,92,151,0.62) 42%, rgba(30,92,151,0.18) 100%), url(${img})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 42%',
      }}
    >
      <div className={`flex items-center justify-between gap-4 flex-wrap ${compact ? 'px-5 py-3.5' : 'px-6 py-4'} h-full`}>
        <div style={{ textShadow: '0 1px 12px rgba(15,32,55,0.55)' }}>
          <h1 className={`font-bold text-white leading-tight ${compact ? 'text-2xl' : 'text-3xl'}`}>{title}</h1>
          {subtitle && <p className="text-[13px] text-white/90 mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="text-white">{right}</div>}
      </div>
      {/* wave accent */}
      <svg className="absolute bottom-0 left-0 right-0 w-full text-[#f5f7fa]" viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: 18 }}>
        <path fill="currentColor" d="M0,32 C240,8 480,40 720,24 C960,8 1200,32 1440,16 L1440,40 L0,40 Z" />
      </svg>
    </div>
  );
}
