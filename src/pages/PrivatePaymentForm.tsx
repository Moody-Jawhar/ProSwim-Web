import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';

type Row = Record<string, unknown>;
type Option = { value: number; label: string };
type Picker = { id: number; label: string };

const TITLES = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.'];

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
const dateOnly = (v: unknown) => {
  const str = s(v);
  return str.length >= 10 ? str.slice(0, 10) : '';
};

/** Private payment: one receipt against one private package. Replaces the
 * legacy PrivatePaymentsIndividual.aspx popup. */
export function PrivatePaymentForm() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const isNew = !id || id === 'new';

  const [locations, setLocations] = useState<Option[]>([]);
  const [packages, setPackages] = useState<Picker[]>([]);

  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [packageId, setPackageId] = useState(n(params.get('packageId')));
  const [title, setTitle] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalTouched, setTotalTouched] = useState(false);
  const [cash, setCash] = useState(true);
  const [chq, setChq] = useState(false);
  const [cc, setCC] = useState(false);
  const [others, setOthers] = useState(false);
  const [number, setNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ locations: { locationId: number; locationNickName: string | null }[] }>('/api/portal/students/lookups')
      .then((lk) => setLocations(lk.locations.map((l) => ({ value: l.locationId, label: l.locationNickName ?? `#${l.locationId}` }))))
      .catch(() => {});
  }, []);

  // Location → open packages + current currency rate
  useEffect(() => {
    apiRequest<Picker[]>(`/api/portal/edit/package-search?locationId=${locationId}`)
      .then(setPackages)
      .catch(() => setPackages([]));
    if (isNew) {
      apiRequest<{ rate: number }>(`/api/portal/edit/currency-rate?locationId=${locationId}`)
        .then((r) => setRate((cur) => cur || r.rate))
        .catch(() => {});
    }
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Existing payment
  useEffect(() => {
    if (isNew) return;
    apiRequest<Row>(`/api/portal/edit/private-payment/${id}`)
      .then((r) => {
        setLocationId(n(r.PrivatePaymentLocationId));
        setPackageId(n(r.PrivatePackageId));
        setTitle(s(r.PrivatePaymentIssuedToTitle));
        setIssuedTo(s(r.PrivatePaymentIssuedTo));
        setDate(dateOnly(r.PrivatePaymentDate) || new Date().toISOString().slice(0, 10));
        setCurrency(s(r.PrivatePaymentPaidCurrency) || 'USD');
        setRate(n(r.PrivatePaymentPaidCurrencyRate));
        setPaidAmount(n(r.PrivatePaymentPaidAmount));
        setTotalAmount(n(r.PrivatePaymentTotalAmount));
        setTotalTouched(true);
        setCash(r.PrivatePaymentCash === true);
        setChq(r.PrivatePaymentChq === true);
        setCC(r.PrivatePaymentCC === true);
        setOthers(r.PrivatePaymentOthers === true);
        setNumber(s(r.PrivatePaymentNumber));
        setRemarks(s(r.PrivatePaymentRemarks));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load payment.'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy rule: USD counts at face value, other currencies divide by rate.
  useEffect(() => {
    if (totalTouched) return;
    setTotalAmount(currency === 'USD' ? paidAmount : rate > 0 ? Math.round(paidAmount / rate) : 0);
  }, [paidAmount, currency, rate, totalTouched]);

  async function save() {
    if (!packageId) { setError('Choose a package first.'); return; }
    if (!rate) { setError('Set the currency rate.'); return; }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      PrivatePackageId: packageId,
      PrivatePaymentIssuedToTitle: title,
      PrivatePaymentIssuedTo: issuedTo.trim(),
      PrivatePaymentDate: date,
      PrivatePaymentPaidAmount: paidAmount,
      PrivatePaymentPaidCurrency: currency,
      PrivatePaymentPaidCurrencyRate: rate,
      PrivatePaymentTotalAmount: totalAmount,
      PrivatePaymentCash: cash,
      PrivatePaymentChq: chq,
      PrivatePaymentCC: cc,
      PrivatePaymentOthers: others,
      PrivatePaymentNumber: number,
      PrivatePaymentDeleted: false,
      PrivatePaymentRemarks: remarks,
      PrivatePaymentLocationId: locationId,
    };

    try {
      if (isNew) {
        await apiRequest('/api/portal/edit/private-payment', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/portal/edit/private-payment/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      navigate('/pr-payments');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
      </div>
    );
  }

  const knownPackage = packages.some((p) => p.id === packageId);

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <PageHero
        compact
        title={isNew ? 'New Private Payment' : issuedTo || 'Private Payment'}
        subtitle={isNew ? 'Record a payment against a private package' : 'Edit payment'}
        slide={1}
      />

      <SmartBack label="Back" fallback="/pr-payments" />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {!canSave && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-700">Your account has view-only access — saving is disabled.</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Package */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Package</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={inputCls}>
                <option value={0}>—</option>
                {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Package</label>
              <select value={packageId} onChange={(e) => setPackageId(Number(e.target.value))} className={inputCls}>
                <option value={0}>—</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                {packageId > 0 && !knownPackage && <option value={packageId}>Package #{packageId}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
              <select value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls}>
                {TITLES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Issued to</label>
              <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Payer name" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Amounts</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Paid amount</label>
              <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Rate</label>
              <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total (USD)</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => { setTotalTouched(true); setTotalAmount(Number(e.target.value)); }}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 mt-4">
            {([['Cash', cash, setCash], ['Cheque', chq, setChq], ['Card', cc, setCC], ['Other', others, setOthers]] as const).map(
              ([label, val, set]) => (
                <label key={label} className="flex items-center gap-2 text-sm text-slate-700 select-none">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="accent-[#1e5c97]" /> {label}
                </label>
              )
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Ref #</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} className={`${inputCls} w-36`} />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Remarks</p>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={inputCls} />
        </div>
      </div>

      {canSave && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="btn-grad flex items-center gap-2 rounded-xl text-sm font-semibold px-6 py-2.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isNew ? 'Record payment' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
