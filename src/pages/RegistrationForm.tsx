import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save, ArrowLeft, Search, X } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;
type Option = { value: number; label: string };
type Picker = { id: number; label: string };

const CLASS_SLOTS = [1, 2, 3, 4, 5, 6, 7] as const;
const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v));

export function RegistrationForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const isNew = !id || id === 'new';

  const [semesters, setSemesters] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Picker[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);

  // form state
  const [studentId, setStudentId] = useState(0);
  const [studentLabel, setStudentLabel] = useState('');
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [semesterId, setSemesterId] = useState(0);
  const [levelId, setLevelId] = useState(0);
  const [times, setTimes] = useState(1);
  const [classIds, setClassIds] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [cost, setCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [netToPay, setNetToPay] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [stopped, setStopped] = useState(false);
  const [kit, setKit] = useState(false);

  // student search
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Picker[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A new form defaults to the location's current semester; an existing one must
  // keep the semester on the record, until the user actively switches location.
  const keepSemester = useRef(!isNew);

  // Lookups
  useEffect(() => {
    apiRequest<{ levels: Option[] }>('/api/portal/modules/lookups')
      .then((lk) => setLevels(lk.levels))
      .catch(() => {});
    apiRequest<{ locations: { locationId: number; locationNickName: string | null }[] }>(
      '/api/portal/students/lookups'
    )
      .then((lk) => setLocations(lk.locations.map((l) => ({ value: l.locationId, label: l.locationNickName ?? `#${l.locationId}` }))))
      .catch(() => {});
  }, []);

  // Location → semester list, defaulting to the semester running right now.
  useEffect(() => {
    apiRequest<{ semesters: Row[]; currentSemesterId: number }>(
      `/api/portal/schedule/semesters?locationId=${locationId}`
    )
      .then((r) => {
        const opts = (r.semesters ?? [])
          .map((row) => ({ value: n(row.SemesterId ?? row.SemesterID), label: s(row.SemesterName) }))
          .filter((o) => o.value > 0);
        setSemesters(opts);
        if (keepSemester.current) return;
        setSemesterId(r.currentSemesterId || opts[0]?.value || 0);
      })
      .catch(() => {});
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeLocation(id: number) {
    setLocationId(id);
    keepSemester.current = false; // re-default onto the new location's current semester
  }

  // Existing registration
  useEffect(() => {
    if (isNew) return;
    apiRequest<Row>(`/api/portal/edit/registration/${id}`)
      .then((r) => {
        setStudentId(n(r.RegistrationStudentId));
        setStudentLabel(s(r.StudentFullName) || `Student #${n(r.RegistrationStudentId)}`);
        setSemesterId(n(r.RegistrationSemesterId));
        setLevelId(n(r.RegistrationLevelID));
        setTimes(n(r.RegistrationNumberOfTimes) || 1);
        setClassIds(CLASS_SLOTS.map((i) => n(r[`RegistrationClassId${i}`])));
        setCost(n(r.RegistrationCost));
        setDiscount(n(r.RegistrationDiscount));
        setNetToPay(n(r.RegistrationNetToPay));
        setRemarks(s(r.RegistrationRemarks));
        setStopped(r.RegistrationStudentStopped === true);
        setKit(r.RegistrationKit === true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load registration.'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Classes for the chosen semester
  useEffect(() => {
    if (!semesterId) { setClasses([]); return; }
    apiRequest<Picker[]>(`/api/portal/edit/classes-for-semester?semesterId=${semesterId}`)
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [semesterId]);

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

  const classOptions = useMemo(() => classes, [classes]);

  function setSlot(i: number, value: number) {
    setClassIds((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function pickStudent(p: Picker) {
    setStudentId(p.id);
    setStudentLabel(p.label);
    setQ('');
    setResults([]);
  }

  async function save() {
    if (!studentId) { setError('Choose a student first.'); return; }
    if (!semesterId) { setError('Choose a semester.'); return; }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      RegistrationStudentId: studentId,
      RegistrationSemesterId: semesterId,
      RegistrationLevelID: levelId,
      RegistrationNumberOfTimes: times,
      RegistrationDate: new Date().toISOString().slice(0, 10),
      RegistrationCost: cost,
      RegistrationDiscount: discount,
      RegistrationNetToPay: netToPay,
      RegistrationRemarks: remarks,
      RegistrationStudentStopped: stopped,
      RegistrationKit: kit,
    };
    CLASS_SLOTS.forEach((slot, idx) => { payload[`RegistrationClassId${slot}`] = classIds[idx]; });

    try {
      if (isNew) {
        await apiRequest('/api/portal/edit/registration', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/portal/edit/registration/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      navigate('/registrations');
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
        title={isNew ? 'New Registration' : studentLabel || 'Registration'}
        subtitle={isNew ? 'Register a student for a semester' : 'Edit registration'}
        slide={1}
      />

      <button onClick={() => navigate('/registrations')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e5c97] mb-4">
        <ArrowLeft className="size-4" /> Back to registrations
      </button>

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
        {/* Student + semester */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Student & Semester</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Student</label>
              {studentId ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{studentLabel}</span>
                  {isNew && (
                    <button onClick={() => { setStudentId(0); setStudentLabel(''); }} className="text-slate-400 hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search student by name…"
                    className={`${inputCls} pl-8`}
                  />
                  {(searching || results.length > 0) && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {searching && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
                      {results.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => pickStudent(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          {r.label}
                        </button>
                      ))}
                      {!searching && results.length === 0 && q.trim().length >= 2 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No students found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <select value={locationId} onChange={(e) => changeLocation(Number(e.target.value))} className={inputCls}>
                <option value={0}>All locations</option>
                {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
              <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))} className={inputCls}>
                <option value={0}>—</option>
                {semesters.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Level</label>
              <select value={levelId} onChange={(e) => setLevelId(Number(e.target.value))} className={inputCls}>
                <option value={0}>—</option>
                {levels.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Times per week</label>
              <input type="number" min={1} max={7} value={times} onChange={(e) => setTimes(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Classes {semesterId ? '' : '— pick a semester first'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLASS_SLOTS.map((slot, idx) => (
              <div key={slot}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Class {slot}</label>
                <select
                  value={classIds[idx]}
                  onChange={(e) => setSlot(idx, Number(e.target.value))}
                  disabled={!semesterId}
                  className={`${inputCls} disabled:bg-slate-50`}
                >
                  <option value={0}>—</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Money */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Pricing</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cost</label>
              <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Discount</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Net to pay</label>
              <input type="number" value={netToPay} onChange={(e) => setNetToPay(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input type="checkbox" checked={kit} onChange={(e) => setKit(e.target.checked)} className="accent-[#1e5c97]" /> Kit included
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input type="checkbox" checked={stopped} onChange={(e) => setStopped(e.target.checked)} className="accent-[#1e5c97]" /> Stopped
            </label>
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
            {isNew ? 'Create registration' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
