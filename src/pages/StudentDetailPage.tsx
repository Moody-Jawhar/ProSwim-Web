import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Save, Pencil, X, HeartPulse, PhoneCall, Trophy, Camera } from 'lucide-react';
import { apiRequest, apiUpload, getStoredUser } from '../api/portalApi';

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
    // Parent-editable via the app's Personal Information screen; staff edit
    // here. Allergies/medical notes also surface in the red banner up top.
    title: 'Emergency & Medical',
    fields: [
      { key: 'StudentEmergencyContactName', label: 'Emergency contact', type: 'text' },
      { key: 'StudentEmergencyContactRelation', label: 'Relation', type: 'text' },
      { key: 'StudentEmergencyContactPhoneCode', label: 'Emergency phone code', type: 'text' },
      { key: 'StudentEmergencyContactPhone', label: 'Emergency phone', type: 'text' },
      { key: 'StudentAllergies', label: 'Allergies', type: 'textarea' },
      { key: 'StudentMedicalNotes', label: 'Medical notes', type: 'textarea' },
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
    // Formerly "Swimmer Types" — one swimmer can be enrolled in several
    // programs, so the flags read as program enrollment, and the cards above
    // the form show each active program's schedule/package/attendance.
    title: 'Programs Enrolled In',
    fields: [
      { key: 'StudentGroupSwimmer', label: 'Group Training', type: 'checkbox' },
      { key: 'StudentPrivateSwimmer', label: 'Private Training', type: 'checkbox' },
      { key: 'StudentEliteSwimmer', label: 'Competitive Team', type: 'checkbox' },
      { key: 'StudentAquaBabySwimmer', label: 'AquaBaby', type: 'checkbox' },
      { key: 'StudentAquaGymSwimmer', label: 'AquaGym', type: 'checkbox' },
      { key: 'StudentSchoolSwimmer', label: 'School', type: 'checkbox' },
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
          {row.StudentEliteSwimmer === true && !editing && (
            <Link
              to={`/students/${id}/portfolio`}
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 px-4 py-2 hover:bg-amber-100"
            >
              <Trophy className="size-4" /> Portfolio
            </Link>
          )}
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

      <div className="mb-6 flex items-center gap-4">
        <StudentAvatar
          studentId={id!}
          name={String(row.StudentFullName ?? '')}
          photoUrl={row.StudentPhotoUrl ? String(row.StudentPhotoUrl) : null}
          canSave={canSave}
          onUploaded={(url) => setRow((r) => (r ? { ...r, StudentPhotoUrl: url } : r))}
          onError={setError}
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{String(row.StudentFullName ?? '')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            #{String(row.StudentId)} · {String(row.locationNickName ?? '—')} · {String(row.StudentLatestLevelName ?? '—')}
          </p>
        </div>
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

      <MedicalBanner row={row} />

      {!editing && <ProgramsEnrolled studentId={id!} />}

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

// ─── Profile photo (supervisor-managed) ──────────────────────────────────────

function StudentAvatar({ studentId, name, photoUrl, canSave, onUploaded, onError }: {
  studentId: string;
  name: string;
  photoUrl: string | null;
  canSave: boolean;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  async function handle(file: File | undefined | null) {
    if (!file) return;
    setUploading(true);
    onError('');
    try {
      const res = await apiUpload<{ url: string }>(`/api/portal/students/${studentId}/photo`, file);
      onUploaded(res.url);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-[#e8f0f8] flex items-center justify-center border border-slate-200">
        {uploading ? (
          <Loader2 className="size-5 text-[#1e5c97] animate-spin" />
        ) : photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-[#1e5c97]">{initials || '?'}</span>
        )}
      </div>
      {canSave && (
        <>
          <button
            onClick={() => input.current?.click()}
            title="Upload profile photo"
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1e5c97] text-white flex items-center justify-center hover:bg-[#17497a] shadow"
          >
            <Camera className="size-3.5" />
          </button>
          <input
            ref={input}
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }}
          />
        </>
      )}
    </div>
  );
}

// ─── Medical banner ──────────────────────────────────────────────────────────
// Allergies and medical notes must be impossible to miss for staff, so they
// get a red banner above the record (visible in both view and edit mode),
// with the emergency contact right there for when it matters.

function MedicalBanner({ row }: { row: StudentRow }) {
  const trimmed = (k: string) => String(row[k] ?? '').trim();
  const allergies = trimmed('StudentAllergies');
  const medical = trimmed('StudentMedicalNotes');
  const ecName = trimmed('StudentEmergencyContactName');
  const ecRelation = trimmed('StudentEmergencyContactRelation');
  const ecPhone = [trimmed('StudentEmergencyContactPhoneCode'), trimmed('StudentEmergencyContactPhone')]
    .filter(Boolean).join(' ');
  if (!allergies && !medical) return null;

  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 mb-4">
      <div className="flex items-start gap-3">
        <HeartPulse className="size-5 text-red-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1">Medical — check before sessions</p>
          {allergies && (
            <p className="text-sm text-red-800">
              <span className="font-bold">Allergies:</span> {allergies}
            </p>
          )}
          {medical && (
            <p className="text-sm text-red-800">
              <span className="font-bold">Medical notes:</span> {medical}
            </p>
          )}
          {(ecName || ecPhone) && (
            <p className="text-sm text-red-700 mt-1.5 flex items-center gap-1.5">
              <PhoneCall className="size-3.5 shrink-0" />
              Emergency contact: {ecName || '—'}{ecRelation ? ` (${ecRelation})` : ''}{ecPhone ? ` — ${ecPhone}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Programs Enrolled In ────────────────────────────────────────────────────
// One card per active program (a swimmer can be in several), each with the
// enrollment behind it: registrations + attendance for Group Training,
// packages for Private Training. Flag-only programs render as compact cards.

type Row = Record<string, unknown>;

interface ProgramsData {
  programs: {
    groupTraining: boolean;
    privateTraining: boolean;
    competitiveTeam: boolean;
    aquaBaby: boolean;
    aquaGym: boolean;
    school: boolean;
    gifted: boolean;
    other: boolean;
  };
  registrations: Row[];
  attendance: Row[];
  packages: Row[];
}

const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

function ProgramsEnrolled({ studentId }: { studentId: string }) {
  const [data, setData] = useState<ProgramsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiRequest<ProgramsData>(`/api/portal/students/${studentId}/programs`)
      .then(setData)
      .catch(() => setFailed(true));
  }, [studentId]);

  if (failed) return null; // form below still works; cards are an overlay
  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4 flex items-center gap-2">
        <Loader2 className="size-4 text-[#1e5c97] animate-spin" />
        <p className="text-sm text-slate-400">Loading programs…</p>
      </div>
    );
  }

  const { programs, registrations, attendance, packages } = data;
  // A program is "active" when its flag is set or real enrollment data exists.
  const groupActive = programs.groupTraining || registrations.length > 0;
  const privateActive = programs.privateTraining || packages.length > 0;
  const flagCards: { label: string; on: boolean; cls: string }[] = [
    { label: 'Competitive Team', on: programs.competitiveTeam, cls: 'bg-amber-50 border-amber-200 text-amber-800' },
    { label: 'AquaBaby', on: programs.aquaBaby, cls: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
    { label: 'AquaGym', on: programs.aquaGym, cls: 'bg-teal-50 border-teal-200 text-teal-800' },
    { label: 'School', on: programs.school, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
    { label: 'Gifted', on: programs.gifted, cls: 'bg-pink-50 border-pink-200 text-pink-800' },
    { label: 'Other', on: programs.other, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  ].filter((f) => f.on);

  if (!groupActive && !privateActive && flagCards.length === 0) return null;

  const att = (regId: number) => attendance.find((a) => num(a, 'RegistrationId') === regId);

  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Programs Enrolled In</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groupActive && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 border-t-4 border-t-[#1e5c97]">
            <p className="text-sm font-bold text-[#1e5c97] mb-3">Group Training</p>
            {registrations.length === 0 && (
              <p className="text-sm text-slate-400">Enrolled — no registrations recorded yet.</p>
            )}
            <div className="space-y-3">
              {registrations.map((reg) => {
                const regId = num(reg, 'RegistrationId');
                const classes = [str(reg, 'ClassName1'), str(reg, 'ClassName2'), str(reg, 'ClassName3')]
                  .filter(Boolean).join(' · ');
                const a = att(regId);
                const total = a ? num(a, 'TotalSessions') : 0;
                const attended = a ? num(a, 'AttendedSessions') : 0;
                const stopped = reg['RegistrationStudentStopped'] === true;
                return (
                  <div key={regId} className="text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{str(reg, 'SemesterName') || '—'}</span>
                      {stopped
                        ? <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">Stopped</span>
                        : total > 0 && (
                          <span className="text-[11px] font-bold text-[#1e5c97] bg-[#e8f0f8] rounded-full px-2 py-0.5">
                            {attended}/{total} attended{total > 0 ? ` · ${Math.round((attended / total) * 100)}%` : ''}
                          </span>
                        )}
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      {classes || 'No classes assigned'}
                      {str(reg, 'LocationNickName') && <> · {str(reg, 'LocationNickName')}</>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {privateActive && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 border-t-4 border-t-indigo-500">
            <p className="text-sm font-bold text-indigo-600 mb-3">Private Training</p>
            {packages.length === 0 && (
              <p className="text-sm text-slate-400">Enrolled — no packages recorded yet.</p>
            )}
            <div className="space-y-3">
              {packages.map((p) => {
                const totalSessions = num(p, 'PackageNumberOfSessions');
                const attended = num(p, 'CountAttended');
                const closed = p['PackageClosed'] === true;
                return (
                  <div key={num(p, 'PackageId')} className="text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{str(p, 'PackageName') || `Package #${num(p, 'PackageId')}`}</span>
                      {closed
                        ? <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Closed</span>
                        : totalSessions > 0 && (
                          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                            {attended}/{totalSessions} attended
                          </span>
                        )}
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      {[str(p, 'CoachFullName'), str(p, 'LocationNickName'), str(p, 'PackageStatus')]
                        .filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {flagCards.map((f) => (
          <div key={f.label} className={`rounded-2xl border shadow-soft p-5 border-t-4 ${f.cls}`}>
            <p className="text-sm font-bold">{f.label}</p>
            <p className="text-sm opacity-70 mt-1">Enrolled — sessions are tracked under this student's schedule.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
