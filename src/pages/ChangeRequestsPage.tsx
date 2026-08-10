import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Check, X, Phone, Mail, Inbox, MoveRight } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, getStoredUser } from '../api/portalApi';

// Rows come straight from P_ContactChangeRequest_Select, keyed by column name.
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

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Rejected: 'bg-red-50 text-red-600 border border-red-200',
  Cancelled: 'bg-slate-50 text-slate-500 border border-slate-200',
};

// Parent-submitted phone/email changes: parents can edit everything else in
// the app directly, but the main phone and email only change through here —
// a staff decision, applied server-side and audit-logged (security rule).
export function ChangeRequestsPage() {
  const user = getStoredUser();
  const canDecide = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<'Pending' | 'All'>('Pending');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setError('');
    apiRequest<Row[]>('/api/portal/change-requests')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load change requests.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: number, approve: boolean) {
    let note: string | null = null;
    if (approve) {
      if (!window.confirm('Approve this change? The new value is applied to the student record immediately.')) return;
    } else {
      note = window.prompt('Reason for declining (the parent sees this):', '');
      if (note === null) return; // prompt cancelled
    }
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/portal/change-requests/${id}/${approve ? 'approve' : 'reject'}`,
        { method: 'POST', body: JSON.stringify({ note }) },
      );
      setNotice(res.message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  const visible = rows?.filter((r) => filter === 'All' || str(r, 'Status') === 'Pending') ?? null;
  const pendingCount = rows?.filter((r) => str(r, 'Status') === 'Pending').length ?? 0;

  return (
    <div className="p-8 max-w-4xl">
      <PageHero
        title="Change Requests"
        subtitle="Phone & email changes parents requested from the app — approving applies the change and logs it"
        right={
          <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden text-sm font-semibold">
            {(['Pending', 'All'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 ${filter === f ? 'bg-[#1e5c97] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {f === 'Pending' ? `Pending (${pendingCount})` : 'All'}
              </button>
            ))}
          </div>
        }
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

      {!visible ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-10 text-center">
          <Inbox className="size-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {filter === 'Pending' ? 'No pending requests — all caught up.' : 'No change requests yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const id = num(r, 'RequestId');
            const status = str(r, 'Status');
            const isPhone = str(r, 'FieldType') === 'Phone';
            const newValue = isPhone
              ? [str(r, 'NewPhoneCode'), str(r, 'NewValue')].filter(Boolean).join(' ')
              : str(r, 'NewValue');
            const pending = status === 'Pending';
            return (
              <div key={id} className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2 py-0.5 ${
                    isPhone ? 'bg-[#e8f0f8] text-[#1e5c97]' : 'bg-violet-50 text-violet-700'
                  }`}>
                    {isPhone ? <Phone className="size-3" /> : <Mail className="size-3" />}
                    {isPhone ? 'Phone' : 'Email'}
                  </span>
                  <Link
                    to={`/students/${num(r, 'StudentId')}`}
                    className="font-semibold text-slate-800 hover:text-[#1e5c97] text-sm"
                  >
                    {str(r, 'StudentFirstName')} {str(r, 'StudentLastName')}
                  </Link>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STATUS_STYLES[status] ?? STATUS_STYLES.Cancelled}`}>
                    {status}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{fmtDate(str(r, 'RequestedDate'))}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
                  <span className="text-slate-500 line-through decoration-slate-300">{str(r, 'OldValue') || '—'}</span>
                  <MoveRight className="size-4 text-slate-300 shrink-0" />
                  <span className="font-semibold text-slate-900">{newValue}</span>
                </div>

                {pending ? (
                  canDecide && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => decide(id, true)}
                        disabled={busyId !== null}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-1.5 hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busyId === id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => decide(id, false)}
                        disabled={busyId !== null}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold px-4 py-1.5 hover:bg-red-50 disabled:opacity-60"
                      >
                        <X className="size-4" /> Decline
                      </button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-400 mt-2">
                    {str(r, 'ReviewedByName') && <>By {str(r, 'ReviewedByName')} · </>}
                    {fmtDate(str(r, 'ReviewedDate'))}
                    {str(r, 'ReviewNote') && <> · “{str(r, 'ReviewNote')}”</>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
