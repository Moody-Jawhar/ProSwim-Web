// Two settings pages sharing one editor:
//  - SettingsAdminPage  -> System Settings (welcome text + class rules/terms)
//  - TextSettingsPage    -> Text Message Settings (birthday wish, session reminder)
// SiteMaster only, enforced server-side too.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Save, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

interface Setting { field: string; html: boolean; value: string }

// Fields that are messages sent to families → "Text Message Settings".
// Everything else in the whitelist is app content → "System Settings".
const TEXT_FIELDS = new Set(['birthday wish', 'session reminder']);
const isTextField = (f: string) => TEXT_FIELDS.has(f.toLowerCase());

export function SettingsAdminPage() {
  return (
    <SettingsEditor
      title="System Settings"
      subtitle="Welcome text and the class rules & terms shown in the apps"
      filter={(f) => !isTextField(f)}
    />
  );
}

export function TextSettingsPage() {
  return (
    <SettingsEditor
      title="Text Message Settings"
      subtitle="Templates sent to families (birthday wish, session reminder)"
      filter={isTextField}
    />
  );
}

// The in-place setting editor, scoped to whichever fields `filter` allows.
function SettingsEditor({ title, subtitle, filter }: {
  title: string; subtitle: string; filter: (field: string) => boolean;
}) {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [active, setActive] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Setting[]>('/api/portal/admin/settings')
      .then((list) => {
        const scoped = list.filter((s) => filter(s.field));
        setSettings(scoped);
        if (scoped.length > 0) { setActive(scoped[0].field); setValue(scoped[0].value); }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load settings.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(field: string) {
    const s = settings?.find((x) => x.field === field);
    setActive(field); setValue(s?.value ?? ''); setSaved(false); setError('');
  }

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiRequest('/api/portal/admin/settings', { method: 'PUT', body: JSON.stringify({ field: active, value }) });
      setSettings((list) => (list ?? []).map((s) => (s.field === active ? { ...s, value } : s)));
      setSaved(true);
      toast.success('Setting saved.');
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save the setting.';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  const current = settings?.find((s) => s.field === active);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHero title={title} subtitle={subtitle} slide={4} />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!settings ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : settings.length === 0 ? (
        <p className="text-sm text-slate-400">No settings in this section.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.map((s) => (
              <button key={s.field} onClick={() => pick(s.field)}
                className={`text-sm font-semibold rounded-full px-4 py-1.5 border transition-colors ${
                  active === s.field ? 'bg-[#1e5c97] text-white border-[#1e5c97]' : 'text-slate-600 border-slate-200 hover:border-[#1e5c97]/40'
                }`}>
                {s.field}
              </button>
            ))}
          </div>

          {current?.html && (
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
              <SettingsIcon className="size-3.5" /> This field holds HTML shown in the apps, edit carefully.
            </p>
          )}
          <textarea value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }}
            rows={current?.html ? 16 : 8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40" />

          <div className="flex items-center gap-3 mt-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Changes
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
