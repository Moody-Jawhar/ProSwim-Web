import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save, Search, X } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';

type Row = Record<string, unknown>;
type Option = { value: number; label: string };
type Picker = { id: number; label: string };

const LINE_SLOTS = [0, 1, 2, 3, 4] as const;
const TITLES = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.'];

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
const dateOnly = (v: unknown) => {
  const str = s(v);
  return str.length >= 10 ? str.slice(0, 10) : '';
};

/** Group payment: one receipt, split across up to five students. Replaces the
 * legacy PaymentsIndividual.aspx popup. */
export function PaymentForm() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const isNew = !id || id === 'new';

  const [locations, setLocations] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]);

  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [semesterId, setSemesterId] = useState(n(params.get('semesterId')));
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

  const [lineIds, setLineIds] = useState<number[]>([n(params.get('studentId')), 0, 0, 0, 0]);
  const [lineLabels, setLineLabels] = useState<string[]>([params.get('studentName') ?? (params.get('studentId') ? `Student #${params.get('studentId')}` : ''), '', '', '', '']);
  const [lineAmounts, setLineAmounts] = useState<number[]>([0, 0, 0, 0, 0]);

  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Picker[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const keepSemester = useRef(!isNew || !!params.get('semesterId'));

  useEffect(() => {
    apiRequest<{ locations: { locationId: number; locationNickName: string | null }[] }>('/api/portal/students/lookups')
      .then((lk) => setLocations(lk.locations.map((l) => ({ value: l.locationId, label: l.locationNickName ?? `#${l.locationId}` }))))
      .catch(() => {});
  }, []);

  // Location → semesters + current currency rate
  useEffect(() => {
    apiRequest<{ semesters: Row[]; currentSemesterId: number }>(`/api/portal/schedule/semesters?locationId=${locationId}`)
      .then((r) => {
        const opts = (r.semesters ?? [])
          .map((row) => ({ value: n(row.SemesterId ?? row.SemesterID), label: s(row.SemesterName) }))
          .filter((o) => o.value > 0);
        setSemesters(opts);
        if (keepSemester.current) return;
        setSemesterId(r.currentSemesterId || opts[0]?.value || 0);
      })
      .catch(() => {});
    if (isNew) {
      apiRequest<{ rate: number }>(`/api/portal/edit/currency-rate?locationId=${locationId}`)
        .then((r) => setRate((cur) => cur || r.rate))
        .catch(() => {});
    }
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Existing payment
  useEffect(() => {
    if (isNew) return;
    apiRequest<{ payment: Row; lines: Row[] }>(`/api/portal/edit/payment/${id}`)
      .then(({ payment: r, lines }) => {
        setLocationId(n(r.PaymentLocationId));
        setSemesterId(n(r.PaymentSemesterId));
        setTitle(s(r.PaymentIssuedToTitle));
        setIssuedTo(s(r.PaymentIssuedTo));
        setDate(dateOnly(r.PaymentDate) || new Date().toISOString().slice(0, 10));
        setCurrency(s(r.PaymentPaidCurrency) || 'USD');
        setRate(n(r.PaymentPaidCurrencyRate));
        setPaidAmount(n(r.PaymentPaidAmount));
        setTotalAmount(n(r.PaymentTotalAmount));
        setTotalTouched(true);
        setCash(r.PaymentCash === true);
        setChq(r.PaymentChq === true);
        setCC(r.PaymentCC === true);
        setOthers(r.PaymentOthers === true);
        setNumber(s(r.PaymentNumber));
        setRemarks(s(r.PaymentRemarks));
        const ids = [0, 0, 0, 0, 0];
        const labels = ['', '', '', '', ''];
        const amounts = [0, 0, 0, 0, 0];
        (lines ?? []).slice(0, 5).forEach((line, i) => {
          ids[i] = n(line.PaymentPaidStudentId);
          labels[i] = s(line.StudentFullName) || (ids[i] ? `Student #${ids[i]}` : '');
          amounts[i] = n(line.PaymentPaidAmount);
        });
        setLineIds(ids);
        setLineLabels(labels);
        setLineAmounts(amounts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load payment.'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced student search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      apiRequest<Picker[]>(`/api/portal/edit/student-search?q=${encodeURIComponent(q.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }, [q]);

  // Legacy rule: USD payments count at face value; other currencies convert
  // by the rate. The admin can still override the total by typing it.
  useEffect(() => {
    if (totalTouched) return;
    setTotalAmount(currency === 'USD' ? paidAmount : rate > 0 ? Math.round(paidAmount / rate) : 0);
  }, [paidAmount, currency, rate, totalTouched]);

  const linesSum = lineAmounts.reduce((sum, v, i) => (lineIds[i] > 0 ? sum + v : sum), 0);

  function pickStudent(p: Picker) {
    if (activeSlot == null) return;
    setLineIds((prev) => prev.map((v, i) => (i === activeSlot ? p.id : v)));
    setLineLabels((prev) => prev.map((v, i) => (i === activeSlot ? p.label : v)));
    setActiveSlot(null);
    setQ('');
    setResults([]);
  }

  function clearLine(slot: number) {
    setLineIds((prev) => prev.map((v, i) => (i === slot ? 0 : v)));
    setLineLabels((prev) => prev.map((v, i) => (i === slot ? '' : v)));
    setLineAmounts((prev) => prev.map((v, i) => (i === slot ? 0 : v)));
  }

  async function save() {
    if (!semesterId) { setError('Choose a semester.'); return; }
    if (!rate) { setError('Set the currency rate.'); return; }
    if (!lineIds.some((v) => v > 0)) { setError('Add at least one student.'); return; }
    if (linesSum !== totalAmount) {
      setError(`The student amounts (${linesSum}) must add up to the payment total (${totalAmount}).`);
      return;
    }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      PaymentSemesterId: semesterId,
      PaymentIssuedToTitle: title,
      PaymentIssuedTo: issuedTo.trim(),
      PaymentDate: date,
      PaymentTotalAmount: totalAmount,
      PaymentPaidAmount: paidAmount,
      PaymentPaidCurrencyRate: rate,
      PaymentPaidCurrency: currency,
      PaymentCash: cash,
      PaymentChq: chq,
      PaymentCC: cc,
      PaymentOthers: others,
      PaymentNumber: number,
      PaymentDeleted: false,
      PaymentRemarks: remarks,
      PaymentLocationId: locationId,
      lines: LINE_SLOTS.filter((i) => lineIds[i] > 0).map((i) => ({ studentId: lineIds[i], amount: lineAmounts[i] })),
    };

    try {
      if (isNew) {
        await apiRequest('/api/portal/edit/payment', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/portal/edit/payment/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      navigate('/payments');
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

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHero
        compact
        title={isNew ? 'New Group Payment' : issuedTo || 'Group Payment'}
        subtitle={isNew ? 'Record a payment, split across up to five students' : 'Edit payment'}
        slide={1}
      />

      <SmartBack label="Back" fallback="/payments" />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {!canSave && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-700">Your account has view-only access, saving is disabled.</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Receipt */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Receipt</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <select value={locationId} onChange={(e) => { setLocationId(Number(e.target.value)); keepSemester.current = false; }} className={inputCls}>
                <option value={0}>-</option>
                {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
              <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))} className={inputCls}>
                <option value={0}>-</option>
                {semesters.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
              <select value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls}>
                {TITLES.map((t) => <option key={t} value={t}>{t || '-'}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Issued to</label>
              <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Payer name" className={inputCls} />
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

        {/* Student split */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Students</p>
          <p className={`text-xs mb-4 ${linesSum === totalAmount ? 'text-slate-400' : 'text-red-500 font-semibold'}`}>
            Split {linesSum} of {totalAmount}, the amounts must add up to the total.
          </p>
          <div className="space-y-3">
            {LINE_SLOTS.map((slot) => (
              <div key={slot} className="grid grid-cols-[1fr_8rem] gap-3">
                {lineIds[slot] ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800 truncate">{lineLabels[slot]}</span>
                    <button onClick={() => clearLine(slot)} className="text-slate-400 hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : activeSlot === slot ? (
                  <div className="relative">
                    <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onBlur={() => setTimeout(() => setActiveSlot((cur) => (cur === slot ? null : cur)), 200)}
                      placeholder="Search student…"
                      className={`${inputCls} pl-8`}
                    />
                    {(searching || results.length > 0) && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {searching && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
                        {results.map((r) => (
                          <button
                            key={r.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickStudent(r)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveSlot(slot); setQ(''); setResults([]); }}
                    className={`${inputCls} text-left text-slate-400 hover:border-[#1e5c97]/50`}
                  >
                    {slot === 0 ? 'Choose student…' : 'Add another student…'}
                  </button>
                )}
                <input
                  type="number"
                  value={lineAmounts[slot]}
                  disabled={!lineIds[slot]}
                  onChange={(e) => setLineAmounts((prev) => prev.map((v, i) => (i === slot ? Number(e.target.value) : v)))}
                  placeholder="Amount"
                  className={`${inputCls} disabled:bg-slate-50`}
                />
              </div>
            ))}
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
