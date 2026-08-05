import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Save, Pencil, X } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';

// Full proc row, keyed by original column names (PascalCase from SQL).
type StudentRow = Record<string, unknown>;

interface Lookups {
  bloodTypes: { bloodTypeId: number; bloodTypeName: string | null }[];
  locations: { locationId: number; locationNickName: string | null }[];
  coaches: { coachId: number; coachFullName: string | null; locationNickName: string | null }[];
}

type FieldType = 'text' | 'date' | 'checkbox' | 'textarea' | 'gender' | 'bloodType' | 'location' | 'coach';

interface FieldDef {
  key: string;      // original column / proc param name
  label: string;
  type: FieldType;
}

// Mirrors the StudentsIndividual.aspx form groups. Every key is a
// P_Student_Update parameter.
const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Personal',
    fields: [
      { key: 'StudentFirstName', label: 'First name', type: 'text' },
      { key: 'StudentMiddleName', label: 'Middle name', type: 'text' },
      { key: 'StudentLastName', label: 'Last name', type: 'text' },
      { key: 'StudentGender', label: 'Gender', type: 'gender' },
      { key: 'StudentDateOfBirth', label: 'Date of birth', type: 'date' },
      { key: 'StudentBloodTypeId', label: 'Blood type', type: 'bloodType' },
      { key: 'StudentSchool', label: 'School', type: 'text' },
      { key: 'StudentNationality1', label: 'Nationality 1', type: 'text' },
      { key: 'StudentNationality2', label: 'Nationality 2', type: 'text' },
      { key: 'StudentMomOccupation', label: 'Mom occupation', type: 'text' },
      { key: 'StudentDadOccupation', label: 'Dad occupation', type: 'text' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'StudentPhoneNumberCode1', label: 'Phone code 1', type: 'text' },
      { key: 'StudentPhoneNumber1', label: 'Phone 1', type: 'text' },
      { key: 'StudentPhoneNumberCode2', label: 'Phone code 2', type: 'text' },
      { key: 'StudentPhoneNumber2', label: 'Phone 2', type: 'text' },
      { key: 'StudentEmail', label: 'Email', type: 'text' },
      { key: 'StudentEmail2', label: 'Email 2', type: 'text' },
      { key: 'StudentFacebookAccount', label: 'Facebook', type: 'text' },
      { key: 'StudentParentFacebook', label: 'Parent Facebook', type: 'text' },
    ],
  },
  {
    title: 'Address',
    fields: [
      { key: 'StudentAddressCity', label: 'City', type: 'text' },
      { key: 'StudentAddressRegion', label: 'Region', type: 'text' },
      { key: 'StudentAddressStreet', label: 'Street', type: 'text' },
      { key: 'StudentAddressBuilding', label: 'Building', type: 'text' },
      { key: 'StudentAddressFloor', label: 'Floor', type: 'text' },
    ],
  },
  {
    title: 'Swimming',
    fields: [
      { key: 'StudentStartingDate', label: 'Starting date', type: 'date' },
      { key: 'StudentPrimaryLocationId', label: 'Primary location', type: 'location' },
      { key: 'StudentPrimaryLocationId2', label: 'Location 2', type: 'location' },
      { key: 'StudentPrimaryLocationId3', label: 'Location 3', type: 'location' },
      { key: 'StudentPrimaryCoachId', label: 'Primary coach', type: 'coach' },
      { key: 'StudentStartingCoach', label: 'Starting coach', type: 'text' },
      { key: 'StudentStartingLocation', label: 'Starting location', type: 'text' },
    ],
  },
  {
    title: 'Swimmer Types',
    fields: [
      { key: 'StudentGroupSwimmer', label: 'Group', type: 'checkbox' },
      { key: 'StudentPrivateSwimmer', label: 'Private', type: 'checkbox' },
      { key: 'StudentSchoolSwimmer', label: 'School', type: 'checkbox' },
      { key: 'StudentAquaBabySwimmer', label: 'Aqua Baby', type: 'checkbox' },
      { key: 'StudentAquaGymSwimmer', label: 'Aqua Gym', type: 'checkbox' },
      { key: 'StudentEliteSwimmer', label: 'Elite', type: 'checkbox' },
      { key: 'StudentGiftedSwimmer', label: 'Gifted', type: 'checkbox' },
      { key: 'StudentOthersSwimmer', label: 'Other', type: 'checkbox' },
      { key: 'StudentWaitingList', label: 'Waiting list', type: 'checkbox' },
      { key: 'StudentActive', label: 'Active', type: 'checkbox' },
    ],
  },
  {
    title: 'Website & Messaging',
    fields: [
      { key: 'StudentShowOnline', label: 'Show online', type: 'checkbox' },
      { key: 'StudentShowWallofFame', label: 'Wall of Fame', type: 'checkbox' },
      { key: 'StudentShowChampion', label: 'Champion', type: 'checkbox' },
      { key: 'StudentShowSpecial', label: 'Special', type: 'checkbox' },
      { key: 'StudentSpecialText', label: 'Special text', type: 'text' },
      { key: 'StudentNoBulkWA', label: 'No bulk WhatsApp', type: 'checkbox' },
      { key: 'StudentNoBulkEmail', label: 'No bulk email', type: 'checkbox' },
    ],
  },
  {
    title: 'Health & Notes',
    fields: [
      { key: 'StudentDifficulty', label: 'Difficulty', type: 'checkbox' },
      { key: 'StudentDifficultyRemarks', label: 'Difficulty remarks', type: 'textarea' },
      { key: 'StudentVaccinated', label: 'Vaccinated', type: 'checkbox' },
      { key: 'StudentVaccinatedRemarks', label: 'Vaccination remarks', type: 'textarea' },
      { key: 'StudentNotes', label: 'Notes', type: 'textarea' },
    ],
  },
];

function toDateInput(v: unknown): string {
  if (!v || typeof v !== 'string') return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const editing = searchParams.get('edit') === '1' && canSave;

  const [row, setRow] = useState<StudentRow | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function initForm(r: StudentRow) {
    const f: Record<string, unknown> = {};
    for (const sec of SECTIONS)
      for (const fd of sec.fields)
        f[fd.key] = fd.type === 'date' ? toDateInput(r[fd.key]) : r[fd.key] ?? (fd.type === 'checkbox' ? false : '');
    setForm(f);
  }

  useEffect(() => {
    Promise.all([
      apiRequest<StudentRow>(`/api/portal/students/${id}`),
      apiRequest<Lookups>('/api/portal/students/lookups'),
    ])
      .then(([r, lk]) => { setRow(r); initForm(r); setLookups(lk); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load student.'))
      .finally(() => setLoading(false));
  }, [id]);

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit() {
    setSearchParams({ edit: '1' });
  }

  function cancelEdit() {
    if (row) initForm(row); // discard unsaved changes
    setNotice('');
    setSearchParams({});
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<StudentRow>(`/api/portal/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setRow(updated);
      initForm(updated);
      setSearchParams({});
      setNotice('Saved. Changes are audit-logged per field, same as the legacy tool.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
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

  if (!row) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error || 'Student not found.'}</p>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  function renderField(fd: FieldDef) {
    const v = form[fd.key];
    switch (fd.type) {
      case 'checkbox':
        return (
          <label key={fd.key} className="flex items-center gap-2 text-sm text-slate-700 select-none py-1">
            <input
              type="checkbox"
              checked={v === true}
              onChange={(e) => set(fd.key, e.target.checked)}
              className="accent-[#1e5c97]"
            />
            {fd.label}
          </label>
        );
      case 'textarea':
        return (
          <div key={fd.key} className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <textarea value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} rows={2} className={inputCls} />
          </div>
        );
      case 'date':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <input type="date" value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} className={inputCls} />
          </div>
        );
      case 'gender':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <select value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        );
      case 'bloodType':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <select value={Number(v ?? 0)} onChange={(e) => set(fd.key, Number(e.target.value))} className={inputCls}>
              <option value={0}>—</option>
              {lookups?.bloodTypes.map((b) => (
                <option key={b.bloodTypeId} value={b.bloodTypeId}>{b.bloodTypeName}</option>
              ))}
            </select>
          </div>
        );
      case 'location':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <select value={Number(v ?? 0)} onChange={(e) => set(fd.key, Number(e.target.value))} className={inputCls}>
              <option value={0}>—</option>
              {lookups?.locations.map((l) => (
                <option key={l.locationId} value={l.locationId}>{l.locationNickName}</option>
              ))}
            </select>
          </div>
        );
      case 'coach':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <select value={Number(v ?? 0)} onChange={(e) => set(fd.key, Number(e.target.value))} className={inputCls}>
              <option value={0}>—</option>
              {lookups?.coaches.map((c) => (
                <option key={c.coachId} value={c.coachId}>
                  {c.coachFullName}{c.locationNickName ? ` (${c.locationNickName})` : ''}
                </option>
              ))}
            </select>
          </div>
        );
      default:
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <input value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} className={inputCls} />
          </div>
        );
    }
  }

  // Read-only rendering of the same field definitions (view mode).
  function renderViewField(fd: FieldDef) {
    const v = row![fd.key];
    if (fd.type === 'checkbox') {
      return (
        <div key={fd.key} className="flex items-center gap-2 text-sm py-1">
          <span className={`inline-block w-2 h-2 rounded-full ${v === true ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          <span className={v === true ? 'text-slate-800' : 'text-slate-400'}>{fd.label}</span>
        </div>
      );
    }
    let text: string;
    if (v == null || v === '') text = '—';
    else if (fd.type === 'date') {
      const d = new Date(String(v));
      text = isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    } else if (fd.type === 'bloodType') {
      text = lookups?.bloodTypes.find((b) => b.bloodTypeId === Number(v))?.bloodTypeName ?? '—';
    } else if (fd.type === 'location') {
      text = lookups?.locations.find((l) => l.locationId === Number(v))?.locationNickName ?? '—';
    } else if (fd.type === 'coach') {
      text = lookups?.coaches.find((c) => c.coachId === Number(v))?.coachFullName ?? '—';
    } else {
      text = String(v);
    }
    return (
      <div key={fd.key} className="flex items-baseline justify-between gap-4 text-sm py-0.5">
        <span className="text-slate-400 shrink-0">{fd.label}</span>
        <span className="text-slate-800 text-right">{text}</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e5c97]">
          <ArrowLeft className="size-4" /> Back to students
        </Link>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
              >
                <X className="size-4" /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a] disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </button>
            </>
          ) : (
            canSave && (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a]"
              >
                <Pencil className="size-4" /> Edit
              </button>
            )
          )}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{String(row.StudentFullName ?? '')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          #{String(row.StudentId)} · {String(row.locationNickName ?? '—')} · {String(row.StudentLatestLevelName ?? '—')}
        </p>
      </div>

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
      {!canSave && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-700">Your account has view-only access — saving is disabled.</p>
        </div>
      )}

      <div className="space-y-4">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{sec.title}</p>
            <div className={sec.fields.every((f) => f.type === 'checkbox')
              ? 'grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1'
              : editing
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : 'grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1'}>
              {sec.fields.map(editing ? renderField : renderViewField)}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
          >
            <X className="size-4" /> Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a] disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
