import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Wand2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

interface Variant { value: string; count: number }
interface Cluster { canonical: string; variants: Variant[]; totalStudents: number }
interface ClusterResponse {
  field: string;
  label: string;
  distinctBefore: number;
  distinctAfter: number;
  duplicateGroups: number;
  clusters: Cluster[];
}

const FIELDS = [
  { key: 'school', label: 'School' },
  { key: 'occupation', label: 'Occupations' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'nationality', label: 'Nationality' },
];

export function CleanupPage() {
  const user = getStoredUser();
  const canApply = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [field, setField] = useState('school');
  const [data, setData] = useState<ClusterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // per-cluster local state, keyed by index
  const [canon, setCanon] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<Record<number, Set<string>>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [applying, setApplying] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, number>>({});

  function load(f: string) {
    setLoading(true);
    setError('');
    setNotice('');
    setData(null);
    setCanon({}); setPicked({}); setOpen({}); setDone({});
    apiRequest<ClusterResponse>(`/api/portal/cleanup/clusters?field=${f}`)
      .then((d) => {
        setData(d);
        // default: every variant selected, canonical = suggested
        const c: Record<number, string> = {};
        const p: Record<number, Set<string>> = {};
        d.clusters.forEach((cl, i) => {
          c[i] = cl.canonical;
          p[i] = new Set(cl.variants.map((v) => v.value));
        });
        setCanon(c); setPicked(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load clusters.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(field); }, [field]);

  function toggleVariant(i: number, value: string) {
    setPicked((prev) => {
      const next = { ...prev };
      const s = new Set(next[i]);
      s.has(value) ? s.delete(value) : s.add(value);
      next[i] = s;
      return next;
    });
  }

  async function applyCluster(i: number) {
    const variants = [...(picked[i] ?? [])];
    const canonical = canon[i]?.trim();
    if (!canonical || variants.length < 2) return;
    setApplying(i);
    setError('');
    setNotice('');
    try {
      const res = await apiRequest<{ studentsUpdated: number }>('/api/portal/cleanup/apply', {
        method: 'POST',
        body: JSON.stringify({ field, canonical, variants }),
      });
      setDone((d) => ({ ...d, [i]: res.studentsUpdated }));
      setNotice(`Merged into "${canonical}" — ${res.studentsUpdated} student${res.studentsUpdated === 1 ? '' : 's'} updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <PageHero
        compact
        title="Data Cleanup"
        subtitle="Find and merge duplicate free-text values"
        slide={2}
        right={<Wand2 className="size-6 text-white/90" />}
      />

      {/* Field tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            onClick={() => setField(f.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              field === f.key ? 'btn-grad' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <Stat label="Distinct values" value={data.distinctBefore.toLocaleString()} />
            <Stat label="After merging" value={data.distinctAfter.toLocaleString()} accent />
            <Stat label="Duplicate groups" value={data.duplicateGroups.toLocaleString()} />
          </div>

          {data.clusters.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft py-14 text-center text-slate-400 text-sm">
              No duplicate groups found for {data.label.toLowerCase()}.
            </div>
          ) : (
            <div className="space-y-3">
              {data.clusters.map((cl, i) => {
                const isOpen = open[i] ?? false;
                const applied = done[i] != null;
                const selectedCount = picked[i]?.size ?? 0;
                return (
                  <div
                    key={i}
                    className={`bg-white rounded-2xl border shadow-soft overflow-hidden ${
                      applied ? 'border-emerald-200 opacity-70' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <button onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))} className="text-slate-400 hover:text-slate-600">
                        {isOpen ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            value={canon[i] ?? ''}
                            onChange={(e) => setCanon((c) => ({ ...c, [i]: e.target.value }))}
                            disabled={applied}
                            className="font-semibold text-slate-800 rounded-lg border border-slate-200 px-2.5 py-1 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 disabled:bg-slate-50"
                          />
                          <span className="text-xs text-slate-400">
                            {cl.variants.length} spellings · {cl.totalStudents.toLocaleString()} students
                          </span>
                        </div>
                        {!isOpen && (
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {cl.variants.map((v) => v.value).join(' · ')}
                          </p>
                        )}
                      </div>

                      {applied ? (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                          <Check className="size-4" /> {done[i]} updated
                        </span>
                      ) : canApply && (
                        <button
                          onClick={() => applyCluster(i)}
                          disabled={applying === i || selectedCount < 2 || !canon[i]?.trim()}
                          className="btn-grad rounded-lg text-xs font-semibold px-4 py-2 disabled:opacity-50"
                        >
                          {applying === i ? <Loader2 className="size-3.5 animate-spin" /> : `Merge ${selectedCount}`}
                        </button>
                      )}
                    </div>

                    {isOpen && !applied && (
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                          Select the spellings to merge (uncheck any that are actually a different value)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {cl.variants.map((v) => (
                            <label key={v.value} className="flex items-center gap-2 text-sm py-1 select-none">
                              <input
                                type="checkbox"
                                checked={picked[i]?.has(v.value) ?? false}
                                onChange={() => toggleVariant(i, v.value)}
                                className="accent-[#1e5c97]"
                              />
                              <button
                                type="button"
                                onClick={() => setCanon((c) => ({ ...c, [i]: v.value }))}
                                title="Use as the canonical spelling"
                                className="text-slate-700 hover:text-[#1e5c97] text-left"
                              >
                                {v.value}
                              </button>
                              <span className="text-xs text-slate-400">×{v.count}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums mt-0.5 ${accent ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
