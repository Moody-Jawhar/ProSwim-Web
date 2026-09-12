// Supervisor per-discipline hours entry for a timesheet (TimeSheetPayrollHrs.aspx).
// Each coach row shows the system-detected hours (grey) and an editable count
// per discipline; save writes all rows via P_TimeSheet_Payroll_UpdateHrs.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

const DISCIPLINES = [
  { label: 'Private', sys: 'PayrollPrivateHr', cnt: 'PayrollPrivateHrCnt' },
  { label: 'Team', sys: 'PayrollTeamHr', cnt: 'PayrollTeamHrCnt' },
  { label: 'School', sys: 'PayrollSchoolHr', cnt: 'PayrollSchoolHrCnt' },
  { label: 'AquaBaby', sys: 'PayrollAquaBabyHr', cnt: 'PayrollAquaBabyHrCnt' },
  { label: 'AquaGym', sys: 'PayrollAquaGymHr', cnt: 'PayrollAquaGymHrCnt' },
  { label: 'Physio', sys: 'PayrollPhysioHr', cnt: 'PayrollPhysioHrCnt' },
  { label: 'Misc', sys: 'PayrollMiscHr', cnt: 'PayrollMiscHrCnt' },
] as const;

type Row = Record<string, unknown> & { PayrollID: number };

export function PayrollHoursPage() {
  const { timesheetId } = useParams();
  const tsId = Number(timesheetId);
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<{ value: number; label: string }[]>([]);
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [timesheets, setTimesheets] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<{ locations: { value: number; label: string }[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
    // Timesheet switcher (newest first), like the legacy ddlTimeSheets.
    apiRequest<Row[]>('/api/portal/payroll/timesheets')
      .then((ts) => setTimesheets(ts.map((t) => ({
        id: Number(t.TimesheetID),
        label: String(t.TimesheetTitle ?? `${t.TimesheetYr}/${String(t.TimesheetMonth).padStart(2, '0')}`),
      }))))
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError('');
    const q = new URLSearchParams({ timesheetId: String(tsId) });
    if (locationId) q.set('locationId', String(locationId));
    apiRequest<Row[]>(`/api/portal/modules/payroll-hours?${q}`)
      .then((data) => setRows(data.map((r) => ({ ...r, PayrollID: Number(r.PayrollID) }))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load payroll rows.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [tsId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(id: number, key: string, value: string) {
    const n = value === '' ? 0 : Number(value);
    setRows((old) => old.map((r) => (r.PayrollID === id ? { ...r, [key]: n } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = rows.map((r) => {
        const o: Record<string, unknown> = { PayrollID: r.PayrollID };
        for (const d of DISCIPLINES) o[d.cnt] = Number(r[d.cnt] ?? 0);
        return o;
      });
      await apiRequest('/api/portal/edit/payroll-hours', { method: 'PUT', body: JSON.stringify({ rows: payload }) });
      setSaved(true);
      toast.success('Payroll hours saved.');
      load();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Save failed.';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  const title = rows[0] ? String(rows[0].TimesheetTitle ?? `Timesheet #${tsId}`) : `Timesheet #${tsId}`;
  const inputCls =
    'w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6">
      <PageHero
        title="Payroll Hours"
        subtitle={loading ? 'Loading…' : `${title} · ${rows.length} coaches`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/payroll/timesheets')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e5c97] hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5" /> Timesheets
            </button>
            {canSave && (
              <button
                onClick={save}
                disabled={saving || rows.length === 0}
                className="btn-grad flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                {saved && <span className="ml-1">✓</span>}
              </button>
            )}
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          Timesheet
          <select
            value={tsId}
            onChange={(e) => navigate(`/payroll/hours/${e.target.value}`)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
          >
            {timesheets.length === 0 && <option value={tsId}>{title}</option>}
            {timesheets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 flex items-center gap-1">
          Location
          <select
            value={locationId}
            onChange={(e) => setLocationId(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
          >
            <option value={0}>All locations</option>
            {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      <p className="text-xs text-slate-400 mb-3">Grey = system-detected hours · input = supervisor count used for pay.</p>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-3 py-3 font-semibold sticky left-0 bg-white">Coach</th>
                {DISCIPLINES.map((d) => <th key={d.label} className="px-3 py-3 font-semibold text-center">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.PayrollID} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700 sticky left-0 bg-white">{String(r.CoachFullName ?? '')}</td>
                  {DISCIPLINES.map((d) => (
                    <td key={d.label} className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-slate-400">{String(r[d.sys] ?? 0)}</span>
                        <input
                          type="number"
                          min={0}
                          disabled={!canSave}
                          value={String(r[d.cnt] ?? 0)}
                          onChange={(e) => set(r.PayrollID, d.cnt, e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={DISCIPLINES.length + 1} className="px-4 py-10 text-center text-slate-400">No payroll rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
