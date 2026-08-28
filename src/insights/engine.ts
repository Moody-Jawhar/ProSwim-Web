// Per-student AI overview for the portal, computed on-device by our own
// neural network (src/insights/nn.ts), no external AI service involved.
//
// The portal sees aggregate history (per-registration attendance, dues,
// package consumption), so the model here uses a portal-specific feature set
// and staff-voiced explanations. Like the student app's engine, it is trained
// by knowledge distillation: thousands of synthetic students labelled with
// noisy expert rules, learned once per device and cached in localStorage.

import { apiRequest } from '../api/portalApi';
import { NeuralNet, makeRng, type SerializedNet } from './nn';

type Row = Record<string, unknown>;

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sig = (z: number) => 1 / (1 + Math.exp(-z));

// ── Model ────────────────────────────────────────────────────────────────────

const MODEL_VERSION = 1;
const CACHE_KEY = `proswim.portal.insightsModel.v${MODEL_VERSION}`;
const N_FEATURES = 10;
export const OUTPUTS = ['attendanceRisk', 'churnRisk', 'paymentRisk', 'renewalDue'] as const;
export type OutputName = (typeof OUTPUTS)[number];
const SIZES = [N_FEATURES, 14, 8, OUTPUTS.length];

const noise = (rng: () => number, scale: number) => (rng() + rng() - 1) * scale;

// Synthetic students with correlated features + expert-rule soft labels.
export function generateTrainingSet(n: number, seed = 42): { inputs: number[][]; targets: number[][] } {
  const rng = makeRng(seed);
  const inputs: number[][] = [];
  const targets: number[][] = [];

  for (let k = 0; k < n; k++) {
    const e = rng(); // latent engagement
    const attRecent = clamp01(0.25 + 0.7 * e + noise(rng, 0.13));
    const attOverall = clamp01(0.35 + 0.55 * e + noise(rng, 0.1));
    const trend = clamp01((attRecent - attOverall + 1) / 2);
    const stopped = rng() < 0.05 + 0.25 * (1 - e) ? 1 : 0;
    const activeReg = stopped ? (rng() < 0.15 ? 1 : 0) : (rng() < 0.1 + 0.85 * e ? 1 : 0);
    const hasDueData = rng() < 0.8 ? 1 : 0;
    const dueRatio = hasDueData ? (rng() < 0.55 ? 0 : rng() ** 2) : 0;
    const hasOpenPkg = rng() < 0.4 ? 1 : 0;
    const sessionsLeftRatio = hasOpenPkg ? rng() : 0.5;
    const tenure = rng();

    inputs.push([attRecent, attOverall, trend, stopped, activeReg,
      dueRatio, hasDueData, sessionsLeftRatio, hasOpenPkg, tenure]);

    const attendanceRisk = sig(6 * (0.6 - attRecent) + 2 * (attOverall - attRecent) - 0.5);
    const churnRisk = sig(
      3 * (attendanceRisk - 0.5) + 3.5 * stopped + 1.8 * (1 - activeReg)
      + 1.2 * dueRatio * hasDueData + 0.4 * tenure * (1 - activeReg) - 1.9,
    );
    const paymentRisk = hasDueData ? sig(6 * dueRatio - 2) : 0.25;
    const renewalDue = hasOpenPkg ? sig(6 * (0.2 - sessionsLeftRatio) + 1) : 0.08;

    targets.push([attendanceRisk, churnRisk, paymentRisk, renewalDue]
      .map((y) => clamp01(y + noise(rng, 0.04))));
  }
  return { inputs, targets };
}

export function trainModel(): NeuralNet {
  const net = new NeuralNet(SIZES, makeRng(1337));
  const { inputs, targets } = generateTrainingSet(3000);
  net.train(inputs, targets, { epochs: 30, lr: 0.06, momentum: 0.9, batch: 32, rng: makeRng(7) });
  return net;
}

let cachedNet: NeuralNet | null = null;

function getModel(): NeuralNet {
  if (cachedNet) return cachedNet;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const data = JSON.parse(raw) as SerializedNet;
      if (Array.isArray(data.sizes) && data.sizes.length === SIZES.length) {
        cachedNet = NeuralNet.fromJSON(data);
        return cachedNet;
      }
    }
  } catch { /* corrupt cache, retrain */ }
  cachedNet = trainModel();
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify(cachedNet.toJSON()));
  } catch { /* storage unavailable, in-memory model still works */ }
  return cachedNet;
}

// ── Data & features ──────────────────────────────────────────────────────────

interface ProgramsData {
  registrations: Row[];
  attendance: Row[];
  packages: Row[];
}

/** One registration with everything the features need, newest first. */
interface RegStat {
  total: number;
  attended: number;
  due: number;
  net: number;
  stopped: boolean;
  active: boolean;
  semester: string;
  order: number; // recency: RegistrationDate epoch, or RegistrationId as fallback
  date: number | null; // RegistrationDate epoch when known
}

export interface StudentSignals {
  regs: RegStat[];
  attRecent: number;
  attOverall: number;
  recentSemester: string;
  recentAttended: number;
  recentTotal: number;
  totalSessions: number;
  stopped: boolean;
  activeReg: boolean;
  /** Days since the newest registration, when its date is known. */
  staleDays: number | null;
  hasDueData: boolean;
  dueRatio: number;
  dueByCurrency: Record<string, number>;
  openPackage: { name: string; left: number; total: number } | null;
  tenureYears: number | null;
  enoughData: boolean;
}

// Matches effectiveCurrency() in the student app: large amounts are LBP.
const currencyOf = (amount: number) => (amount > 10000 ? 'LBP' : 'USD');

const DAY_MS = 86400000;
const regAgeDays = (g: RegStat | null) =>
  g && g.date != null ? Math.max(0, (Date.now() - g.date) / DAY_MS) : null;
const isStale = (g: RegStat, days: number) => {
  const a = regAgeDays(g);
  return a != null && a > days;
};
// Recency weight for year-aware averaging: exponential decay by age, or by
// list position (newest first) when registration dates are unavailable.
const regWeight = (g: RegStat, idx: number) => {
  const a = regAgeDays(g);
  return a != null ? Math.exp(-a / 365) : Math.exp(-idx / 3);
};

function buildSignals(programs: ProgramsData, moduleRows: Row[] | null, startingDate: string | null): StudentSignals {
  const regs: RegStat[] = [];

  if (moduleRows && moduleRows.length > 0) {
    // Module rows are the richer source: dated, with dues and session counts.
    for (const r of moduleRows) {
      const status = str(r, 'Status').toLowerCase();
      regs.push({
        total: num(r, 'SessionsTotal'),
        attended: num(r, 'SessionsAttended'),
        due: num(r, 'DueAmount'),
        net: num(r, 'RegistrationNetToPay'),
        stopped: status.includes('stop'),
        active: status.includes('active'),
        semester: str(r, 'SemesterName'),
        order: new Date(str(r, 'RegistrationDate')).getTime() || num(r, 'RegistrationID'),
        date: new Date(str(r, 'RegistrationDate')).getTime() || null,
      });
    }
  } else {
    // Fallback: the programs endpoint (no dues, RegistrationId as recency).
    const att = (regId: number) => programs.attendance.find((a) => num(a, 'RegistrationId') === regId);
    for (const reg of programs.registrations) {
      const regId = num(reg, 'RegistrationId');
      const a = att(regId);
      regs.push({
        total: a ? num(a, 'TotalSessions') : 0,
        attended: a ? num(a, 'AttendedSessions') : 0,
        due: 0, net: 0,
        stopped: reg['RegistrationStudentStopped'] === true,
        active: false,
        semester: str(reg, 'SemesterName'),
        order: regId,
        date: null,
      });
    }
  }

  regs.sort((a, b) => b.order - a.order); // newest first
  const withSessions = regs.filter((r) => r.total > 0);
  const recent = withSessions[0] ?? null;
  const totals = withSessions.reduce((s, r) => ({ t: s.t + r.total, a: s.a + r.attended }), { t: 0, a: 0 });

  // Year-aware rates: recent registrations dominate, old years fade out
  // (half-life ~8 months by date; by list position when dates are unknown).
  const wTotals = withSessions.reduce((s, r, i) => {
    const w = regWeight(r, i);
    return { t: s.t + w * r.total, a: s.a + w * r.attended };
  }, { t: 0, a: 0 });

  const hasDueData = !!moduleRows && moduleRows.length > 0;
  // Currency-safe due pressure: average of per-registration due/net ratios
  // over the latest few registrations (amounts are mixed LBP/USD). Dues on
  // registrations older than two years are history, not a current problem.
  const ratioRows = regs.filter((r) => r.net > 0 && !isStale(r, 730)).slice(0, 3);
  const dueRatio = ratioRows.length
    ? ratioRows.reduce((s, r) => s + clamp01(r.due / r.net), 0) / ratioRows.length : 0;
  const dueByCurrency: Record<string, number> = {};
  for (const r of regs) {
    if (r.due > 0 && !isStale(r, 730)) dueByCurrency[currencyOf(r.due)] = (dueByCurrency[currencyOf(r.due)] ?? 0) + r.due;
  }
  const staleDays = regAgeDays(regs[0] ?? null);

  const openPkgs = programs.packages
    .filter((p) => p['PackageClosed'] !== true && num(p, 'PackageNumberOfSessions') > 0)
    .map((p) => ({
      name: str(p, 'PackageName'),
      total: num(p, 'PackageNumberOfSessions'),
      left: Math.max(0, num(p, 'PackageNumberOfSessions') - num(p, 'CountAttended')),
    }))
    .filter((p) => p.left > 0)
    .sort((a, b) => a.left / a.total - b.left / b.total);

  const started = startingDate ? new Date(startingDate) : null;
  const tenureYears = started && !isNaN(started.getTime())
    ? Math.max(0, (Date.now() - started.getTime()) / (365.25 * 86400000)) : null;

  return {
    regs,
    attRecent: recent ? recent.attended / recent.total : 0,
    attOverall: wTotals.t > 0 ? wTotals.a / wTotals.t : 0,
    recentSemester: recent?.semester ?? '',
    recentAttended: recent?.attended ?? 0,
    recentTotal: recent?.total ?? 0,
    totalSessions: totals.t,
    stopped: regs[0]?.stopped ?? false,
    activeReg: (hasDueData ? regs.some((r) => r.active && !r.stopped) : !(regs[0]?.stopped ?? true))
      && !(staleDays != null && staleDays > 400),
    staleDays,
    hasDueData,
    dueRatio,
    dueByCurrency,
    openPackage: openPkgs[0] ?? null,
    tenureYears,
    enoughData: totals.t >= 6,
  };
}

function toFeatures(s: StudentSignals): number[] {
  const attRecent = s.enoughData ? s.attRecent : 0.7;
  const attOverall = s.totalSessions > 0 ? s.attOverall : 0.7;
  return [
    attRecent,
    attOverall,
    clamp01((attRecent - attOverall + 1) / 2),
    s.stopped ? 1 : 0,
    s.activeReg ? 1 : 0,
    s.dueRatio,
    s.hasDueData ? 1 : 0,
    s.openPackage ? s.openPackage.left / s.openPackage.total : 0.5,
    s.openPackage ? 1 : 0,
    clamp01((s.tenureYears ?? 1) / 5),
  ];
}

// ── Insights ─────────────────────────────────────────────────────────────────

export type InsightTone = 'positive' | 'info' | 'warn' | 'alert';

export interface Insight {
  id: string;
  tone: InsightTone;
  priority: number;
  title: string;
  body: string;
}

export interface StudentOverview {
  signals: StudentSignals;
  scores: Record<OutputName, number>;
  insights: Insight[];
}

const TONE_WEIGHT: Record<InsightTone, number> = { alert: 30, warn: 20, positive: 10, info: 5 };

function ins(id: string, tone: InsightTone, s: number, title: string, body: string): Insight {
  return { id, tone, priority: TONE_WEIGHT[tone] + s, title, body };
}

function moneyList(map: Record<string, number>): string {
  return Object.entries(map).map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`).join(' · ');
}

export function generateInsights(s: StudentSignals, scores: Record<OutputName, number>): Insight[] {
  const out: Insight[] = [];
  const pct = (x: number) => Math.round(x * 100);

  if (s.enoughData) {
    if (scores.attendanceRisk >= 0.55) {
      out.push(ins('attRisk', scores.attendanceRisk >= 0.75 ? 'alert' : 'warn', scores.attendanceRisk,
        'Attendance is slipping',
        `Attended ${s.recentAttended} of ${s.recentTotal} sessions in ${s.recentSemester || 'the latest semester'}`
        + ` (${pct(s.attOverall)}% lifetime). Worth a follow-up call with the family to understand why.`));
    } else if (s.attRecent >= 0.85) {
      out.push(ins('attGreat', 'positive', 1 - scores.attendanceRisk,
        'Strong attendance',
        `${pct(s.attRecent)}% attendance in ${s.recentSemester || 'the latest semester'}, a reliable, committed swimmer.`));
    }
  }

  if (scores.churnRisk >= 0.6) {
    const reasons: string[] = [];
    if (s.stopped) reasons.push('the latest registration is marked stopped');
    if (s.staleDays != null && s.staleDays > 365) {
      reasons.push(`the last registration dates back ${Math.round(s.staleDays / 30)} months`);
    } else if (!s.activeReg) {
      reasons.push('there is no active registration');
    }
    if (s.enoughData && s.attRecent < 0.6) reasons.push('recent attendance is low');
    if (s.dueRatio > 0.3) reasons.push('payments are lagging');
    out.push(ins('churn', scores.churnRisk >= 0.8 ? 'alert' : 'warn', scores.churnRisk,
      'At risk of leaving',
      `The model flags a churn risk of ${pct(scores.churnRisk)}%`
      + (reasons.length ? `: ${reasons.join(', ')}.` : '.')
      + ' A re-engagement call or a fresh registration offer could keep this swimmer.'));
  }

  if (scores.paymentRisk >= 0.55 && Object.keys(s.dueByCurrency).length > 0) {
    out.push(ins('payment', 'warn', scores.paymentRisk,
      'Payment follow-up needed',
      `Outstanding dues of ${moneyList(s.dueByCurrency)} across recent registrations. Consider a payment reminder.`));
  }

  if (s.openPackage && scores.renewalDue >= 0.6) {
    out.push(ins('renewal', 'info', scores.renewalDue,
      'Package nearly used up',
      `${s.openPackage.name || 'The open private package'} has ${s.openPackage.left} of ${s.openPackage.total}`
      + ' sessions left, a good moment to propose a renewal before the slot is released.'));
  }

  if (out.length === 0) {
    out.push(s.enoughData
      ? ins('allClear', 'positive', 0.5, 'No risk signals',
        `Attendance ${pct(s.attOverall)}% over ${s.totalSessions} sessions, no dues flagged, and the enrollment looks healthy.`)
      : ins('newHere', 'info', 0.1, 'Not enough history yet',
        'Once a few semesters of attendance and payments are recorded, the model will surface risks and highlights here.'));
  }

  out.sort((a, b) => b.priority - a.priority);
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function buildStudentOverview(
  studentId: string,
  studentFullName: string,
  startingDate: string | null,
): Promise<StudentOverview> {
  const programs = await apiRequest<ProgramsData>(`/api/portal/students/${studentId}/programs`);

  // Dues + dated attendance come from the registrations module; it is an
  // enrichment, so failures (or ambiguous name matches) degrade gracefully.
  let moduleRows: Row[] | null = null;
  if (studentFullName) {
    try {
      const rows = await apiRequest<Row[]>(
        `/api/portal/modules/registrations?searchFor=${encodeURIComponent(studentFullName)}&active=true&stopped=true`,
      );
      const mine = rows.filter((r) => str(r, 'StudentFullName').trim().toLowerCase() === studentFullName.trim().toLowerCase());
      if (mine.length > 0) moduleRows = mine;
    } catch { /* fall back to programs data only */ }
  }

  const signals = buildSignals(programs, moduleRows, startingDate);
  const outVec = getModel().predict(toFeatures(signals));
  const scores = {} as Record<OutputName, number>;
  OUTPUTS.forEach((name, i) => { scores[name] = outVec[i]; });

  return { signals, scores, insights: generateInsights(signals, scores) };
}

// ── Dashboard risk radar ─────────────────────────────────────────────────────
// Runs the same model over every active registration and ranks the students
// who most need attention. One bulk fetch, then pure on-device scoring.

export interface RadarEntry {
  studentId: number | null;
  name: string;
  phone: string;
  semester: string;
  scores: Record<OutputName, number>;
  topRisk: 'attendance' | 'churn' | 'payment';
  topScore: number;
  reasons: string[];
}

export interface RiskRadar {
  entries: RadarEntry[]; // flagged students, worst first (capped)
  scanned: number;       // distinct active students scored
  flagged: number;       // students at or above the flag threshold
}

const FLAG_THRESHOLD = 0.55;
const RADAR_CAP = 8;

export async function buildRiskRadar(): Promise<RiskRadar> {
  const rows = await apiRequest<Row[]>('/api/portal/modules/registrations?active=true&stopped=false');

  // Group registrations by student (id when the proc exposes one, else name).
  const studentIdOf = (r: Row) =>
    r['StudentID'] ?? r['StudentId'] ?? r['RegistrationStudentId'] ?? r['RegistrationStudentID'] ?? null;
  const byStudent = new Map<string, Row[]>();
  for (const r of rows) {
    const id = studentIdOf(r);
    const key = id != null && Number(id) > 0 ? `#${id}` : str(r, 'StudentFullName').trim().toLowerCase();
    if (!key || key === '#0') continue;
    const list = byStudent.get(key);
    if (list) list.push(r); else byStudent.set(key, [r]);
  }

  const net = getModel();
  const entries: RadarEntry[] = [];
  let flagged = 0;
  let scanned = 0;

  for (const regRows of byStudent.values()) {
    const regs: RegStat[] = regRows.map((r) => ({
      total: num(r, 'SessionsTotal'),
      attended: num(r, 'SessionsAttended'),
      due: num(r, 'DueAmount'),
      net: num(r, 'RegistrationNetToPay'),
      stopped: false,
      active: true,
      semester: str(r, 'SemesterName'),
      order: new Date(str(r, 'RegistrationDate')).getTime() || num(r, 'RegistrationID'),
      date: new Date(str(r, 'RegistrationDate')).getTime() || null,
    })).sort((a, b) => b.order - a.order);

    // Year gate: the radar is about current students. Anyone whose newest
    // registration is over ~13 months old belongs to a past year, skip.
    if (regs.length === 0 || isStale(regs[0], 400)) continue;
    scanned++;

    const withSessions = regs.filter((g) => g.total > 0);
    const recent = withSessions[0] ?? null;
    const totals = withSessions.reduce((s, g) => ({ t: s.t + g.total, a: s.a + g.attended }), { t: 0, a: 0 });
    const wTotals = withSessions.reduce((s, g, i) => {
      const w = regWeight(g, i);
      return { t: s.t + w * g.total, a: s.a + w * g.attended };
    }, { t: 0, a: 0 });
    const ratioRows = regs.filter((g) => g.net > 0 && !isStale(g, 730)).slice(0, 3);
    const dueRatio = ratioRows.length
      ? ratioRows.reduce((s, g) => s + clamp01(g.due / g.net), 0) / ratioRows.length : 0;
    const dueByCurrency: Record<string, number> = {};
    for (const g of regs) {
      if (g.due > 0 && !isStale(g, 730)) dueByCurrency[currencyOf(g.due)] = (dueByCurrency[currencyOf(g.due)] ?? 0) + g.due;
    }
    const enoughData = totals.t >= 6;
    const attRecent = recent ? recent.attended / recent.total : 0;
    const attOverall = wTotals.t > 0 ? wTotals.a / wTotals.t : 0;

    const outVec = net.predict([
      enoughData ? attRecent : 0.7,
      totals.t > 0 ? attOverall : 0.7,
      clamp01(((enoughData ? attRecent : 0.7) - (totals.t > 0 ? attOverall : 0.7) + 1) / 2),
      0, 1,               // active registration, not stopped
      dueRatio, 1,        // dues are known for module rows
      0.5, 0,             // no package info at radar granularity
      0.5,                // tenure unknown → neutral
    ]);
    const scores = {} as Record<OutputName, number>;
    OUTPUTS.forEach((name, i) => { scores[name] = outVec[i]; });

    // Attendance/churn flags need real history; payment only needs dues.
    const risks: [RadarEntry['topRisk'], number][] = [
      ['attendance', enoughData ? scores.attendanceRisk : 0],
      ['churn', enoughData ? scores.churnRisk : 0],
      ['payment', Object.keys(dueByCurrency).length ? scores.paymentRisk : 0],
    ];
    risks.sort((a, b) => b[1] - a[1]);
    const [topRisk, topScore] = risks[0];
    if (topScore < FLAG_THRESHOLD) continue;
    flagged++;

    const reasons: string[] = [];
    if (enoughData && scores.attendanceRisk >= FLAG_THRESHOLD && recent) {
      reasons.push(`${recent.attended}/${recent.total} attended in ${recent.semester || 'latest semester'}`);
      if (attOverall - attRecent > 0.15) reasons.push(`down from ${Math.round(attOverall * 100)}% overall`);
    }
    if (Object.keys(dueByCurrency).length && scores.paymentRisk >= FLAG_THRESHOLD) {
      reasons.push(`due ${moneyList(dueByCurrency)}`);
    }
    if (reasons.length === 0) reasons.push('multiple weak signals across registrations');

    const first = regRows[0];
    const id = studentIdOf(first);
    entries.push({
      studentId: id != null && Number(id) > 0 ? Number(id) : null,
      name: str(first, 'StudentFullName'),
      phone: str(first, 'PhoneNumber1'),
      semester: recent?.semester ?? str(first, 'SemesterName'),
      scores, topRisk, topScore, reasons,
    });
  }

  entries.sort((a, b) => b.topScore - a.topScore);
  const top = entries.slice(0, RADAR_CAP);

  // The registrations proc doesn't expose a student id, resolve the flagged
  // names against the students roster so each row links straight to the
  // student's page instead of a name search that may not match.
  await Promise.all(top.filter((e) => e.studentId == null).map(async (e) => {
    // The proc may not match a full "First Middle Last" string, try the full
    // name, then first + last word, then the first word alone, and take the
    // row whose full name matches exactly.
    const words = e.name.trim().split(/\s+/);
    const attempts = [e.name.trim()];
    if (words.length > 2) attempts.push(`${words[0]} ${words[words.length - 1]}`);
    if (words.length > 1) attempts.push(words[0]);
    for (const q of attempts) {
      try {
        const matches = await apiRequest<{ studentId: number; studentFullName: string | null }[]>(
          `/api/portal/students?searchFor=${encodeURIComponent(q)}`);
        const exact = matches.filter(
          (m) => (m.studentFullName ?? '').trim().toLowerCase() === e.name.trim().toLowerCase());
        const hit = exact.length >= 1 ? exact[0] : matches.length === 1 ? matches[0] : null;
        if (hit) { e.studentId = hit.studentId; break; }
      } catch { /* try the next form */ }
    }
  }));

  return { entries: top, scanned, flagged };
}

// ── AI outreach drafts ───────────────────────────────────────────────────────
// Message suggestions for contacting the family, worded from the model's
// strongest signal. Staff can edit before sending.

export interface OutreachDraft { title: string; message: string }

export function draftOutreach(overview: StudentOverview, studentName: string): OutreachDraft {
  const first = studentName.trim().split(/\s+/)[0] || 'your swimmer';
  const { scores, signals } = overview;
  const pct = Math.round(signals.attOverall * 100);

  if (scores.churnRisk >= 0.6 || (signals.enoughData && scores.attendanceRisk >= 0.6)) {
    return {
      title: `We miss ${first} at ProSwim!`,
      message:
        `Hello! We've noticed ${first} has been missing sessions at ProSwim lately and we wanted to check in, `
        + `is everything okay? Regular practice is what keeps the progress going, and the coach would love to see `
        + `${first} back in the water. If scheduling is the issue, tell us and we'll find a slot that works. 🏊`,
    };
  }
  if (scores.paymentRisk >= 0.55 && Object.keys(signals.dueByCurrency).length > 0) {
    const dues = Object.entries(signals.dueByCurrency)
      .map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`).join(' + ');
    return {
      title: 'A friendly payment reminder',
      message:
        `Hello! A gentle reminder from ProSwim: there is an outstanding balance of ${dues} on ${first}'s course. `
        + `You can settle it at the reception on your next visit, or reply here if anything needs clarifying. Thank you!`,
    };
  }
  if (signals.openPackage && scores.renewalDue >= 0.6) {
    return {
      title: `${first}'s package is almost done`,
      message:
        `Hello! ${first}'s private package has only ${signals.openPackage.left} session(s) left. `
        + `Renewing early keeps the same time slot and coach reserved, shall we prepare the renewal?`,
    };
  }
  return {
    title: `Great progress from ${first}!`,
    message:
      `Hello! Just a quick note from ProSwim: ${first} is doing great`
      + (signals.enoughData ? ` with ${pct}% attendance this period` : '')
      + `. Keep it up, we're proud of the progress! 🏊`,
  };
}
