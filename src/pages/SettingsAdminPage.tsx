// System settings, port of Settings.aspx + SettingsTxt.aspx. The five
// whitelisted keys (welcome text, rules, WhatsApp templates) edited in place.
// SiteMaster only, enforced server-side too.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Save, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

interface Setting { field: string; html: boolean; value: string }

export function SettingsAdminPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [active, setActive] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Setting[]>('/api/portal/admin/settings')
      .then((list) => {
        setSettings(list);
        if (list.length > 0) { setActive(list[0].field); setValue(list[0].value); }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load settings.'));
  }, []);

  function pick(field: string) {
    const s = settings?.find((x) => x.field === field);
    setActive(field);
    setValue(s?.value ?? '');
    setSaved(false);
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiRequest('/api/portal/admin/settings', {
        method: 'PUT', body: JSON.stringify({ field: active, value }),
      });
      setSettings((list) => (list ?? []).map((s) => (s.field === active ? { ...s, value } : s)));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the setting.');
    } finally {
      setSaving(false);
    }
  }

  const current = settings?.find((s) => s.field === active);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHero title="Settings" subtitle="Welcome text, rules & message templates" slide={4} />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!settings ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.map((s) => (
              <button key={s.field} onClick={() => pick(s.field)}
                className={`text-sm font-semibold rounded-full px-4 py-1.5 border transition-colors ${
                  active === s.field
                    ? 'bg-[#1e5c97] text-white border-[#1e5c97]'
                    : 'text-slate-600 border-slate-200 hover:border-[#1e5c97]/40'
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
