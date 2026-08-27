// Feedback dashboard — results of the 15-question mobile survey, with
// per-question score bars, rating distributions, monthly trend and the
// individual responses. SiteMaster can edit the survey questions in place.

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertCircle, Star, Search, MessageSquare, Pencil, Save, Plus, X,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (v == null ? '' : String(v));
const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const scoreColor = (avg: number) =>
  avg >= 4.2 ? '#059669' : avg >= 3.3 ? '#F59E0B' : '#DC2626';

const DIST_COLORS = ['#DC2626', '#F97316', '#F59E0B', '#84CC16', '#059669']; // 1..5

interface Summary {
  totals: { Responses: number; OverallAvg: number | null } | null;
  perQuestion: Row[];
  monthly: Row[];
}

export function FeedbackDashboardPage() {
  const user = getStoredUser();
  const isSiteMaster = (user?.userType || '').toLowerCase() === 'sitemaster';

  const [refType, setRefType] = useState('');
  const [coach, setCoach] = useState('');
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState<{ value: number; label: string }[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [coaches, setCoaches] = useState<Row[]>([]);
  const [responses, setResponses] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    apiRequest<{ locations: { value: number; label: string }[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError('');
    const q = new URLSearchParams();
    if (refType) q.set('refType', refType);
    if (coach) q.set('coach', coach);
    if (location) q.set('location', location);
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    const qc = new URLSearchParams(); // coach board ignores the coach filter itself
    if (refType) qc.set('refType', refType);
    if (location) qc.set('location', location);
    if (dateFrom) qc.set('dateFrom', dateFrom);
    if (dateTo) qc.set('dateTo', dateTo);
    Promise.all([
      apiRequest<Summary>(`/api/portal/feedback/summary?${q}`),
      apiRequest<Row[]>(`/api/portal/feedback/responses?${q}`),
      apiRequest<Row[]>(`/api/portal/feedback/coaches?${qc}`),
    ])
      .then(([sm, rs, cs]) => { setSummary(sm); setResponses(rs); setCoaches(cs); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load feedback.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [refType, coach, location]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratingQs = useMemo(
    () => (summary?.perQuestion ?? []).filter((q) => str(q.QuestionType) === 'rating'),
    [summary],
  );
  const overall = summary?.totals?.OverallAvg != null ? Number(summary.totals.OverallAvg) : null;
  const totalResponses = num(summary?.totals?.Responses);
  const maxMonthly = Math.max(1, ...(summary?.monthly ?? []).map((m) => num(m.Responses)));

  return (
    <div className="p-6 md:p-8">
      <PageHero title="Feedback" subtitle="What families say about coaches and the experience" slide={1} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={refType} onChange={(e) => setRefType(e.target.value)} className={inputCls}>
          <option value="">Group + Private</option>
          <option value="Group">Group only</option>
          <option value="Private">Private only</option>
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputCls} max-w-40`}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.value} value={l.label}>{l.label}</option>)}
        </select>
        <select value={coach} onChange={(e) => setCoach(e.target.value)} className={`${inputCls} max-w-48`}>
          <option value="">All coaches</option>
          {coaches.map((c) => (
            <option key={str(c.CoachName)} value={str(c.CoachName)}>{str(c.CoachName)}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        <span className="text-slate-400 text-sm">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-4 py-1.5">
          <Search className="size-4" /> Apply
        </button>
        <div className="flex-1" />
        {isSiteMaster && (
          <button onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-1.5 hover:border-[#1e5c97]/40">
            <Pencil className="size-4" /> {editing ? 'Close editor' : 'Edit questions'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {editing && <QuestionEditor onSaved={() => { setEditing(false); load(); }} />}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : summary && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responses</p>
              <p className="text-4xl font-extrabold text-slate-900 tabular-nums">{totalResponses.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Overall score</p>
              <div className="flex items-center gap-2">
                <p className="text-4xl font-extrabold tabular-nums" style={{ color: overall != null ? scoreColor(overall) : '#94A3B8' }}>
                  {overall != null ? overall.toFixed(2) : '—'}
                </p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Star key={v} className="size-5"
                      style={{
                        color: overall != null && overall >= v - 0.5 ? '#F59E0B' : '#E2E8F0',
                        fill: overall != null && overall >= v - 0.5 ? '#F59E0B' : 'none',
                      }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Responses per month</p>
              <div className="flex items-end gap-1 h-14">
                {(summary.monthly ?? []).slice(-12).map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${str(m.Month)}: ${num(m.Responses)} responses · avg ${num(m.Avg).toFixed(2)}`}>
                    <div className="w-full rounded-t"
                      style={{
                        height: `${Math.max(8, (num(m.Responses) / maxMonthly) * 100)}%`,
                        background: scoreColor(num(m.Avg)),
                        opacity: 0.85,
                      }} />
                    <span className="text-[8px] text-slate-400">{str(m.Month).slice(5)}</span>
                  </div>
                ))}
                {(summary.monthly ?? []).length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
              </div>
            </div>
          </div>

          {/* Coach ratings */}
          {coaches.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Coach ratings</p>
              <div className="space-y-3">
                {coaches.map((c) => {
                  const avg = c.Avg != null ? Number(c.Avg) : null;
                  const isActive = coach === str(c.CoachName);
                  return (
                    <button key={str(c.CoachName)}
                      onClick={() => setCoach(isActive ? '' : str(c.CoachName))}
                      title={isActive ? 'Clear coach filter' : 'Filter by this coach'}
                      className={`w-full text-left rounded-xl p-2 -m-2 transition-colors ${isActive ? 'bg-[#e8f0f8]' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="text-sm font-bold text-slate-800">{str(c.CoachName)}</p>
                        <p className="text-sm font-extrabold tabular-nums shrink-0"
                          style={{ color: avg != null ? scoreColor(avg) : '#94A3B8' }}>
                          {avg != null ? avg.toFixed(2) : '—'}
                          <span className="text-xs font-normal text-slate-400"> ({num(c.Responses)} response{num(c.Responses) === 1 ? '' : 's'})</span>
                        </p>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${avg != null ? (avg / 5) * 100 : 0}%`, background: avg != null ? scoreColor(avg) : '#E2E8F0' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-question bars */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Scores by question</p>
            {ratingQs.length === 0 && <p className="text-sm text-slate-400">No rating questions.</p>}
            <div className="space-y-4">
              {ratingQs.map((q) => {
                const avg = q.Avg != null ? Number(q.Avg) : null;
                const cnt = num(q.Cnt);
                const dist = [num(q.R1), num(q.R2), num(q.R3), num(q.R4), num(q.R5)];
                const distTotal = dist.reduce((a, b) => a + b, 0);
                return (
                  <div key={num(q.QuestionId)}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-slate-700">
                        <span className="text-slate-400 font-bold">{num(q.QuestionOrder)}.</span> {str(q.QuestionText)}
                      </p>
                      <p className="text-sm font-extrabold tabular-nums shrink-0" style={{ color: avg != null ? scoreColor(avg) : '#94A3B8' }}>
                        {avg != null ? avg.toFixed(2) : '—'} <span className="text-xs font-normal text-slate-400">({cnt})</span>
                      </p>
                    </div>
                    {/* Average bar */}
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${avg != null ? (avg / 5) * 100 : 0}%`, background: avg != null ? scoreColor(avg) : '#E2E8F0' }} />
                    </div>
                    {/* 1..5 distribution strip */}
                    {distTotal > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden">
                        {dist.map((d, i) => d > 0 && (
                          <div key={i} title={`${i + 1}★: ${d}`}
                            style={{ width: `${(d / distTotal) * 100}%`, background: DIST_COLORS[i] }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual responses */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 p-5 pb-0">
              Responses ({responses.length.toLocaleString()})
            </p>
            <table className="tbl w-full text-sm whitespace-nowrap [&_td]:py-2.5 [&_td]:px-4 [&_th]:py-2.5 [&_th]:px-4">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-left">Student</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Coach</th>
                  <th className="text-left">Course</th>
                  <th className="text-right">Score</th>
                  <th className="text-left">Suggestions</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-6">No feedback submitted yet — surveys appear in the mobile app on every registration and package card.</td></tr>
                )}
                {responses.map((r) => {
                  const avg = r.Avg != null ? Number(r.Avg) : null;
                  return (
                    <tr key={num(r.FeedbackId)}>
                      <td>{r.FilledDate ? new Date(str(r.FilledDate)).toLocaleDateString() : '—'}</td>
                      <td className="font-semibold">{str(r.StudentName) || `#${num(r.StudentId)}`}</td>
                      <td>
                        <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                          str(r.RefType) === 'Private' ? 'bg-purple-50 text-purple-700' : 'bg-[#e8f0f8] text-[#1e5c97]'
                        }`}>{str(r.RefType)}</span>
                      </td>
                      <td>{str(r.LocationName) || '—'}</td>
                      <td>{str(r.CoachName) || '—'}</td>
                      <td className="max-w-52 truncate" title={str(r.RefLabel)}>{str(r.RefLabel) || '—'}</td>
                      <td className="text-right font-extrabold tabular-nums" style={{ color: avg != null ? scoreColor(avg) : '#94A3B8' }}>
                        {avg != null ? avg.toFixed(2) : '—'}
                      </td>
                      <td className="max-w-72 whitespace-normal text-slate-600">
                        {str(r.Suggestions) && (
                          <span className="flex items-start gap-1.5">
                            <MessageSquare className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                            {str(r.Suggestions)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Question editor (SiteMaster) ────────────────────────────────────────────

interface QuestionDraft { questionId?: number; order: number; text: string; type: string; active: boolean }

function QuestionEditor({ onSaved }: { onSaved: () => void }) {
  const [questions, setQuestions] = useState<QuestionDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Row[]>('/api/portal/feedback/questions')
      .then((rows) => setQuestions(rows.map((r) => ({
        questionId: num(r.QuestionId),
        order: num(r.QuestionOrder),
        text: str(r.QuestionText),
        type: str(r.QuestionType),
        active: r.QuestionActive === true,
      }))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load questions.'));
  }, []);

  function patch(i: number, p: Partial<QuestionDraft>) {
    setQuestions((prev) => (prev ?? []).map((q, j) => (j === i ? { ...q, ...p } : q)));
  }

  async function save() {
    if (!questions) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/portal/feedback/questions', {
        method: 'PUT',
        body: JSON.stringify({ questions }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the questions.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1e5c97]/20 shadow-soft p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Survey questions</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {!questions ? (
        <Loader2 className="size-5 text-[#1e5c97] animate-spin" />
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {questions.map((q, i) => (
              <div key={q.questionId ?? `new-${i}`} className={`flex items-center gap-2 ${q.active ? '' : 'opacity-50'}`}>
                <span className="text-xs font-bold text-slate-400 w-6 shrink-0">{q.order}.</span>
                <input value={q.text} onChange={(e) => patch(i, { text: e.target.value })}
                  className={`${inputCls} flex-1`} />
                <select value={q.type} onChange={(e) => patch(i, { type: e.target.value })} className={inputCls}>
                  <option value="rating">1–5 stars</option>
                  <option value="text">Free text</option>
                </select>
                <button onClick={() => patch(i, { active: !q.active })}
                  title={q.active ? 'Deactivate' : 'Activate'}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${
                    q.active ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-400'
                  }`}>
                  {q.active ? 'Active' : <X className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuestions((prev) => [...(prev ?? []), {
                order: (prev?.length ?? 0) + 1, text: '', type: 'rating', active: true,
              }])}
              className="flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold px-3 py-1.5 hover:border-[#1e5c97]/40">
              <Plus className="size-4" /> Add question
            </button>
            <div className="flex-1" />
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save questions
            </button>
          </div>
        </>
      )}
    </div>
  );
}
