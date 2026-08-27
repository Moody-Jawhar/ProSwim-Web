import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from './PageHero';
import { SmartBack } from './SmartBack';

type Row = Record<string, unknown>;
type Option = { value: string | number; label: string };

export type FieldType = 'text' | 'number' | 'date' | 'checkbox' | 'textarea' | 'select';

export interface FormField {
  key: string;                 // proc parameter / column name
  label: string;
  type: FieldType;
  options?: Option[];          // static select options
  optionsKey?: string;         // key into a lookups map
  colSpan2?: boolean;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface RecordFormConfig {
  title: string;               // e.g. "Semester"
  listPath: string;            // e.g. "/semesters"
  slug: string;                // e.g. "semester" → /api/portal/edit/semester
  idKey: string;               // column that holds the record id
  titleKey: string;            // column to show as the record's name
  sections: FormSection[];
  lookups?: string;            // endpoint returning Record<string, Option[]>
  /** Defaults applied when creating a new record. */
  createDefaults?: Record<string, unknown>;
  heroSlide?: number;
}

function toDateInput(v: unknown): string {
  if (!v || typeof v !== 'string') return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RecordFormPage({ config }: { config: RecordFormConfig }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.canSave !== false;
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [record, setRecord] = useState<Row | null>(null);
  const [lookups, setLookups] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function hydrate(r: Row) {
    const f: Record<string, unknown> = {};
    for (const sec of config.sections)
      for (const fd of sec.fields)
        f[fd.key] = fd.type === 'date' ? toDateInput(r[fd.key]) : r[fd.key] ?? (fd.type === 'checkbox' ? false : '');
    setForm(f);
  }

  useEffect(() => {
    if (config.lookups)
      apiRequest<Record<string, Option[]>>(config.lookups).then(setLookups).catch(() => {});
  }, [config.lookups]);

  useEffect(() => {
    if (isNew) {
      const f: Record<string, unknown> = {};
      for (const sec of config.sections)
        for (const fd of sec.fields)
          f[fd.key] = config.createDefaults?.[fd.key] ?? (fd.type === 'checkbox' ? false : '');
      setForm(f);
      return;
    }
    apiRequest<Row>(`/api/portal/edit/${config.slug}/${id}`)
      .then((r) => { setRecord(r); hydrate(r); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load record.'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      // Merge in createDefaults for keys not on the form (proc needs every param).
      const payload = isNew ? { ...config.createDefaults, ...form } : form;
      if (isNew) {
        await apiRequest(`/api/portal/edit/${config.slug}`, { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/portal/edit/${config.slug}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      navigate(config.listPath);
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

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';
  const recordName = record ? String(record[config.titleKey] ?? '') : '';

  function renderField(fd: FormField) {
    const v = form[fd.key];
    switch (fd.type) {
      case 'checkbox':
        return (
          <label key={fd.key} className="flex items-center gap-2 text-sm text-slate-700 select-none py-1.5">
            <input type="checkbox" checked={v === true} onChange={(e) => set(fd.key, e.target.checked)} className="accent-[#1e5c97]" />
            {fd.label}
          </label>
        );
      case 'textarea':
        return (
          <div key={fd.key} className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <textarea value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} rows={2} className={inputCls} />
          </div>
        );
      case 'select': {
        const opts = fd.options ?? lookups[fd.optionsKey || ''] ?? [];
        const numeric = typeof opts[0]?.value === 'number';
        return (
          <div key={fd.key} className={fd.colSpan2 ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <select
              value={String(v ?? (numeric ? 0 : ''))}
              onChange={(e) => set(fd.key, numeric ? Number(e.target.value) : e.target.value)}
              className={inputCls}
            >
              <option value={numeric ? 0 : ''}>—</option>
              {opts.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
            </select>
          </div>
        );
      }
      case 'number':
        return (
          <div key={fd.key} className={fd.colSpan2 ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <input type="number" value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />
          </div>
        );
      case 'date':
        return (
          <div key={fd.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <input type="date" value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} className={inputCls} />
          </div>
        );
      default:
        return (
          <div key={fd.key} className={fd.colSpan2 ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{fd.label}</label>
            <input value={String(v ?? '')} onChange={(e) => set(fd.key, e.target.value)} className={inputCls} />
          </div>
        );
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHero
        compact
        title={isNew ? `New ${config.title}` : recordName || config.title}
        subtitle={isNew ? `Add a ${config.title.toLowerCase()}` : `Edit ${config.title.toLowerCase()}`}
        slide={config.heroSlide ?? 0}
      />

      <SmartBack label="Back" fallback={config.listPath} />

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
        {config.sections.map((sec) => (
          <div key={sec.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{sec.title}</p>
            <div className={sec.fields.every((f) => f.type === 'checkbox')
              ? 'grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1'
              : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
              {sec.fields.map(renderField)}
            </div>
          </div>
        ))}
      </div>

      {canSave && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="btn-grad flex items-center gap-2 rounded-xl text-sm font-semibold px-6 py-2.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isNew ? `Create ${config.title}` : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
