// Multi-session generate (ClassesSessionsIndividualMulti.aspx). Pick a semester
// + date; the classes scheduled that day appear as a checklist; generate creates
// one session per checked class on that date, skipping any that already exist.

import { useEffect, useState } from 'react';
import { Loader2, CalendarPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

type Opt = { value: number; label: string };
interface ClassRow { ClassID: number; ClassName: string }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GenerateSessionsPage() {
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [locations, setLocations] = useState<Opt[]>([]);
  const [semesters, setSemesters] = useState<Opt[]>([]);
  const [locationId, setLocationId] = useState(user?.primaryLocationId || 0);
  const [semesterId, setSemesterId] = useState(0);
  const [date, setDate] = useState(todayStr());
  const [status, setStatus] = useState('Active');
  const [remarks, setRemarks] = useState('');

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);

  // Locations once.
  useEffect(() => {
    apiRequest<{ locations: { value: number; label: string }[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  // Location → semesters cascade (open on the current semester).
  useEffect(() => {
    apiRequest<{ semesters: Record<string, unknown>[]; currentSemesterId: number }>(
      `/api/portal/schedule/semesters?locationId=${locationId || 0}`
    )
      .then((r) => {
        const opts = (r.semesters ?? [])
          .map((s) => ({ value: Number(s.SemesterId ?? s.SemesterID ?? 0), label: String(s.SemesterName ?? '') }))
          .filter((o) => o.value > 0);
        setSemesters(opts);
        setSemesterId(r.currentSemesterId || Number(opts[0]?.value) || 0);
      })
      .catch(() => setSemesters([]));
  }, [locationId]);

  function loadClasses() {
    if (!semesterId) { setError('Pick a semester first.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    apiRequest<ClassRow[]>(`/api/portal/modules/classes-for-multi?semesterId=${semesterId}&date=${date}`)
      .then((data) => {
        setClasses(data);
        setChecked(new Set(data.map((c) => c.ClassID))); // default: all checked
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load classes.'))
      .finally(() => setLoading(false));
  }

  function toggle(id: number) {
    setChecked((old) => {
      const n = new Set(old);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function generate() {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const r = await apiRequest<{ generated: number; skipped: number }>('/api/portal/edit/generate-sessions', {
        method: 'POST',
        body: JSON.stringify({ classIds: [...checked], date, status, remarks }),
      });
      setResult(r);
      toast.success(`${r.generated} session(s) generated${r.skipped ? `, ${r.skipped} skipped` : ''}.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Generation failed.';
      setError(m); toast.error(m);
    } finally {
      setGenerating(false);
    }
  }

  const selectCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6 max-w-3xl">
      <PageHero title="Generate Sessions" subtitle="Add a session to several classes on one date" />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={selectCls}>
            <option value={0}>All locations</option>
            {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))} className={selectCls}>
            <option value={0}>Semester…</option>
            {semesters.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={selectCls} />
          </label>
          <button onClick={loadClasses} className="btn-grad rounded-lg text-xs font-semibold px-4 py-1.5">
            Load classes
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            {result.generated} session(s) generated{result.skipped ? `, ${result.skipped} skipped (already existed)` : ''}.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : classes.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {classes.length} classes on this date · {checked.size} selected
            </p>
            <div className="flex gap-2">
              <button onClick={() => setChecked(new Set(classes.map((c) => c.ClassID)))} className="text-xs font-semibold text-[#1e5c97] hover:underline">All</button>
              <button onClick={() => setChecked(new Set())} className="text-xs font-semibold text-slate-500 hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-96 overflow-y-auto">
            {classes.map((c) => (
              <label key={c.ClassID} className="flex items-center gap-2 text-sm text-slate-700 py-1 px-2 rounded hover:bg-slate-50 select-none">
                <input type="checkbox" checked={checked.has(c.ClassID)} onChange={() => toggle(c.ClassID)} className="accent-[#1e5c97]" />
                {c.ClassName}
              </label>
            ))}
          </div>

          {canSave && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                {['Active', 'Cancelled', 'Make-Up'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (optional)" className={`${selectCls} flex-1 min-w-40`} />
              <button
                onClick={generate}
                disabled={generating || checked.size === 0}
                className="btn-grad flex items-center gap-1.5 rounded-lg text-sm font-semibold px-5 py-2 disabled:opacity-60"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                Generate {checked.size}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 px-1">Pick a semester and date, then load the classes scheduled that day.</p>
      )}
    </div>
  );
}
