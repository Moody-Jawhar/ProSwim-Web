// Payment deliveries — port of PaymentDeliverysList / PrivatePaymentDeliverysList
// and their popup pages. One component serves both variants: list with filters,
// an expandable detail (linked payment/expense lines), and a create flow that
// checks off undelivered lines and recomputes totals live (far simpler in React
// than the WebForms postback dance it replaces).

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertCircle, Plus, X, Truck, ChevronDown, ChevronRight, Lock, Unlock,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;
type Option = { value: number; label: string };

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const money = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString());
const dmy = (v: unknown) => {
  if (!v) return '—';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

interface Variant {
  title: string;
  subtitle: string;
  base: string;             // API path segment
  idKey: string;
  serialKey: string;
  amountKey: string;
  closedKey: string;
  recDateKey: string;
  hasSemester: boolean;     // group deliveries filter/group by semester
  paymentsKey: string;      // header totals column for payments
  issuedToKey: string;
}

const GROUP: Variant = {
  title: 'Payment Delivery',
  subtitle: 'Group payments & expenses handed over to ProSwim',
  base: 'deliveries',
  idKey: 'PaymentDeliveryID',
  serialKey: 'PaymentDeliverySerialNumber',
  amountKey: 'PaymentDeliveryTotalDifference',
  closedKey: 'PaymentDeliveryClosed',
  recDateKey: 'PaymentDeliveryRecievedDate',
  hasSemester: true,
  paymentsKey: 'PaymentDeliveryTotalPayments',
  issuedToKey: 'PaymentIssuedTo',
};

const PRIVATE: Variant = {
  title: 'Private Payment Delivery',
  subtitle: 'Private payments handed over to ProSwim',
  base: 'private-deliveries',
  idKey: 'PrivatePaymentDeliveryID',
  serialKey: 'PrivatePaymentDeliverySerialNumber',
  amountKey: 'PrivatePaymentDeliveryAmount',
  closedKey: 'PrivatePaymentDeliveryClosed',
  recDateKey: 'PrivatePaymentDeliveryRecievedDate',
  hasSemester: false,
  paymentsKey: 'PrivatePaymentDeliveryTotalPayments',
  issuedToKey: 'PrivatePaymentIssuedTo',
};

function DeliveriesPage({ variant }: { variant: Variant }) {
  const user = getStoredUser();
  const userType = (user?.userType || '').toLowerCase();
  const canSave = user?.canSave !== false && userType !== 'guest' && userType !== 'payment/audit';
  const isSiteMaster = userType === 'sitemaster';

  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ header: Row; lines: Row[] } | null>(null);

  useEffect(() => {
    apiRequest<{ locations: Option[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError('');
    const q = new URLSearchParams();
    if (locationId) q.set('locationId', String(locationId));
    if (search.trim()) q.set('searchFor', search.trim());
    if (showDeleted) q.set('deleted', 'true');
    apiRequest<Row[]>(`/api/portal/finance/${variant.base}?${q}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load deliveries.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [locationId, showDeleted]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDetail(id: number) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    apiRequest<{ header: Row; lines: Row[] }>(`/api/portal/finance/${variant.base}/${id}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }

  async function setClosed(id: number, closed: boolean) {
    try {
      await apiRequest(`/api/portal/finance/${variant.base}/${id}`, {
        method: 'PUT', body: JSON.stringify({ closed }),
      });
      load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not update the delivery.');
    }
  }

  const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6 md:p-8">
      <PageHero title={variant.title} subtitle={variant.subtitle} slide={3} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search…" className={`${inputCls} w-44`} />
        <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={inputCls}>
          <option value={0}>All locations</option>
          {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="accent-[#1e5c97]" />
          Deleted
        </label>
        <button onClick={load} className="rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-4 py-1.5">
          Search
        </button>
        <div className="flex-1" />
        {canSave && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5">
            <Plus className="size-4" /> New Delivery
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="tbl w-full text-[15px] whitespace-nowrap [&_td]:py-3 [&_td]:px-4 [&_th]:py-3 [&_th]:px-4">
            <thead>
              <tr>
                <th className="!px-2" />
                <th className="text-left">Location</th>
                {variant.hasSemester && <th className="text-left">Semester</th>}
                <th className="text-left">S/N</th>
                {variant.hasSemester && <th className="text-right">Payments</th>}
                {variant.hasSemester && <th className="text-right">Expenses</th>}
                <th className="text-right">{variant.hasSemester ? 'Net' : 'Amount'}</th>
                <th className="text-left">Received</th>
                <th className="text-center">Closed</th>
                {isSiteMaster && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="text-center text-slate-400 py-6">No deliveries found.</td></tr>
              )}
              {rows.map((r) => {
                const id = num(r, variant.idKey);
                const closed = r[variant.closedKey] === true;
                return (
                  <>
                    <tr key={id} onClick={() => toggleDetail(id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="w-6 !px-2">{openId === id ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}</td>
                      <td>{str(r, 'LocationNickName') || '—'}</td>
                      {variant.hasSemester && <td>{str(r, 'SemesterName') || '—'}</td>}
                      <td className="font-semibold">{str(r, variant.serialKey)}</td>
                      {variant.hasSemester && <td className="text-right text-emerald-700 tabular-nums">{money(r['PaymentDeliveryTotalPayments'])}</td>}
                      {variant.hasSemester && <td className="text-right text-red-600 tabular-nums">{money(r['PaymentDeliveryTotalExpenses'])}</td>}
                      <td className="text-right font-bold tabular-nums">{money(r[variant.amountKey])}</td>
                      <td>{dmy(r[variant.recDateKey])}</td>
                      <td className="text-center">{closed ? <span className="text-emerald-700 font-bold">Yes</span> : ''}</td>
                      {isSiteMaster && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setClosed(id, !closed)}
                            title={closed ? 'Reopen' : 'Close'}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#1e5c97] hover:underline">
                            {closed ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                            {closed ? 'Reopen' : 'Close'}
                          </button>
                        </td>
                      )}
                    </tr>
                    {openId === id && (
                      <tr key={`${id}-detail`}>
                        <td colSpan={10} className="bg-slate-50 p-3">
                          {!detail ? (
                            <span className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" /> Loading lines…</span>
                          ) : (
                            <DeliveryLines lines={detail.lines} variant={variant} />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateDelivery
          variant={variant}
          locations={locations}
          initialLocation={locationId || (user?.primaryLocationId ?? 0)}
          onClose={(saved) => { setCreating(false); if (saved) load(); }}
        />
      )}
    </div>
  );
}

function DeliveryLines({ lines, variant }: { lines: Row[]; variant: Variant }) {
  if (lines.length === 0) return <p className="text-sm text-slate-400">No lines recorded.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-slate-400">
          <th className="text-left py-1">Mode</th><th className="text-left">Type</th><th className="text-left">Date</th>
          <th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-left">Curr</th>
          <th className="text-left">Issued To</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className={String(l.Mode).toLowerCase() === 'expense' ? 'text-red-700' : ''}>
            <td className="py-0.5">{str(l, 'Mode')}</td>
            <td>{str(l, 'Type')}</td>
            <td>{dmy(l.PEDate)}</td>
            <td className="text-right">{money(l.Amount)}</td>
            <td className="text-right">{money(l.PaidAmount)}</td>
            <td>{str(l, 'Currency')}</td>
            <td>{str(l, variant.issuedToKey) || str(l, 'PaymentIssuedTo')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CreateDelivery({ variant, locations, initialLocation, onClose }: {
  variant: Variant;
  locations: Option[];
  initialLocation: number;
  onClose: (saved: boolean) => void;
}) {
  const [locationId, setLocationId] = useState(initialLocation);
  const [candidates, setCandidates] = useState<Row[] | null>(null);
  const [serial, setSerial] = useState('');
  const [semesterId, setSemesterId] = useState(0);
  const [semesterName, setSemesterName] = useState('');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [remarks, setRemarks] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!locationId) { setCandidates(null); return; }
    setCandidates(null);
    setError('');
    apiRequest<{ lines: Row[]; serial: string; semesterId?: number; semesterName?: string }>(
      `/api/portal/finance/${variant.base}/candidates?locationId=${locationId}`,
    )
      .then((r) => {
        setCandidates(r.lines);
        setSerial(r.serial);
        setSemesterId(r.semesterId ?? 0);
        setSemesterName(r.semesterName ?? '');
        setChecked(new Set(r.lines.map((l) => num(l, 'IndividualID'))));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load undelivered lines.'));
  }, [locationId, variant.base]);

  const totals = useMemo(() => {
    let payments = 0, expenses = 0;
    for (const l of candidates ?? []) {
      if (!checked.has(num(l, 'IndividualID'))) continue;
      if (String(l.Mode).toLowerCase() === 'expense') expenses += num(l, 'Amount');
      else payments += num(l, 'Amount');
    }
    return { payments, expenses, net: payments - expenses };
  }, [candidates, checked]);

  async function save() {
    if (checked.size === 0) { setError('Select at least one line.'); return; }
    if (variant.hasSemester && !semesterId) { setError('No current semester found for this location.'); return; }
    setSaving(true);
    setError('');
    const lines = (candidates ?? [])
      .filter((l) => checked.has(num(l, 'IndividualID')))
      .map((l) => ({ individualId: num(l, 'IndividualID'), mode: str(l, 'Mode') }));
    const body: Record<string, unknown> = {
      locationId,
      serialNumber: serial,
      generationDate: new Date().toISOString(),
      receivedDate: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
      remarks,
      lines,
    };
    if (variant.hasSemester) {
      Object.assign(body, {
        semesterId,
        amount: totals.net,
        totalPayments: totals.payments,
        totalExpenses: totals.expenses,
        totalDifference: totals.net,
      });
    } else {
      Object.assign(body, { amount: totals.payments, totalPayments: totals.payments, closed: false });
    }
    try {
      await apiRequest(`/api/portal/finance/${variant.base}`, { method: 'POST', body: JSON.stringify(body) });
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the delivery.');
      setSaving(false);
    }
  }

  const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center overflow-y-auto p-4 md:p-10">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Truck className="size-5 text-[#1e5c97]" /> New {variant.title}
          </p>
          <button onClick={() => onClose(false)}><X className="size-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={`${inputCls} w-full`}>
              <option value={0}>Choose…</option>
              {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Serial</label>
            <input value={serial} readOnly className={`${inputCls} w-full bg-slate-50`} />
          </div>
          {variant.hasSemester && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
              <input value={semesterName || '—'} readOnly className={`${inputCls} w-full bg-slate-50`} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Received Date</label>
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${inputCls} w-full`} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
            <AlertCircle className="size-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!locationId ? (
          <p className="text-sm text-slate-400 py-4">Pick a location to load its undelivered lines.</p>
        ) : !candidates ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" /> Loading undelivered lines…</div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Nothing waiting to be delivered at this location.</p>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-y-auto max-h-72 mb-3">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400">
                  <th className="p-1.5">
                    <input type="checkbox"
                      checked={checked.size === candidates.length}
                      onChange={(e) => setChecked(e.target.checked
                        ? new Set(candidates.map((l) => num(l, 'IndividualID')))
                        : new Set())}
                      className="accent-[#1e5c97]" />
                  </th>
                  <th className="text-left">Mode</th><th className="text-left">Type</th><th className="text-left">Date</th>
                  <th className="text-right">Amount</th><th className="text-left">Curr</th><th className="text-left">Issued To</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((l) => {
                  const id = num(l, 'IndividualID');
                  const isExpense = String(l.Mode).toLowerCase() === 'expense';
                  return (
                    <tr key={id} className={isExpense ? 'text-red-700' : ''}>
                      <td className="p-1.5 text-center">
                        <input type="checkbox" checked={checked.has(id)}
                          onChange={(e) => setChecked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(id); else next.delete(id);
                            return next;
                          })}
                          className="accent-[#1e5c97]" />
                      </td>
                      <td>{str(l, 'Mode')}</td>
                      <td>{str(l, 'Type')}</td>
                      <td>{dmy(l.PEDate)}</td>
                      <td className="text-right">{money(l.Amount)}</td>
                      <td>{str(l, 'Currency')}</td>
                      <td>{str(l, variant.issuedToKey) || str(l, 'PaymentIssuedTo')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
          <span className="text-emerald-700 font-bold">Payments: {totals.payments.toLocaleString()}</span>
          {variant.hasSemester && <span className="text-red-600 font-bold">Expenses: {totals.expenses.toLocaleString()}</span>}
          <span className="font-extrabold text-slate-900">
            {variant.hasSemester ? 'Net to deliver' : 'Total'}: {(variant.hasSemester ? totals.net : totals.payments).toLocaleString()}
          </span>
        </div>

        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
          placeholder="Remarks…" className={`${inputCls} w-full mb-4`} />

        <div className="flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="rounded-lg border border-slate-200 text-sm font-semibold px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving || checked.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
            Create Delivery
          </button>
        </div>
      </div>
    </div>
  );
}

export const PaymentDeliveriesPage = () => <DeliveriesPage variant={GROUP} />;
export const PrivateDeliveriesPage = () => <DeliveriesPage variant={PRIVATE} />;
