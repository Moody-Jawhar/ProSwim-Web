import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Plus, Pencil, Trash2, X, CalendarDays, MapPin } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, getStoredUser } from '../api/portalApi';

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

function fmtDate(v: string): string {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const emptyForm = { competitionName: '', location: '', startDate: '', endDate: '', notes: '' };

// Competitions master list (club-wide). Future ones surface as "Upcoming
// competitions" in every team swimmer's portfolio (portal + app).
export function CompetitionsPage() {
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // null closed, 0 new
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    apiRequest<Row[]>('/api/portal/comp/competitions').then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load competitions.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  function startEdit(r?: Row) {
    if (!r) {
      setForm(emptyForm);
      setEditingId(0);
      return;
    }
    setForm({
      competitionName: str(r, 'CompetitionName'),
      location: str(r, 'Location'),
      startDate: str(r, 'StartDate') ? str(r, 'StartDate').slice(0, 10) : '',
      endDate: str(r, 'EndDate') ? str(r, 'EndDate').slice(0, 10) : '',
      notes: str(r, 'Notes'),
    });
    setEditingId(num(r, 'CompetitionId'));
  }

  async function submit() {
    if (!form.competitionName.trim() || !form.startDate) {
      setError('Name and start date are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify({
        competitionName: form.competitionName.trim(),
        location: form.location.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
        notes: form.notes.trim() || null,
      });
      if (editingId === 0) await apiRequest('/api/portal/comp/competitions', { method: 'POST', body });
      else await apiRequest(`/api/portal/comp/competitions/${editingId}`, { method: 'PUT', body });
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this competition? Results linked to it keep their data.')) return;
    setBusy(true);
    try {
      await apiRequest(`/api/portal/comp/competitions/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-4xl">
      <PageHero
        title="Competitions"
        subtitle="Club-wide meets, upcoming ones show in every team swimmer's portfolio"
        right={canSave && editingId === null && (
          <button onClick={() => startEdit()}
            className="btn-grad flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl">
            <Plus className="size-4" /> New competition
          </button>
        )}
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {editingId !== null && (
        <div className="bg-white rounded-2xl border border-[#1e5c97]/20 shadow-soft p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
              <input className={inputCls} value={form.competitionName}
                onChange={(e) => setForm({ ...form, competitionName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <input className={inputCls} value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Start date *</label>
              <input className={inputCls} type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">End date</label>
              <input className={inputCls} type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
              <input className={inputCls} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submit} disabled={busy}
              className="rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a] disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin inline" /> : editingId === 0 ? 'Create' : 'Save'}
            </button>
            <button onClick={() => setEditingId(null)} disabled={busy}
              className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-2 hover:bg-slate-50">
              <X className="size-4 inline -mt-0.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {!rows ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-10 text-center">
          <CalendarDays className="size-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No competitions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const upcoming = str(r, 'EndDate') ? str(r, 'EndDate').slice(0, 10) >= today : str(r, 'StartDate').slice(0, 10) >= today;
            return (
              <div key={num(r, 'CompetitionId')} className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{str(r, 'CompetitionName')}</span>
                    {upcoming && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />
                      {fmtDate(str(r, 'StartDate'))}{str(r, 'EndDate') && ` – ${fmtDate(str(r, 'EndDate'))}`}
                    </span>
                    {str(r, 'Location') && (
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{str(r, 'Location')}</span>
                    )}
                    {str(r, 'Notes') && <span>· {str(r, 'Notes')}</span>}
                  </p>
                </div>
                {canSave && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(r)} title="Edit" className="text-slate-400 hover:text-[#1e5c97] p-1.5">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => remove(num(r, 'CompetitionId'))} title="Delete" className="text-slate-400 hover:text-red-600 p-1.5">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
