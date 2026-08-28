// Finance analytics, revenue / expenses / profit series with on-device
// statistical analysis (month-over-month deltas, trend regression, forecast),
// worded as findings. Currencies are never mixed: USD and LBP live side by side.

import { apiRequest } from '../api/portalApi';

export type Cur = 'USD' | 'LBP';

export interface MonthMoney { USD: number; LBP: number }
export interface FinanceMonth {
  month: string; // yyyy-MM
  revenue: MonthMoney;
  expenses: MonthMoney;
  profit: MonthMoney;
}

export interface FinanceFinding { tone: 'positive' | 'info' | 'warn'; text: string }

export interface FinanceOverviewData {
  months: FinanceMonth[];       // oldest → newest, gaps filled
  current: FinanceMonth;        // this month
  previous: FinanceMonth | null;
  findings: FinanceFinding[];
  forecast: MonthMoney;         // next-month revenue forecast (linear fit)
}

const CUR_LABEL: Record<Cur, string> = { USD: 'US', LBP: 'LB' };
export const fmtMoney = (v: number, cur: Cur) =>
  `${CUR_LABEL[cur]} ${Math.round(v).toLocaleString()}`;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Least-squares slope + next-value forecast over a numeric series. */
function linreg(ys: number[]): { slope: number; next: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, next: ys[0] ?? 0 };
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;
  return { slope, next: Math.max(0, yMean + slope * (n - xMean)) };
}

const pct = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

export async function loadFinanceOverview(): Promise<FinanceOverviewData> {
  const rows = await apiRequest<{ Month: string; Source: string; Currency: string; Total: number }[]>(
    '/api/portal/finance/overview?months=13');

  // Fill a continuous 13-month window so the chart has no gaps.
  const map = new Map<string, FinanceMonth>();
  const now = new Date();
  for (let i = 12; i >= 0; i--) {
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1));
    map.set(key, {
      month: key,
      revenue: { USD: 0, LBP: 0 },
      expenses: { USD: 0, LBP: 0 },
      profit: { USD: 0, LBP: 0 },
    });
  }
  for (const r of rows) {
    const m = map.get(String(r.Month));
    if (!m) continue;
    const cur: Cur = String(r.Currency).toUpperCase() === 'LBP' ? 'LBP' : 'USD';
    if (String(r.Source) === 'revenue') m.revenue[cur] += Number(r.Total ?? 0);
    else m.expenses[cur] += Number(r.Total ?? 0);
  }
  for (const m of map.values()) {
    m.profit.USD = m.revenue.USD - m.expenses.USD;
    m.profit.LBP = m.revenue.LBP - m.expenses.LBP;
  }

  const months = [...map.values()];
  const current = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : null;

  // ── Findings ─────────────────────────────────────────────────────────────
  const findings: FinanceFinding[] = [];
  const activeCurs = (['USD', 'LBP'] as Cur[]).filter(
    (c) => months.some((m) => m.revenue[c] > 0 || m.expenses[c] > 0));

  for (const c of activeCurs) {
    // Month-over-month revenue.
    if (previous) {
      const change = pct(current.revenue[c], previous.revenue[c]);
      if (change != null && Math.abs(change) >= 5) {
        findings.push({
          tone: change >= 0 ? 'positive' : 'warn',
          text: `${c} revenue is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% vs last month `
            + `(${fmtMoney(current.revenue[c], c)} so far vs ${fmtMoney(previous.revenue[c], c)}).`,
        });
      }
    }
    // Profit margin this month.
    if (current.revenue[c] > 0) {
      const margin = Math.round((current.profit[c] / current.revenue[c]) * 100);
      findings.push({
        tone: margin >= 50 ? 'positive' : margin >= 20 ? 'info' : 'warn',
        text: `${c} profit this month: ${fmtMoney(current.profit[c], c)}, a ${margin}% margin on ${fmtMoney(current.revenue[c], c)} collected.`,
      });
    }
    // Expenses growing faster than revenue over the last 3 full months.
    const last3 = months.slice(-4, -1);
    if (last3.length === 3) {
      const revG = linreg(last3.map((m) => m.revenue[c])).slope;
      const expG = linreg(last3.map((m) => m.expenses[c])).slope;
      if (expG > 0 && expG > revG && last3.some((m) => m.expenses[c] > 0)) {
        findings.push({
          tone: 'warn',
          text: `${c} expenses have been growing faster than revenue over the last three months, worth a look at the expense log.`,
        });
      }
    }
    // Best month in the window.
    const best = months.slice(0, -1).reduce((a, b) => (b.revenue[c] > a.revenue[c] ? b : a), months[0]);
    if (best.revenue[c] > 0) {
      findings.push({
        tone: 'info',
        text: `Best ${c} revenue month in the last year: ${best.month} with ${fmtMoney(best.revenue[c], c)}.`,
      });
    }
  }

  // Next-month revenue forecast from the last 6 full months.
  const basis = months.slice(-7, -1);
  const forecast: MonthMoney = {
    USD: linreg(basis.map((m) => m.revenue.USD)).next,
    LBP: linreg(basis.map((m) => m.revenue.LBP)).next,
  };
  for (const c of activeCurs) {
    if (forecast[c] > 0) {
      findings.push({
        tone: 'info',
        text: `Model forecast for next month's ${c} revenue: ~${fmtMoney(forecast[c], c)} (linear fit over the last 6 months).`,
      });
    }
  }

  return { months, current, previous, findings, forecast };
}
