// Slim page header. Title and subtitle sit on one line above a hairline rule,
// so pages start their real content within ~34px instead of the ~108px the
// old photo banner cost. `slide` and `compact` are accepted but unused, call
// sites still pass them and there is no image to pick or height to vary.

export function PageHero({ title, subtitle, right }: {
  title: string;
  subtitle?: string;
  slide?: number;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="hero-in flex items-center justify-between gap-3 flex-wrap mb-4 pb-2.5 border-b border-slate-200">
      <div className="flex items-baseline gap-2 min-w-0">
        <h1 className="text-lg font-bold text-slate-800 leading-tight whitespace-nowrap">{title}</h1>
        {subtitle && <span className="text-xs text-slate-500 truncate">· {subtitle}</span>}
      </div>
      {right && <div className="flex items-center shrink-0">{right}</div>}
    </div>
  );
}
