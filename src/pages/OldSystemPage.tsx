// Old System (SiteMaster only): switch the legacy AMT site OFF module by module.
// Each module starts ENABLED (old pages still work). Ticking "Oblige moving to
// the new system" makes every old page in that module redirect to the new portal
// (ModuleMoved.aspx). The old site reads these same flags live from AMT_DB.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, PowerOff, ArrowRightLeft } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

interface Mod { key: string; label: string; forceMove: boolean }

export function OldSystemPage() {
  const [items, setItems] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  function load() {
    setLoading(true);
    apiRequest<{ items: Mod[] }>('/api/portal/old-modules')
      .then((r) => setItems(r?.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load modules.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function toggle(key: string, forceMove: boolean) {
    setSaving(key);
    setItems((xs) => xs.map((m) => m.key === key ? { ...m, forceMove } : m)); // optimistic
    try {
      await apiRequest('/api/portal/old-modules', { method: 'PUT', body: JSON.stringify({ key, forceMove }) });
      toast.success(`${forceMove ? 'Forcing move for' : 'Re-enabled'} ${labelFor(key)} on the old site.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.');
      load(); // revert to server truth
    } finally {
      setSaving('');
    }
  }
  const labelFor = (k: string) => items.find((m) => m.key === k)?.label ?? k;

  const movedCount = items.filter((m) => m.forceMove).length;

  return (
    <div className="p-6 md:p-8">
      <PageHero
        title="Old System"
        subtitle="Retire the legacy site one module at a time"
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="mb-5 rounded-xl bg-[#e8f0f8] border border-[#1e5c97]/15 p-4 text-sm text-slate-600 leading-relaxed">
        <p className="flex items-center gap-2 font-semibold text-[#1e5c97] mb-1">
          <ArrowRightLeft className="size-4" /> How this works
        </p>
        Every module starts <span className="font-semibold text-emerald-700">enabled</span> — the old site keeps working.
        Tick <span className="font-semibold">“Oblige moving to the new system”</span> for a module and all of its old pages
        will redirect staff to this portal instead. Untick to switch the old pages back on. Changes take effect within ~30&nbsp;seconds.
        {movedCount > 0 && <> Currently <span className="font-semibold text-[#1e5c97]">{movedCount}</span> of {items.length} module(s) are forced to move.</>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((m) => (
            <label
              key={m.key}
              className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                m.forceMove ? 'border-[#1e5c97]/40 bg-[#eef5fb]' : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={m.forceMove}
                disabled={saving === m.key}
                onChange={(e) => toggle(m.key, e.target.checked)}
                className="mt-0.5 size-4 accent-[#1e5c97] shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 leading-tight">{m.label}</p>
                <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${m.forceMove ? 'text-[#1e5c97]' : 'text-emerald-600'}`}>
                  {saving === m.key ? (
                    <><Loader2 className="size-3 animate-spin" /> Saving…</>
                  ) : m.forceMove ? (
                    <><ArrowRightLeft className="size-3" /> Obliged to move — old pages redirect here</>
                  ) : (
                    <><PowerOff className="size-3" /> Old pages still enabled</>
                  )}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
