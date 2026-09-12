// Access Control (SiteMaster only): a role × page matrix. Each cell is a
// None/View/Full dropdown; changes save immediately. SiteMaster is always Full
// (read-only). "Reset" clears all overrides back to the code defaults.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

type Levels = Record<string, string>;
interface Obj { code: string; label: string; group: string; levels: Levels }
interface Matrix { roles: string[]; objects: Obj[] }

const ROLE_LABEL: Record<string, string> = {
  sitemaster: 'SiteMaster', superuser: 'Super User', user: 'User', audit: 'Audit', guest: 'Guest',
};
const LEVELS = ['None', 'View', 'Full'];
const levelCls = (l: string) =>
  l === 'Full' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
  : l === 'View' ? 'bg-sky-50 text-sky-800 border-sky-200'
  : 'bg-slate-50 text-slate-400 border-slate-200';

export function AccessControlPage() {
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCell, setSavingCell] = useState('');

  function load() {
    setLoading(true);
    apiRequest<Matrix>('/api/portal/access/matrix')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load access matrix.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function setLevel(code: string, role: string, level: string) {
    const key = `${code}|${role}`;
    setSavingCell(key);
    // optimistic
    setData((d) => d && ({ ...d, objects: d.objects.map((o) => o.code === code ? { ...o, levels: { ...o.levels, [role]: level } } : o) }));
    try {
      await apiRequest('/api/portal/access', { method: 'PUT', body: JSON.stringify({ role, code, level }) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.');
      load(); // revert to server truth
    } finally {
      setSavingCell('');
    }
  }

  async function resetAll() {
    if (!window.confirm('Reset ALL roles to the built-in defaults? This clears every custom grant.')) return;
    try {
      await apiRequest('/api/portal/access/reset', { method: 'POST' });
      toast.success('Access reset to defaults.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reset.');
    }
  }

  // Group objects for readable sections.
  const groups = useMemo(() => {
    const out: { group: string; objects: Obj[] }[] = [];
    for (const o of data?.objects ?? []) {
      let g = out.find((x) => x.group === o.group);
      if (!g) { g = { group: o.group, objects: [] }; out.push(g); }
      g.objects.push(o);
    }
    return out;
  }, [data]);

  const roles = data?.roles ?? [];

  return (
    <div className="p-6 md:p-8">
      <PageHero
        title="Access Control"
        subtitle="What each role can see and do, per page"
        right={
          <button onClick={resetAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <RotateCcw className="size-3.5" /> Reset to defaults
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" /> None = hidden · View = read-only · Full = view + edit. SiteMaster always has Full.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-4 py-3 font-semibold sticky left-0 bg-white">Page</th>
                {roles.map((r) => <th key={r} className="px-3 py-3 font-semibold text-center">{ROLE_LABEL[r] ?? r}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.group}>
                  <tr className="bg-slate-50/70">
                    <td colSpan={roles.length + 1} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.group}</td>
                  </tr>
                  {g.objects.map((o) => (
                    <tr key={o.code} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-700 sticky left-0 bg-white whitespace-nowrap">{o.label}</td>
                      {roles.map((r) => {
                        const level = o.levels[r] ?? 'None';
                        if (r === 'sitemaster') {
                          return <td key={r} className="px-3 py-2 text-center"><span className="text-[11px] font-bold text-emerald-700">Full</span></td>;
                        }
                        const key = `${o.code}|${r}`;
                        return (
                          <td key={r} className="px-3 py-2 text-center">
                            <select
                              value={level}
                              disabled={savingCell === key}
                              onChange={(e) => setLevel(o.code, r, e.target.value)}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 ${levelCls(level)}`}
                            >
                              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
