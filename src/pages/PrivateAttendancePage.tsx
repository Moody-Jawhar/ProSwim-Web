// Private daily-attendance grid (PrivatePackagesDailyAttendance.aspx). Pick a
// day (+ location / criteria), mark each private session's attendance, overtime,
// state, remarks and make-up (date/time/coach), then save all rows at once.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search, AlertCircle } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

type Opt = { value: number; label: string };

interface Row {
  PrivateSessionId: number;
  StudentFullName?: string;
  CoachFullName?: string;
  PrivateSessionTime?: string;
  PackageNamewInfo?: string;
  PrivateSessionAttended: boolean;
  PrivateSessionOverTime: boolean;
  PrivateSessionState: string;
  PrivateSessionRemarks: string;
  PrivateSessionMkupDate: string;
  PrivateSessionMkupTime: string;
  PrivateSessionMkupCoachID: number;
  PrivateSessionLocationID: number;
}

const STATES = [
  'Regular', 'Makeup', 'Cancelled on same Day', 'Cancelled Prev. By Student',
  'Cancelled By ProSwim', 'Cancelled Package', 'Freeze Package', 'Transfer Package',
  'Reduced Package', 'Merged w/o Pack',
];

const CRITERIA = [
  { value: '', label: 'All sessions' },
  { value: 'AttendedonThisTime', label: 'Attended on time' },
  { value: 'GivenOnTime', label: 'Given on time' },
  { value: 'MissedandMakeuped', label: 'Changed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'UnIdentified', label: 'Unidentified' },
  { value: 'Makeups', label: 'Make-ups' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toDateInput(v: unknown): string {
  if (!v || typeof v !== 'string') return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PrivateAttendancePage() {
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [rows, setRows] = useState<Row[]>([]);
  const [coaches, setCoaches] = useState<Opt[]>([]);
  const [locations, setLocations] = useState<Opt[]>([]);
  const [date, setDate] = useState(todayStr());
  const [locationId, setLocationId] = useState(0);
  const [criteria, setCriteria] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<{ coaches: Opt[]; locations: { value: number; label: string }[] }>('/api/portal/modules/lookups')
      .then((lk) => { setCoaches(lk.coaches ?? []); setLocations(lk.locations ?? []); })
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError('');
    setSaved(false);
    const q = new URLSearchParams({ dateFrom: date, dateTo: date, criteria, onlyActive: String(onlyActive) });
    if (locationId) q.set('locationIds', String(locationId));
    apiRequest<Record<string, unknown>[]>(`/api/portal/modules/private-attendance?${q}`)
      .then((data) =>
        setRows(
          data.map((r) => ({
            PrivateSessionId: Number(r.PrivateSessionId),
            StudentFullName: String(r.StudentFullName ?? ''),
            CoachFullName: String(r.CoachFullName ?? ''),
            PrivateSessionTime: String(r.PrivateSessionTime ?? ''),
            PackageNamewInfo: String(r.PackageNamewInfo ?? ''),
            PrivateSessionAttended: r.PrivateSessionAttended === true,
            PrivateSessionOverTime: r.PrivateSessionOverTime === true,
            PrivateSessionState: String(r.PrivateSessionState ?? 'Regular'),
            PrivateSessionRemarks: String(r.PrivateSessionRemarks ?? ''),
            PrivateSessionMkupDate: toDateInput(r.PrivateSessionMkupDate),
            PrivateSessionMkupTime: String(r.PrivateSessionMkupTime ?? ''),
            PrivateSessionMkupCoachID: Number(r.PrivateSessionMkupCoachID ?? 0),
            PrivateSessionLocationID: Number(r.PrivateSessionLocationID ?? 0),
          }))
        )
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load sessions.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(id: number, key: keyof Row, value: unknown) {
    setRows((old) => old.map((r) => (r.PrivateSessionId === id ? { ...r, [key]: value } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/portal/edit/private-attendance', {
        method: 'PUT',
        body: JSON.stringify({ sessions: rows }),
      });
      setSaved(true);
      toast.success('Attendance saved.');
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Save failed.';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';
  const attended = useMemo(() => rows.filter((r) => r.PrivateSessionAttended).length, [rows]);

  return (
    <div className="p-6">
      <PageHero
        title="Private Daily Attendance"
        subtitle={loading ? 'Loading…' : `${rows.length} sessions · ${attended} attended`}
        right={
          canSave ? (
            <button
              onClick={save}
              disabled={saving || rows.length === 0}
              className="btn-grad flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
              {saved && <span className="ml-1">✓</span>}
            </button>
          ) : undefined
        }
      />

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={inputCls}>
          <option value={0}>All locations</option>
          {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select value={criteria} onChange={(e) => setCriteria(e.target.value)} className={inputCls}>
          {CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#1e5c97]" />
          Active packages only
        </label>
        <button type="submit" className="btn-grad ml-auto rounded-lg text-xs font-semibold px-4 py-1.5">
          <Search className="size-3.5 inline -mt-0.5 mr-1" /> Load
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-3 py-3 font-semibold">Student</th>
                <th className="px-3 py-3 font-semibold">Coach</th>
                <th className="px-3 py-3 font-semibold">Time</th>
                <th className="px-3 py-3 font-semibold">Package</th>
                <th className="px-3 py-3 font-semibold text-center">Att.</th>
                <th className="px-3 py-3 font-semibold text-center">O.T.</th>
                <th className="px-3 py-3 font-semibold">State</th>
                <th className="px-3 py-3 font-semibold">Remarks</th>
                <th className="px-3 py-3 font-semibold">Make-up date</th>
                <th className="px-3 py-3 font-semibold">M. time</th>
                <th className="px-3 py-3 font-semibold">M. coach</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.PrivateSessionId} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700">{r.StudentFullName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.CoachFullName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.PrivateSessionTime}</td>
                  <td className="px-3 py-2 text-slate-500">{r.PackageNamewInfo}</td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" disabled={!canSave} checked={r.PrivateSessionAttended}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionAttended', e.target.checked)}
                      className="accent-[#1e5c97]" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" disabled={!canSave} checked={r.PrivateSessionOverTime}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionOverTime', e.target.checked)}
                      className="accent-[#1e5c97]" />
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={!canSave} value={r.PrivateSessionState}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionState', e.target.value)}
                      className={inputCls}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" disabled={!canSave} value={r.PrivateSessionRemarks}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionRemarks', e.target.value)}
                      className={`${inputCls} w-40`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" disabled={!canSave} value={r.PrivateSessionMkupDate}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionMkupDate', e.target.value)}
                      className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" disabled={!canSave} value={r.PrivateSessionMkupTime}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionMkupTime', e.target.value)}
                      className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={!canSave} value={r.PrivateSessionMkupCoachID}
                      onChange={(e) => set(r.PrivateSessionId, 'PrivateSessionMkupCoachID', Number(e.target.value))}
                      className={inputCls}>
                      <option value={0}>-</option>
                      {coaches.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No sessions for this day.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
