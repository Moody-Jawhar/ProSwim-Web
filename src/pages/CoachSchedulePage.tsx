// Per-coach weekly availability editor (CoachsSchedule.aspx). Seven weekday
// rows of from/to time + remarks; Save writes all seven, "Fill default" resets
// them from the coach's default template.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Save, RotateCcw, ArrowLeft, AlertCircle } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

interface DayRow {
  day: number;
  dayName: string;
  timeFrom: string;
  timeTo: string;
  remarks: string;
}

export function CoachSchedulePage() {
  const { id } = useParams();
  const coachId = Number(id);
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [rows, setRows] = useState<DayRow[]>([]);
  const [coachName, setCoachName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    apiRequest<DayRow[]>(`/api/portal/modules/coach-schedule?coachId=${coachId}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the schedule.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    apiRequest<{ CoachFullName?: string }>(`/api/portal/edit/coach/${coachId}`)
      .then((c) => setCoachName(c.CoachFullName ?? ''))
      .catch(() => {});
  }, [coachId]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(day: number, key: keyof DayRow, value: string) {
    setRows((old) => old.map((r) => (r.day === day ? { ...r, [key]: value } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/portal/edit/coach-schedule/${coachId}`, {
        method: 'PUT',
        body: JSON.stringify({ days: rows }),
      });
      setSaved(true);
      toast.success('Schedule saved.');
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save the schedule.';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  async function fillDefault() {
    if (!confirm('Replace this schedule with the default template?')) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/portal/edit/coach-schedule/${coachId}/default`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply the default.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6">
      <PageHero
        title="Coach Schedule"
        subtitle={coachName || `Coach #${coachId}`}
        right={
          <button
            onClick={() => navigate('/coaches')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e5c97] hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5" /> Coaches
          </button>
        }
      />

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
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold">Day</th>
                  <th className="px-4 py-3 font-semibold">From</th>
                  <th className="px-4 py-3 font-semibold">To</th>
                  <th className="px-4 py-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{r.dayName}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="time"
                        value={r.timeFrom}
                        disabled={!canSave}
                        onChange={(e) => set(r.day, 'timeFrom', e.target.value)}
                        className={`${inputCls} w-32`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="time"
                        value={r.timeTo}
                        disabled={!canSave}
                        onChange={(e) => set(r.day, 'timeTo', e.target.value)}
                        className={`${inputCls} w-32`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={r.remarks}
                        disabled={!canSave}
                        onChange={(e) => set(r.day, 'remarks', e.target.value)}
                        placeholder="—"
                        className={`${inputCls} w-full`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canSave && (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={save}
                disabled={saving}
                className="btn-grad flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
              </button>
              <button
                onClick={fillDefault}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <RotateCcw className="size-4" /> Fill default
              </button>
              {saved && <span className="text-sm text-emerald-600 font-semibold">Saved.</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
