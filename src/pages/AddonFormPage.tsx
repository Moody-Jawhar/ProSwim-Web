// Payroll addon form — port of TimeSheetsAddonsIndividual.aspx. A bonus, long
// loan or penalty for a coach, split across up to 12 monthly payments with the
// legacy "Distribute" rounding behaviour.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save, Trash2, DivideCircle } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';

type Row = Record<string, unknown>;
type Option = { value: number | string; label: string };

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const YEARS = Array.from({ length: 10 }, (_, i) => String(2019 + i));

interface PaymentLine { amount: number; month: string; year: string }

export function AddonFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [locations, setLocations] = useState<Option[]>([]);
  const [coaches, setCoaches] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState(0);
  const [coachId, setCoachId] = useState(0);
  const [type, setType] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { amount: 0, month: String(d.getMonth() + 1).padStart(2, '0'), year: String(d.getFullYear()) };
    });
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ locations: Option[] }>('/api/portal/modules/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest<Option[]>(`/api/portal/payroll/addon-coaches?locationId=${locationId}`)
      .then(setCoaches)
      .catch(() => setCoaches([]));
  }, [locationId]);

  useEffect(() => {
    if (isNew) return;
    apiRequest<Row>(`/api/portal/edit/addon/${id}`)
      .then((r) => {
        setCoachId(Number(r.coachID ?? r.CoachID ?? 0));
        setLocationId(Number(r.CoachPrimaryLocationID ?? 0));
        setType(String(r.AddonType ?? ''));
        setCurrency(String(r.AddonCurrency ?? 'USD'));
        setTotal(Number(r.AddonAmount ?? 0));
        setCount(Number(r.TotalCount ?? 1) || 1);
        setRemarks(String(r.AddonRemarks ?? ''));
        if (r.AddonDate) setDate(new Date(String(r.AddonDate)).toISOString().slice(0, 10));
        setPayments(Array.from({ length: 12 }, (_, i) => ({
          amount: Number(r[`Payment${i + 1}`] ?? 0),
          month: String(r[`Payment${i + 1}Month`] ?? '01'),
          year: String(r[`Payment${i + 1}YR`] ?? r[`Payment${i + 1}Yr`] ?? String(new Date().getFullYear())),
        })));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the addon.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function distribute() {
    // Legacy rounding: each payment = round(total / n), last one corrected so
    // the sum matches the total exactly.
    const n = Math.min(Math.max(count, 1), 12);
    const per = Math.round(total / n);
    const first = payments[0];
    const base = new Date(Number(first.year), Number(first.month) - 1, 1);
    const next = payments.map((p, i) => {
      if (i >= n) return { ...p, amount: 0 };
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      let amount = per;
      if (i === n - 1) amount = total - per * (n - 1);
      return { amount, month: String(d.getMonth() + 1).padStart(2, '0'), year: String(d.getFullYear()) };
    });
    setPayments(next);
  }

  const paymentsSum = payments.reduce((s, p) => s + (p.amount || 0), 0);

  async function save() {
    if (!type) { setError('Choose a type.'); return; }
    if (!coachId) { setError('Choose a coach.'); return; }
    if (payments[0].amount === 0) { setError('Set at least the first payment (use Distribute).'); return; }
    if (paymentsSum !== total) { setError(`Payment lines add up to ${paymentsSum.toLocaleString()} but the total is ${total.toLocaleString()} — use Distribute or fix the lines.`); return; }
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = {
      CoachID: coachId,
      AddonType: type,
      AddonDate: date,
      AddonRemarks: remarks,
      AddonCount: String(count).padStart(2, '0'),
      AddonCurrency: currency,
    };
    payments.forEach((p, i) => {
      body[`Payment${i + 1}`] = p.amount;
      body[`Payment${i + 1}Month`] = p.month;
      body[`Payment${i + 1}YR`] = p.year;
    });
    try {
      if (isNew) await apiRequest('/api/portal/edit/addon', { method: 'POST', body: JSON.stringify(body) });
      else await apiRequest(`/api/portal/edit/addon/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      navigate('/payroll/addons');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this addon permanently?')) return;
    try {
      await apiRequest(`/api/portal/edit/addon/${id}`, { method: 'DELETE' });
      navigate('/payroll/addons');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <SmartBack label="Add-ons" fallback="/payroll/addons" />
      <PageHero title={isNew ? 'New Add-on' : 'Edit Add-on'} subtitle="Bonus, long loan or penalty for a coach" slide={3} />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} disabled={!isNew} className={`${inputCls} disabled:bg-slate-50`}>
              <option value={0}>All / choose…</option>
              {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Coach</label>
            <select value={coachId} onChange={(e) => setCoachId(Number(e.target.value))} disabled={!isNew} className={`${inputCls} disabled:bg-slate-50`}>
              <option value={0}>Choose…</option>
              {coaches.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="">Choose…</option>
              <option value="Bonus">Bonus</option>
              <option value="LongLoan">Long Loan</option>
              <option value="Penalty">Penalty</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Total Amount</label>
            <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} className={inputCls} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Payments</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button onClick={distribute}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#1e5c97]/30 text-[#1e5c97] text-sm font-semibold px-4 py-1.5 hover:bg-[#e8f0f8]">
          <DivideCircle className="size-4" /> Distribute over {count} payment(s)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Payment schedule — lines total {paymentsSum.toLocaleString()} {currency}
          {paymentsSum !== total && <span className="text-red-600 normal-case tracking-normal"> (≠ total {total.toLocaleString()})</span>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {payments.map((p, i) => (
            <div key={i} className={`flex items-center gap-2 ${i >= count ? 'opacity-40' : ''}`}>
              <span className="text-xs font-bold text-slate-400 w-6">#{i + 1}</span>
              <input type="number" value={p.amount}
                onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))}
                className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right" />
              <select value={p.month}
                onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))}
                className="rounded-lg border border-slate-200 px-1.5 py-1 text-sm">
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={p.year}
                onChange={(e) => setPayments((prev) => prev.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))}
                className="rounded-lg border border-slate-200 px-1.5 py-1 text-sm">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
        placeholder="Remarks…" className={`${inputCls} mb-4`} />

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Add-on
        </button>
        {!isNew && (
          <button onClick={remove}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold px-4 py-2.5 hover:bg-red-50">
            <Trash2 className="size-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
