// Extra-class daily-attendance grid (ExtraClassDailyAttendance.aspx). Pick a
// day (+ location / type / criteria), mark each session's attendance, state and
// remarks, then save all rows at once.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search, AlertCircle } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

type Opt = { value: number; label: string };

interface Row {
  ExtraClassSessionId: number;
  StudentFullName?: string;
  ExtraClassType?: string;
  LocationNickName?: string;
  ExtraClassSessionDate?: string;
  ExtraClassSessionTime?: string;
  ExtraClassSessionAttended: boolean;
  ExtraClassSessionState: string;
  ExtraClassSessionRemarks: string;
}

const STATES = ['Regular', 'Makeup', 'Cancelled on same Day', 'Cancelled Prev. By Student', 'Cancelled By ProSwim'];
const TYPES = ['', 'AquaBaby', 'AquaGym', 'AquaMermaid', 'MemberShip', 'MemberShipPasses', 'Others'];
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

export function ExtraAttendancePage() {
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Opt[]>([]);
  const [date, setDate] = useState(todayStr());
  const [locationId, setLocationId] = useState(0);
  const [classType, setClassType] = useState('');
  const [criteria, setCriteria] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<{ locations: { value: number; label: string }[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError('');
    setSaved(false);
    const q = new URLSearchParams({ dateFrom: date, dateTo: date, criteria, onlyActive: String(onlyActive) });
    if (locationId) q.set('locationIds', String(locationId));
    if (classType) q.set('classType', classType);
    apiRequest<Record<string, unknown>[]>(`/api/portal/modules/extra-attendance?${q}`)
      .then((data) =>
        setRows(
          data.map((r) => ({
            ExtraClassSessionId: Number(r.ExtraClassSessionId),
            StudentFullName: String(r.StudentFullName ?? ''),
            ExtraClassType: String(r.ExtraClassType ?? ''),
            LocationNickName: String(r.LocationNickName ?? ''),
            ExtraClassSessionDate: String(r.ExtraClassSessionDate ?? ''),
            ExtraClassSessionTime: String(r.ExtraClassSessionTime ?? ''),
            ExtraClassSessionAttended: r.ExtraClassSessionAttended === true,
            ExtraClassSessionState: String(r.ExtraClassSessionState ?? 'Regular'),
            ExtraClassSessionRemarks: String(r.ExtraClassSessionRemarks ?? ''),
          }))
        )
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load sessions.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(id: number, key: keyof Row, value: unknown) {
    setRows((old) => old.map((r) => (r.ExtraClassSessionId === id ? { ...r, [key]: value } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/portal/edit/extra-attendance', {
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
  const attended = useMemo(() => rows.filter((r) => r.ExtraClassSessionAttended).length, [rows]);
  const fmtDate = (v?: string) => { const d = new Date(String(v)); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(); };

  return (
    <div className="p-6">
      <PageHero
        title="Extra Class Attendance"
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
        <select value={classType} onChange={(e) => setClassType(e.target.value)} className={inputCls}>
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
        </select>
        <select value={criteria} onChange={(e) => setCriteria(e.target.value)} className={inputCls}>
          {CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#1e5c97]" />
          Active only
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
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Time</th>
                <th className="px-3 py-3 font-semibold text-center">Att.</th>
                <th className="px-3 py-3 font-semibold">State</th>
                <th className="px-3 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ExtraClassSessionId} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700">{r.StudentFullName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ExtraClassType}</td>
                  <td className="px-3 py-2 text-slate-600">{r.LocationNickName}</td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(r.ExtraClassSessionDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ExtraClassSessionTime}</td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" disabled={!canSave} checked={r.ExtraClassSessionAttended}
                      onChange={(e) => set(r.ExtraClassSessionId, 'ExtraClassSessionAttended', e.target.checked)}
                      className="accent-[#1e5c97]" />
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={!canSave} value={r.ExtraClassSessionState}
                      onChange={(e) => set(r.ExtraClassSessionId, 'ExtraClassSessionState', e.target.value)}
                      className={inputCls}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" disabled={!canSave} value={r.ExtraClassSessionRemarks}
                      onChange={(e) => set(r.ExtraClassSessionId, 'ExtraClassSessionRemarks', e.target.value)}
                      className={`${inputCls} w-48`} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No sessions for this day.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
