// Dashboard finance section (SiteMaster only): revenue / expenses / profit
// tiles with month-over-month deltas, a 13-month bar chart per currency, and
// the on-device model's worded findings.

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Info, Sparkles, Wallet } from 'lucide-react';
import {
  loadFinanceOverview, fmtMoney,
  type FinanceOverviewData, type Cur, type FinanceFinding,
} from '../insights/financeAnalytics';

const TONE: Record<FinanceFinding['tone'], { Icon: typeof Info; cls: string }> = {
  positive: { Icon: TrendingUp, cls: 'text-emerald-700' },
  info: { Icon: Info, cls: 'text-[#1e5c97]' },
  warn: { Icon: TrendingDown, cls: 'text-amber-700' },
};

export function FinanceOverview() {
  const [data, setData] = useState<FinanceOverviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState<Cur>('USD');

  useEffect(() => {
    loadFinanceOverview()
      .then((d) => {
        setData(d);
        // Open on the busier currency.
        const usd = d.months.reduce((s, m) => s + m.revenue.USD, 0);
        const lbp = d.months.reduce((s, m) => s + m.revenue.LBP, 0);
        if (lbp > 0 && usd === 0) setCur('LBP');
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null; // non-SiteMaster or endpoint issue — dashboard still works

  const delta = (now: number, before: number | undefined) => {
    if (!before || before <= 0) return null;
    return Math.round(((now - before) / before) * 100);
  };

  const chartMax = data
    ? Math.max(1, ...data.months.map((m) => Math.max(m.revenue[cur], m.expenses[cur])))
    : 1;

  return (
    <div className="rise-in rise-2 relative overflow-hidden rounded-2xl border border-[#1e5c97]/15 shadow-soft p-6 bg-gradient-to-br from-white via-[#eaf2fb] to-[#dcebfb] mb-6">
      <div className="pointer-events-none absolute -bottom-16 -right-10 w-48 h-48 rounded-full bg-gradient-to-br from-[#2d7dc4] to-[#1e5c97] opacity-10 blur-3xl" />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br from-emerald-400 to-emerald-700">
            <Wallet className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI finance analytics</p>
            <p className="text-sm font-semibold text-slate-700">Revenue, expenses & profit — computed on-device</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['USD', 'LBP'] as Cur[]).map((c) => (
            <button key={c} onClick={() => setCur(c)}
              className={`px-3 py-1 text-xs font-bold ${cur === c ? 'bg-[#1e5c97] text-white' : 'bg-white text-slate-500'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-4 text-[#1e5c97] animate-spin" />
          <p className="text-sm text-slate-400">Crunching the last 13 months…</p>
        </div>
      ) : (
        <>
          {/* This-month tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {([
              ['Revenue', data.current.revenue[cur], data.previous?.revenue[cur], 'text-emerald-700'],
              ['Expenses', data.current.expenses[cur], data.previous?.expenses[cur], 'text-red-600'],
              ['Profit', data.current.profit[cur], data.previous?.profit[cur],
                data.current.profit[cur] >= 0 ? 'text-emerald-700' : 'text-red-600'],
            ] as [string, number, number | undefined, string][]).map(([label, now, before, color]) => {
              const d = delta(now, before);
              return (
                <div key={label} className="bg-white/70 rounded-xl border border-slate-100 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label} this month</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{fmtMoney(now, cur)}</p>
                  {d != null && (
                    <p className={`text-xs font-semibold ${d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {d >= 0 ? '▲' : '▼'} {Math.abs(d)}% vs last month
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 13-month bars: revenue (blue) vs expenses (red) */}
          <div className="bg-white/70 rounded-xl border border-slate-100 p-3.5 mb-4">
            <div className="flex items-stretch gap-1.5" style={{ height: 130 }}>
              {data.months.map((m) => (
                <div key={m.month} className="flex-1 h-full flex flex-col items-center gap-0.5"
                  title={`${m.month} — revenue ${fmtMoney(m.revenue[cur], cur)} · expenses ${fmtMoney(m.expenses[cur], cur)} · profit ${fmtMoney(m.profit[cur], cur)}`}>
                  <div className="w-full flex-1 flex items-end gap-px">
                    <div className="flex-1 rounded-t bg-[#1e5c97]"
                      style={{ height: `${Math.max(3, (m.revenue[cur] / chartMax) * 100)}%`, opacity: 0.85 }} />
                    <div className="flex-1 rounded-t bg-red-400"
                      style={{ height: `${Math.max(3, (m.expenses[cur] / chartMax) * 100)}%`, opacity: 0.8 }} />
                  </div>
                  <span className="text-[8px] text-slate-400 shrink-0">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-[#1e5c97]" /> revenue</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-red-400" /> expenses</span>
            </div>
          </div>

          {/* Findings */}
          <div className="space-y-1.5">
            {data.findings.map((f, i) => {
              const t = TONE[f.tone];
              return (
                <p key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <t.Icon className={`size-4 shrink-0 mt-0.5 ${t.cls}`} />
                  <span>{f.text}</span>
                </p>
              );
            })}
            {data.findings.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Sparkles className="size-4" /> Not enough financial history yet — findings appear as months accumulate.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
