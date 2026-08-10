import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, Trophy, Medal, Timer, TrendingUp,
  FileText, Star, CalendarDays, Plus, Trash2, Pencil, X, ExternalLink,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';

type Row = Record<string, unknown>;

interface Portfolio {
  personalBests: Row[];
  results: Row[];
  awards: Row[];
  documents: Row[];
  evaluations: Row[];
  upcomingCompetitions: Row[];
}

const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

// ── time helpers: DB stores milliseconds ─────────────────────────────────────
export function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d{1,3})?)$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseFloat(m[2]);
  if (seconds >= 60 && minutes > 0) return null;
  return Math.round((minutes * 60 + seconds) * 1000);
}

function fmtDate(v: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const AWARD_COLORS: Record<string, string> = {
  Gold: 'bg-amber-50 text-amber-700 border-amber-200',
  Silver: 'bg-slate-100 text-slate-600 border-slate-300',
  Bronze: 'bg-orange-50 text-orange-700 border-orange-200',
};

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

// ── progress chart: time (lower is better) over date, per event ──────────────
function TimeChart({ points }: { points: { date: number; ms: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-slate-400">Add at least two timed results for this event to see progress.</p>;
  }
  const W = 560, H = 170, PX = 44, PY = 22;
  const xs = points.map((p) => p.date);
  const ys = points.map((p) => p.ms);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const ySpan = Math.max(yMax - yMin, 1);
  const xSpan = Math.max(xMax - xMin, 1);
  const X = (v: number) => PX + ((v - xMin) / xSpan) * (W - PX * 2);
  // faster (smaller ms) plots higher
  const Y = (v: number) => PY + ((v - yMin) / ySpan) * (H - PY * 2);
  const path = points.map((p) => `${X(p.date).toFixed(1)},${Y(p.ms).toFixed(1)}`).join(' ');
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl">
        <line x1={PX} y1={H - PY} x2={W - PX} y2={H - PY} stroke="#e2e8f0" />
        <line x1={PX} y1={PY} x2={PX} y2={H - PY} stroke="#e2e8f0" />
        <text x={PX - 6} y={PY + 4} textAnchor="end" fontSize="10" fill="#16a34a">{fmtMs(yMin)}</text>
        <text x={PX - 6} y={H - PY} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtMs(yMax)}</text>
        <text x={PX} y={H - 6} fontSize="10" fill="#94a3b8">{fmtDate(new Date(xMin).toISOString())}</text>
        <text x={W - PX} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtDate(new Date(xMax).toISOString())}</text>
        <polyline points={path} fill="none" stroke="#1e5c97" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={X(p.date)} cy={Y(p.ms)} r={i === points.length - 1 ? 4.5 : 3}
            fill={p.ms === yMin ? '#16a34a' : '#1e5c97'} />
        ))}
      </svg>
      <p className="text-[11px] text-slate-400 mt-1">Lower is better — green dot marks the personal best.</p>
    </div>
  );
}

function Section({ icon, title, right, children }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</p>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export function CompPortfolioPage() {
  const { id } = useParams<{ id: string }>();
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [data, setData] = useState<Portfolio | null>(null);
  const [studentName, setStudentName] = useState('');
  const [competitions, setCompetitions] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [chartEvent, setChartEvent] = useState('');

  const load = useCallback(() => {
    apiRequest<Portfolio>(`/api/portal/comp/students/${id}/portfolio`).then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load portfolio.'));
  }, [id]);

  useEffect(() => {
    load();
    apiRequest<Row[]>('/api/portal/comp/competitions').then(setCompetitions).catch(() => {});
    apiRequest<Row>(`/api/portal/students/${id}`)
      .then((r) => setStudentName(String(r.StudentFullName ?? '')))
      .catch(() => {});
  }, [id, load]);

  // events that have at least one timed result, for the chart selector
  const chartEvents = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.results ?? []) if (num(r, 'TimeMs') > 0) set.add(str(r, 'EventName'));
    return [...set].sort();
  }, [data]);

  useEffect(() => {
    if (!chartEvent && chartEvents.length > 0) setChartEvent(chartEvents[0]);
  }, [chartEvents, chartEvent]);

  const chartPoints = useMemo(() => {
    return (data?.results ?? [])
      .filter((r) => str(r, 'EventName') === chartEvent && num(r, 'TimeMs') > 0 && str(r, 'ResultDate'))
      .map((r) => ({ date: new Date(str(r, 'ResultDate')).getTime(), ms: num(r, 'TimeMs') }))
      .filter((p) => !isNaN(p.date))
      .sort((a, b) => a.date - b.date);
  }, [data, chartEvent]);

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const del = (path: string, label: string) => {
    if (!window.confirm(`Delete this ${label}?`)) return;
    void mutate(() => apiRequest(path, { method: 'DELETE' }));
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        {error
          ? <p className="text-sm text-red-600">{error}</p>
          : <Loader2 className="size-8 text-[#1e5c97] animate-spin" />}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <Link to={`/students/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e5c97]">
          <ArrowLeft className="size-4" /> Back to student
        </Link>
        <Link to="/competitions" className="text-sm font-semibold text-[#1e5c97] hover:underline">
          Manage competitions →
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Trophy className="size-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitive Portfolio</h1>
          <p className="text-sm text-slate-500">{studentName || `Student #${id}`}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Personal bests */}
        <Section icon={<Timer className="size-4 text-[#1e5c97]" />} title="Personal Best Times">
          {data.personalBests.length === 0
            ? <p className="text-sm text-slate-400">No timed results yet — bests appear automatically from results below.</p>
            : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.personalBests.map((b) => (
                  <div key={str(b, 'EventName')} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <p className="text-xs font-semibold text-slate-500">{str(b, 'EventName')}</p>
                    <p className="text-xl font-bold text-[#1e5c97]">{fmtMs(num(b, 'TimeMs'))}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {fmtDate(str(b, 'ResultDate'))}{str(b, 'CompetitionName') && ` · ${str(b, 'CompetitionName')}`}
                    </p>
                    {b.IsRecord === true && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                        ★ {str(b, 'RecordLevel') || 'Record'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
        </Section>

        {/* Progress chart */}
        <Section
          icon={<TrendingUp className="size-4 text-emerald-600" />}
          title="Progress"
          right={chartEvents.length > 0 && (
            <select value={chartEvent} onChange={(e) => setChartEvent(e.target.value)} className={inputCls + ' w-auto'}>
              {chartEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          )}
        >
          {chartEvents.length === 0
            ? <p className="text-sm text-slate-400">Charts appear once timed results are recorded.</p>
            : <TimeChart points={chartPoints} />}
        </Section>

        {/* Results */}
        <ResultsSection data={data} competitions={competitions} canSave={canSave} busy={busy} mutate={mutate} del={del} studentId={id!} />

        {/* Awards */}
        <AwardsSection data={data} canSave={canSave} busy={busy} mutate={mutate} del={del} studentId={id!} />

        {/* Upcoming competitions */}
        <Section icon={<CalendarDays className="size-4 text-[#1e5c97]" />} title="Upcoming Competitions">
          {data.upcomingCompetitions.length === 0
            ? <p className="text-sm text-slate-400">Nothing scheduled. Add competitions via “Manage competitions”.</p>
            : (
              <div className="space-y-2">
                {data.upcomingCompetitions.map((c) => (
                  <div key={num(c, 'CompetitionId')} className="flex items-baseline justify-between gap-3 text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                    <div>
                      <span className="font-semibold text-slate-800">{str(c, 'CompetitionName')}</span>
                      {str(c, 'Location') && <span className="text-slate-500"> · {str(c, 'Location')}</span>}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{fmtDate(str(c, 'StartDate'))}</span>
                  </div>
                ))}
              </div>
            )}
        </Section>

        {/* Documents */}
        <DocumentsSection data={data} canSave={canSave} busy={busy} mutate={mutate} del={del} studentId={id!} />

        {/* Evaluations */}
        <EvaluationsSection data={data} canSave={canSave} busy={busy} mutate={mutate} del={del} studentId={id!} />
      </div>
    </div>
  );
}

// ── Results section (add / edit / delete) ────────────────────────────────────
interface SectionProps {
  data: Portfolio;
  canSave: boolean;
  busy: boolean;
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
  del: (path: string, label: string) => void;
  studentId: string;
}

const emptyResult = {
  eventName: '', timeText: '', finishRank: '', resultDate: '', competitionId: 0,
  competitionName: '', isRecord: false, recordLevel: '', remarks: '',
};

function ResultsSection({ data, competitions, canSave, busy, mutate, del, studentId }:
  SectionProps & { competitions: Row[] }) {
  const [editingId, setEditingId] = useState<number | null>(null); // null closed, 0 new
  const [form, setForm] = useState(emptyResult);
  const [formError, setFormError] = useState('');

  function startEdit(r?: Row) {
    setFormError('');
    if (!r) {
      setForm(emptyResult);
      setEditingId(0);
      return;
    }
    setForm({
      eventName: str(r, 'EventName'),
      timeText: num(r, 'TimeMs') > 0 ? fmtMs(num(r, 'TimeMs')) : '',
      finishRank: num(r, 'FinishRank') > 0 ? String(num(r, 'FinishRank')) : '',
      resultDate: str(r, 'ResultDate') ? str(r, 'ResultDate').slice(0, 10) : '',
      competitionId: num(r, 'CompetitionId'),
      competitionName: num(r, 'CompetitionId') > 0 ? '' : str(r, 'CompetitionName'),
      isRecord: r.IsRecord === true,
      recordLevel: str(r, 'RecordLevel'),
      remarks: str(r, 'Remarks'),
    });
    setEditingId(num(r, 'ResultId'));
  }

  function submit() {
    if (!form.eventName.trim()) { setFormError('Event name is required.'); return; }
    const ms = form.timeText.trim() ? parseTime(form.timeText) : null;
    if (form.timeText.trim() && ms == null) { setFormError('Time must look like 32.45 or 1:05.32'); return; }
    const body = {
      competitionId: form.competitionId > 0 ? form.competitionId : null,
      competitionName: form.competitionId > 0 ? null : (form.competitionName.trim() || null),
      eventName: form.eventName.trim(),
      timeMs: ms,
      finishRank: form.finishRank ? Number(form.finishRank) : null,
      resultDate: form.resultDate || null,
      isRecord: form.isRecord,
      recordLevel: form.isRecord ? (form.recordLevel.trim() || null) : null,
      remarks: form.remarks.trim() || null,
    };
    void mutate(async () => {
      if (editingId === 0) await apiRequest(`/api/portal/comp/students/${studentId}/results`, { method: 'POST', body: JSON.stringify(body) });
      else await apiRequest(`/api/portal/comp/results/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditingId(null);
    });
  }

  return (
    <Section
      icon={<Medal className="size-4 text-[#1e5c97]" />}
      title="Competition Results"
      right={canSave && editingId === null && (
        <button onClick={() => startEdit()} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e5c97] hover:underline">
          <Plus className="size-4" /> Add result
        </button>
      )}
    >
      {editingId !== null && (
        <div className="rounded-xl border border-[#1e5c97]/20 bg-[#e8f0f8]/40 p-4 mb-4">
          {formError && <p className="text-sm text-red-600 mb-2">{formError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Event *</label>
              <input className={inputCls} value={form.eventName} placeholder="50m Freestyle"
                onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Time (m:ss.hh)</label>
              <input className={inputCls} value={form.timeText} placeholder="32.45"
                onChange={(e) => setForm({ ...form, timeText: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Place / rank</label>
              <input className={inputCls} type="number" value={form.finishRank}
                onChange={(e) => setForm({ ...form, finishRank: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input className={inputCls} type="date" value={form.resultDate}
                onChange={(e) => setForm({ ...form, resultDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Competition</label>
              <select className={inputCls} value={form.competitionId}
                onChange={(e) => setForm({ ...form, competitionId: Number(e.target.value) })}>
                <option value={0}>Other / not listed</option>
                {competitions.map((c) => (
                  <option key={num(c, 'CompetitionId')} value={num(c, 'CompetitionId')}>{str(c, 'CompetitionName')}</option>
                ))}
              </select>
            </div>
            {form.competitionId === 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Competition name (free text)</label>
                <input className={inputCls} value={form.competitionName}
                  onChange={(e) => setForm({ ...form, competitionName: e.target.value })} />
              </div>
            )}
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                <input type="checkbox" checked={form.isRecord} className="accent-[#1e5c97]"
                  onChange={(e) => setForm({ ...form, isRecord: e.target.checked })} />
                Official record
              </label>
            </div>
            {form.isRecord && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Record level</label>
                <input className={inputCls} value={form.recordLevel} placeholder="Club record U14"
                  onChange={(e) => setForm({ ...form, recordLevel: e.target.value })} />
              </div>
            )}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Remarks</label>
              <input className={inputCls} value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={submit} disabled={busy}
              className="rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-4 py-1.5 hover:bg-[#17497a] disabled:opacity-60">
              {editingId === 0 ? 'Add result' : 'Save changes'}
            </button>
            <button onClick={() => setEditingId(null)} disabled={busy}
              className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-50">
              <X className="size-4 inline -mt-0.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {data.results.length === 0
        ? <p className="text-sm text-slate-400">No results recorded yet.</p>
        : (
          <div className="overflow-x-auto">
            <table className="tbl w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-left">Event</th>
                  <th className="text-left">Time</th>
                  <th className="text-left">Place</th>
                  <th className="text-left">Competition</th>
                  <th className="text-left">Record</th>
                  {canSave && <th />}
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={num(r, 'ResultId')}>
                    <td className="whitespace-nowrap">{fmtDate(str(r, 'ResultDate'))}</td>
                    <td>{str(r, 'EventName')}</td>
                    <td className="font-semibold text-[#1e5c97]">{fmtMs(num(r, 'TimeMs'))}</td>
                    <td>{num(r, 'FinishRank') > 0 ? `#${num(r, 'FinishRank')}` : '—'}</td>
                    <td>{str(r, 'CompetitionName') || '—'}</td>
                    <td>
                      {r.IsRecord === true && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                          ★ {str(r, 'RecordLevel') || 'Record'}
                        </span>
                      )}
                    </td>
                    {canSave && (
                      <td className="whitespace-nowrap text-right">
                        <button onClick={() => startEdit(r)} title="Edit" className="text-slate-400 hover:text-[#1e5c97] p-1">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => del(`/api/portal/comp/results/${num(r, 'ResultId')}`, 'result')}
                          title="Delete" className="text-slate-400 hover:text-red-600 p-1">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Section>
  );
}

// ── Awards ───────────────────────────────────────────────────────────────────
function AwardsSection({ data, canSave, busy, mutate, del, studentId }: SectionProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ awardTitle: '', awardType: 'Gold', competitionName: '', awardDate: '', notes: '' });

  function submit() {
    if (!form.awardTitle.trim()) return;
    void mutate(async () => {
      await apiRequest(`/api/portal/comp/students/${studentId}/awards`, {
        method: 'POST',
        body: JSON.stringify({
          awardTitle: form.awardTitle.trim(),
          awardType: form.awardType,
          competitionName: form.competitionName.trim() || null,
          awardDate: form.awardDate || null,
          notes: form.notes.trim() || null,
        }),
      });
      setAdding(false);
      setForm({ awardTitle: '', awardType: 'Gold', competitionName: '', awardDate: '', notes: '' });
    });
  }

  return (
    <Section
      icon={<Trophy className="size-4 text-amber-500" />}
      title="Awards & Medals"
      right={canSave && !adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e5c97] hover:underline">
          <Plus className="size-4" /> Add award
        </button>
      )}
    >
      {adding && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title *</label>
            <input className={inputCls} value={form.awardTitle} placeholder="Gold — 50m Freestyle"
              onChange={(e) => setForm({ ...form, awardTitle: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
            <select className={inputCls} value={form.awardType} onChange={(e) => setForm({ ...form, awardType: e.target.value })}>
              {['Gold', 'Silver', 'Bronze', 'Trophy', 'Certificate', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
            <input className={inputCls} type="date" value={form.awardDate} onChange={(e) => setForm({ ...form, awardDate: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Competition</label>
            <input className={inputCls} value={form.competitionName} onChange={(e) => setForm({ ...form, competitionName: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
            <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button onClick={submit} disabled={busy}
              className="rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-4 py-1.5 hover:bg-[#17497a] disabled:opacity-60">Add</button>
            <button onClick={() => setAdding(false)}
              className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}
      {data.awards.length === 0
        ? <p className="text-sm text-slate-400">No awards yet.</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.awards.map((a) => (
              <div key={num(a, 'AwardId')}
                className={`flex items-start justify-between gap-2 rounded-xl border p-3 ${AWARD_COLORS[str(a, 'AwardType')] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                <div className="flex items-start gap-2 min-w-0">
                  <Medal className="size-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{str(a, 'AwardTitle')}</p>
                    <p className="text-xs opacity-75">
                      {[str(a, 'CompetitionName'), fmtDate(str(a, 'AwardDate')) !== '—' ? fmtDate(str(a, 'AwardDate')) : '']
                        .filter(Boolean).join(' · ') || str(a, 'AwardType')}
                    </p>
                  </div>
                </div>
                {canSave && (
                  <button onClick={() => del(`/api/portal/comp/awards/${num(a, 'AwardId')}`, 'award')}
                    className="opacity-50 hover:opacity-100 p-0.5 shrink-0"><Trash2 className="size-4" /></button>
                )}
              </div>
            ))}
          </div>
        )}
    </Section>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────
function DocumentsSection({ data, canSave, busy, mutate, del, studentId }: SectionProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', competitionName: '', clubWide: false });

  function submit() {
    if (!form.title.trim() || !form.url.trim()) return;
    void mutate(async () => {
      await apiRequest(`/api/portal/comp/students/${studentId}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(), url: form.url.trim(),
          competitionName: form.competitionName.trim() || null, clubWide: form.clubWide,
        }),
      });
      setAdding(false);
      setForm({ title: '', url: '', competitionName: '', clubWide: false });
    });
  }

  return (
    <Section
      icon={<FileText className="size-4 text-slate-500" />}
      title="Competition Documents"
      right={canSave && !adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e5c97] hover:underline">
          <Plus className="size-4" /> Add link
        </button>
      )}
    >
      {adding && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title *</label>
            <input className={inputCls} value={form.title} placeholder="Entry form / heat sheet"
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Link (Drive/Dropbox/URL) *</label>
            <input className={inputCls} value={form.url} placeholder="https://…"
              onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Competition</label>
            <input className={inputCls} value={form.competitionName}
              onChange={(e) => setForm({ ...form, competitionName: e.target.value })} />
          </div>
          <label className="flex items-end gap-2 text-sm text-slate-700 select-none pb-1.5">
            <input type="checkbox" checked={form.clubWide} className="accent-[#1e5c97]"
              onChange={(e) => setForm({ ...form, clubWide: e.target.checked })} />
            Club-wide (visible to every team swimmer)
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button onClick={submit} disabled={busy}
              className="rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-4 py-1.5 hover:bg-[#17497a] disabled:opacity-60">Add</button>
            <button onClick={() => setAdding(false)}
              className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}
      {data.documents.length === 0
        ? <p className="text-sm text-slate-400">No documents linked yet.</p>
        : (
          <div className="space-y-1.5">
            {data.documents.map((d) => (
              <div key={num(d, 'DocumentId')} className="flex items-center justify-between gap-3 text-sm border-b border-slate-50 last:border-0 pb-1.5 last:pb-0">
                <a href={str(d, 'Url')} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#1e5c97] hover:underline min-w-0">
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">{str(d, 'Title')}</span>
                </a>
                <div className="flex items-center gap-2 shrink-0">
                  {d.StudentId == null && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Club-wide</span>
                  )}
                  <span className="text-xs text-slate-400">{fmtDate(str(d, 'UploadedDate'))}</span>
                  {canSave && (
                    <button onClick={() => del(`/api/portal/comp/documents/${num(d, 'DocumentId')}`, 'document')}
                      className="text-slate-300 hover:text-red-600"><Trash2 className="size-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </Section>
  );
}

// ── Evaluations ──────────────────────────────────────────────────────────────
function EvaluationsSection({ data, canSave, busy, mutate, del, studentId }: SectionProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ rating: 3, comments: '', coachName: '' });

  function submit() {
    void mutate(async () => {
      await apiRequest(`/api/portal/comp/students/${studentId}/evaluations`, {
        method: 'POST',
        body: JSON.stringify({
          rating: form.rating,
          comments: form.comments.trim() || null,
          coachName: form.coachName.trim() || null,
        }),
      });
      setAdding(false);
      setForm({ rating: 3, comments: '', coachName: '' });
    });
  }

  return (
    <Section
      icon={<Star className="size-4 text-amber-500" />}
      title="Coach Evaluations"
      right={canSave && !adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e5c97] hover:underline">
          <Plus className="size-4" /> Add evaluation
        </button>
      )}
    >
      {adding && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 mb-4 space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setForm({ ...form, rating: n })} title={`${n}/5`}>
                    <Star className={`size-6 ${n <= form.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Coach (defaults to you)</label>
              <input className={inputCls} value={form.coachName} onChange={(e) => setForm({ ...form, coachName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Comments</label>
            <textarea className={inputCls} rows={3} value={form.comments}
              placeholder="Technique, endurance, attitude, focus areas…"
              onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy}
              className="rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-4 py-1.5 hover:bg-[#17497a] disabled:opacity-60">Add</button>
            <button onClick={() => setAdding(false)}
              className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}
      {data.evaluations.length === 0
        ? <p className="text-sm text-slate-400">No evaluations yet.</p>
        : (
          <div className="space-y-3">
            {data.evaluations.map((ev) => (
              <div key={num(ev, 'EvaluationId')} className="border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{str(ev, 'CoachName') || 'Coach'}</span>
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`size-3.5 ${n <= num(ev, 'Rating') ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">{fmtDate(str(ev, 'EvalDate'))}</span>
                    {canSave && (
                      <button onClick={() => del(`/api/portal/comp/evaluations/${num(ev, 'EvaluationId')}`, 'evaluation')}
                        className="text-slate-300 hover:text-red-600"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                </div>
                {str(ev, 'Comments') && <p className="text-sm text-slate-600 mt-1">{str(ev, 'Comments')}</p>}
              </div>
            ))}
          </div>
        )}
    </Section>
  );
}
