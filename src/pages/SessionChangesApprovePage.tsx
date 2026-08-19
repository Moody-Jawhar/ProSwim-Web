import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Check, X, Inbox, CalendarX, Snowflake } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, getStoredUser } from '../api/portalApi';

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

function fmtDate(v: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Parent-submitted private-session cancellation requests. Approving cancels
// the session; an optional alternate slot is either auto-applied (agreed on
// WhatsApp) or offered to the parent in the app.
export function SessionChangesApprovePage() {
  const user = getStoredUser();
  const canDecide = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [approveFor, setApproveFor] = useState<number | null>(null);
  const [altDate, setAltDate] = useState('');
  const [altTime, setAltTime] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [approveNote, setApproveNote] = useState('');

  const [freezeRows, setFreezeRows] = useState<Row[] | null>(null);

  const load = useCallback(() => {
    setError('');
    apiRequest<Row[]>('/api/portal/change-requests/cancellations')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load requests.'));
    apiRequest<Row[]>('/api/portal/change-requests/freezes')
      .then(setFreezeRows)
      .catch(() => setFreezeRows([]));
  }, []);

  async function decideFreeze(id: number, approve: boolean) {
    let note: string | null = null;
    if (approve) {
      if (!window.confirm("Approve this freeze? Sessions inside the range are marked 'Freeze Package'.")) return;
    } else {
      note = window.prompt('Reason for declining (the parent sees this). The package continues — the spot and coach time stay reserved:', '');
      if (note === null) return;
    }
    setBusyId(1000000 + id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/portal/change-requests/freezes/${id}/${approve ? 'approve' : 'reject'}`,
        { method: 'POST', body: JSON.stringify({ note }) });
      setNotice(approve ? 'Freeze approved — sessions in the range are marked Freeze Package.' : 'Freeze declined — the package continues.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setBusyId(null);
    }
  }
  useEffect(() => { load(); }, [load]);

  async function confirmApprove(id: number) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/portal/change-requests/cancellations/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          note: approveNote.trim() || null,
          altDate: altDate || null,
          altTime: altTime || null,
          autoAccept: autoAccept && !!altDate,
        }),
      });
      setNotice(!altDate
        ? 'Session cancelled and request approved.'
        : autoAccept
          ? 'Session cancelled and rescheduled to the agreed alternate slot.'
          : 'Session cancelled — the alternate slot was offered to the parent in the app.');
      setApproveFor(null); setAltDate(''); setAltTime(''); setAutoAccept(false); setApproveNote('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(id: number) {
    const note = window.prompt('Reason for declining (the parent sees this):', '');
    if (note === null) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/portal/change-requests/cancellations/${id}/reject`,
        { method: 'POST', body: JSON.stringify({ note }) });
      setNotice('Request declined.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHero
        title="Approve Session Changes"
        subtitle="Cancellations parents requested from the app — approve, offer an alternate slot, or decline"
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      {/* ── Package freeze requests ── */}
      {freezeRows && freezeRows.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
            <Snowflake className="size-4" /> Freeze Requests — Private Packages
          </p>
          <div className="space-y-3">
            {freezeRows.map((r) => {
              const id = num(r, 'RequestId');
              return (
                <div key={`f${id}`} className="bg-white rounded-2xl border border-sky-100 shadow-soft p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky-50 text-sky-700">
                      <Snowflake className="size-3" /> Freeze package
                    </span>
                    <Link to={`/students/${num(r, 'StudentId')}`} className="font-semibold text-slate-800 hover:text-[#1e5c97] text-sm">
                      {str(r, 'StudentFullName')}
                    </Link>
                    <span className="text-xs text-slate-500">{str(r, 'PackageName')}{str(r, 'CoachFullName') ? ` · ${str(r, 'CoachFullName')}` : ''}</span>
                    <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200">
                      {num(r, 'SessionsInRange')} session{num(r, 'SessionsInRange') === 1 ? '' : 's'} in range
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">{fmtDate(str(r, 'CreatedDate'))}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {fmtDate(str(r, 'FreezeFrom')).split(',')[0]} → {fmtDate(str(r, 'FreezeTo')).split(',')[0]}
                  </p>
                  {str(r, 'Reason') && <p className="text-xs text-slate-500 mt-1.5">“{str(r, 'Reason')}”</p>}
                  {canDecide && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => decideFreeze(id, true)} disabled={busyId !== null}
                        className="flex items-center gap-1.5 rounded-xl bg-sky-600 text-white text-sm font-semibold px-4 py-1.5 hover:bg-sky-700 disabled:opacity-60">
                        {busyId === 1000000 + id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Approve freeze
                      </button>
                      <button onClick={() => decideFreeze(id, false)} disabled={busyId !== null}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-1.5 hover:bg-slate-50 disabled:opacity-60">
                        <X className="size-4" /> Decline (package continues)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!rows ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-10 text-center">
          <Inbox className="size-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No pending cancellation requests — all caught up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const id = num(r, 'RequestId');
            return (
              <div key={id} className="bg-white rounded-2xl border border-red-100 shadow-soft p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2 py-0.5 bg-red-50 text-red-600">
                    <CalendarX className="size-3" /> Cancel session
                  </span>
                  <Link to={`/students/${num(r, 'StudentId')}`} className="font-semibold text-slate-800 hover:text-[#1e5c97] text-sm">
                    {str(r, 'StudentFullName')}
                  </Link>
                  <span className="text-xs text-slate-500">{str(r, 'PackageName')}{str(r, 'CoachFullName') ? ` · ${str(r, 'CoachFullName')}` : ''}</span>
                  <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                    {num(r, 'UsedCount')}/2 used
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{fmtDate(str(r, 'CreatedDate'))}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {fmtDate(str(r, 'PrivateSessionDate')).split(',')[0]} · {str(r, 'PrivateSessionTime')}
                </p>
                {str(r, 'Reason') && <p className="text-xs text-slate-500 mt-1.5">“{str(r, 'Reason')}”</p>}

                {canDecide && approveFor !== id && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setApproveFor(id); setAltDate(''); setAltTime(''); setAutoAccept(false); setApproveNote(''); }}
                      disabled={busyId !== null}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white text-sm font-semibold px-4 py-1.5 hover:bg-red-700 disabled:opacity-60">
                      <Check className="size-4" /> Approve…
                    </button>
                    <button onClick={() => decline(id)} disabled={busyId !== null}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-1.5 hover:bg-slate-50 disabled:opacity-60">
                      <X className="size-4" /> Decline
                    </button>
                  </div>
                )}

                {canDecide && approveFor === id && (
                  <div className="mt-3 border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600">
                      Approving cancels the session. Optionally recommend an alternate slot:
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">Alternate date</p>
                        <input type="date" value={altDate} onChange={(e) => setAltDate(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">Time</p>
                        <input type="time" value={altTime} onChange={(e) => setAltTime(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                      </div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold pb-2 ${altDate ? 'text-slate-700' : 'text-slate-300'}`}>
                        <input type="checkbox" checked={autoAccept} disabled={!altDate}
                          onChange={(e) => setAutoAccept(e.target.checked)} />
                        Auto-accept (already agreed, e.g. on WhatsApp) — reschedules immediately
                      </label>
                    </div>
                    {!autoAccept && altDate && (
                      <p className="text-[11px] text-slate-500">
                        The parent will see this slot in the app and can accept or decline it.
                      </p>
                    )}
                    <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)}
                      placeholder="Note to the parent (optional)"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white" />
                    <div className="flex gap-2">
                      <button onClick={() => confirmApprove(id)} disabled={busyId !== null}
                        className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white text-sm font-semibold px-4 py-1.5 hover:bg-red-700 disabled:opacity-60">
                        {busyId === id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        {altDate ? (autoAccept ? 'Approve & reschedule' : 'Approve & offer slot') : 'Approve & cancel'}
                      </button>
                      <button onClick={() => setApproveFor(null)} disabled={busyId !== null}
                        className="rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-1.5 hover:bg-slate-50 disabled:opacity-60">
                        Back
                      </button>
                    </div>
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
