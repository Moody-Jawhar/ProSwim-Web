import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save, Search, X } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';

type Row = Record<string, unknown>;
type Option = { value: number; label: string };
type Picker = { id: number; label: string };

type PackageType = {
  name: string;
  info: string;
  sessions: number;
  price1: number;
  price2: number;
  price3: number;
  currency: string;
};

const STUDENT_SLOTS = [0, 1, 2] as const;
const PACKAGE_STATUSES = ['Active', 'Closed', 'ClosedNeedPayment', 'MovedtoGroup', 'Freeze', 'Cancelled', 'Transfer'];
const FOLLOW_UPS = ['', 'Renewing', 'Renewed', 'MovedtoGroup', 'Leaving'];

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
const dateOnly = (v: unknown) => {
  const str = s(v);
  return str.length >= 10 ? str.slice(0, 10) : '';
};

export function PrivatePackageForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const isNew = !id || id === 'new';

  const [locations, setLocations] = useState<Option[]>([]);
  const [coaches, setCoaches] = useState<Option[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [types, setTypes] = useState<PackageType[]>([]);

  // form state
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [packageName, setPackageName] = useState('');
  const [coachId, setCoachId] = useState(0);
  const [level, setLevel] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Active');
  const [followUp, setFollowUp] = useState('');
  const [sessions, setSessions] = useState(0);
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [netToPay, setNetToPay] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [remarks, setRemarks] = useState('');
  const [studentIds, setStudentIds] = useState<number[]>([0, 0, 0]);
  const [studentLabels, setStudentLabels] = useState<string[]>(['', '', '']);

  // student search (one active slot at a time)
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Picker[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedType = useRef(false); // avoid auto-fill clobbering a loaded record

  // Lookups: locations + (per location) coaches & levels & package types
  useEffect(() => {
    apiRequest<{ locations: { locationId: number; locationNickName: string | null }[] }>(
      '/api/portal/students/lookups'
    )
      .then((lk) =>
        setLocations(lk.locations.map((l) => ({ value: l.locationId, label: l.locationNickName ?? `#${l.locationId}` })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest<{ coaches: Option[]; levels: Option[] }>(`/api/portal/modules/lookups?locationId=${locationId}`)
      .then((lk) => {
        setCoaches(lk.coaches);
        setLevels(lk.levels.map((l) => l.label));
      })
      .catch(() => {});
    apiRequest<Row[]>(`/api/portal/edit/package-types?locationId=${locationId}`)
      .then((rows) =>
        setTypes(
          rows
            .filter((r) => r.PrivatePackageActive !== false)
            .map((r) => ({
              name: s(r.PrivatePackageName),
              info: s(r.PrivatePackageInfo) || s(r.PrivatePackageName),
              sessions: n(r.PrivatePackageSessionsCount),
              price1: n(r.PrivatePackagePriceForOneStudent),
              price2: n(r.PrivatePackagePriceForTwoStudents),
              price3: n(r.PrivatePackagePriceForThreeStudents),
              currency: s(r.PrivatePackageCurrency) || 'USD',
            }))
        )
      )
      .catch(() => setTypes([]));
  }, [locationId]);

  // Existing package
  useEffect(() => {
    if (isNew) return;
    apiRequest<Row>(`/api/portal/edit/private-package/${id}`)
      .then((r) => {
        loadedType.current = true;
        setLocationId(n(r.PackageLocationId));
        setPackageName(s(r.PackageName));
        setCoachId(n(r.PackageCoachId));
        setLevel(s(r.PackageLevel));
        setStartDate(dateOnly(r.PackageStartDate) || new Date().toISOString().slice(0, 10));
        setStatus(s(r.PackageStatus) || 'Active');
        setFollowUp(s(r.PackageFollowUp));
        setSessions(n(r.PackageNumberOfSessions));
        setAmount(n(r.PackageAmount));
        setDiscount(n(r.PackageDiscount));
        setNetToPay(n(r.PackageNetToPay));
        setCurrency(s(r.PackageCurrency) || 'USD');
        setRemarks(s(r.PackageRemarks));
        const ids = [n(r.PackageStudentId1), n(r.PackageStudentId2), n(r.PackageStudentId3)];
        setStudentIds(ids);
        setStudentLabels(
          ids.map((sid, i) => (sid ? (i === 0 && s(r.StudentFullName) ? s(r.StudentFullName) : `Student #${sid}`) : ''))
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load package.'))
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

  const studentCount = useMemo(() => studentIds.filter((v) => v > 0).length, [studentIds]);
  const selectedType = useMemo(() => types.find((t) => t.name === packageName), [types, packageName]);
  const isCustom = packageName.toLowerCase().includes('custom');

  // Price auto-fill, mirroring the legacy screen: package type + number of
  // students drive sessions/amount; "custom" packages stay manual.
  useEffect(() => {
    if (!selectedType) return;
    if (loadedType.current) { loadedType.current = false; return; }
    setCurrency(selectedType.currency);
    if (isCustom) return;
    setSessions(selectedType.sessions);
    const price =
      studentCount >= 3 ? selectedType.price3 : studentCount === 2 ? selectedType.price2 : selectedType.price1;
    setAmount(price);
  }, [selectedType, studentCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNetToPay(amount - discount);
  }, [amount, discount]);

  function pickStudent(p: Picker) {
    if (activeSlot == null) return;
    setStudentIds((prev) => prev.map((v, i) => (i === activeSlot ? p.id : v)));
    setStudentLabels((prev) => prev.map((v, i) => (i === activeSlot ? p.label : v)));
    setActiveSlot(null);
    setQ('');
    setResults([]);
  }

  function clearStudent(slot: number) {
    setStudentIds((prev) => prev.map((v, i) => (i === slot ? 0 : v)));
    setStudentLabels((prev) => prev.map((v, i) => (i === slot ? '' : v)));
  }

  async function save() {
    if (!studentIds.some((v) => v > 0)) { setError('Choose at least one student.'); return; }
    if (!packageName) { setError('Choose a package type.'); return; }
    if (!level.trim()) { setError('Set the level.'); return; }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      PackageLocationId: locationId,
      PackageCoachId: coachId,
      PackageStudentId1: studentIds[0],
      PackageStudentId2: studentIds[1],
      PackageStudentId3: studentIds[2],
      PackageNumberOfSessions: sessions,
      PackageAmount: amount,
      PackageDiscount: discount,
      PackageNetToPay: netToPay,
      PackageStartDate: startDate,
      PackageRemarks: remarks,
      PackageDeleted: false,
      PackageStatus: status,
      PackageName: packageName,
      PackagePenalty: 0,
      PackageLevel: level,
      PackageFollowUp: followUp,
    };
    if (isNew) {
      payload.PackageParentID = 0;
      payload.PackageCurrency = currency;
    }

    try {
      if (isNew) {
        await apiRequest('/api/portal/edit/private-package', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/portal/edit/private-package/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      navigate('/privates');
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
        title={isNew ? 'New Private Package' : studentLabels[0] || 'Private Package'}
        subtitle={isNew ? 'Register a private training package' : 'Edit private package'}
        slide={1}
      />

      <SmartBack label="Back" fallback="/privates" />

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
        {/* Students */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Students (1–3 per package)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STUDENT_SLOTS.map((slot) => (
              <div key={slot}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Student {slot + 1}</label>
                {studentIds[slot] ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800 truncate">{studentLabels[slot]}</span>
                    <button onClick={() => clearStudent(slot)} className="text-slate-400 hover:text-red-500">
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
                    Choose student…
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Package */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Package</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={inputCls}>
                <option value={0}>-</option>
                {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Package type</label>
              <select value={packageName} onChange={(e) => setPackageName(e.target.value)} className={inputCls}>
                <option value="">-</option>
                {types.map((t) => <option key={t.name} value={t.name}>{t.info}</option>)}
                {packageName && !types.some((t) => t.name === packageName) && (
                  <option value={packageName}>{packageName}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Coach</label>
              <select value={coachId} onChange={(e) => setCoachId(Number(e.target.value))} className={inputCls}>
                <option value={0}>-</option>
                {coaches.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls}>
                <option value="">-</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                {level && !levels.includes(level) && <option value={level}>{level}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                {PACKAGE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                {status && !PACKAGE_STATUSES.includes(status) && <option value={status}>{status}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Follow-up</label>
              <select value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={inputCls}>
                {FOLLOW_UPS.map((f) => <option key={f} value={f}>{f || '-'}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Sessions & Pricing {selectedType && !isCustom ? 'auto-filled from the package type' : ''}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Sessions</label>
              <input type="number" value={sessions} onChange={(e) => setSessions(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Discount</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Net to pay</label>
              <input type="number" value={netToPay} readOnly className={`${inputCls} bg-slate-50`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!isNew}
                className={`${inputCls} disabled:bg-slate-50`}
                title={isNew ? '' : 'Currency is set when the package is created'}
              >
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
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
            {isNew ? 'Create package' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
