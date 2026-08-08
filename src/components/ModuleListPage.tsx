import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Plus, Pencil,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from './PageHero';

// Generic, config-driven list page: filter bar → portal API endpoint that
// returns name-keyed proc rows → sortable, paginated grid with CSV export.

export type Row = Record<string, unknown>;

export interface ColumnDef {
  key: string;               // column name as returned by the proc
  label: string;
  format?: 'date' | 'money' | 'bool' | 'text';
  extra?: boolean;           // only visible with "More columns"
}

export interface FilterOption { value: string | number; label: string }

export interface FilterDef {
  param: string;             // query-string parameter name
  label: string;
  type: 'text' | 'select' | 'checkbox' | 'date';
  options?: FilterOption[];  // static options
  optionsKey?: string;       // key into the lookups map
  initial?: string | number | boolean;
  width?: string;
  /** false = shown and drives the cascade, but never sent to the API. Needed
   *  where the endpoint has no such parameter (registrations, sessions): there
   *  location scopes the semester list, and the semester scopes the rows. */
  submit?: boolean;
}

export interface ModuleConfig {
  title: string;
  subtitle?: string;
  endpoint: string;          // e.g. /api/portal/modules/registrations
  filters: FilterDef[];
  columns: ColumnDef[];
  idKey?: string;            // row key column
  lookups?: string;          // endpoint returning Record<string, FilterOption[]>
  renderCell?: (row: Row, col: ColumnDef) => React.ReactNode | undefined;
  /** Base route for add/edit forms (e.g. "/semesters"). Enables Add New + row Edit. */
  editBase?: string;
}

const PAGE_SIZE = 50;

// Location filters open scoped to the signed-in user's own location rather than
// to "all locations". Still editable — an explicit `initial` in the config wins.
const LOCATION_PARAMS = new Set(['locationId', 'locationIds']);
const SEMESTER_PARAMS = new Set(['semesterId', 'semesterIds']);

// Semester rows come straight off P_Semester_Select, which spells the key both ways.
function semesterId(r: Row): number {
  return Number(r.SemesterId ?? r.SemesterID ?? 0);
}

function fmt(v: unknown, format?: ColumnDef['format']): React.ReactNode {
  if (v == null || v === '') return '—';
  switch (format) {
    case 'date': {
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
    }
    case 'money':
      return Number(v).toLocaleString();
    case 'bool':
      return (
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full border ${
            v === true ? 'bg-emerald-500 border-emerald-700' : 'bg-red-500 border-red-700'
          }`}
        />
      );
    default:
      return String(v);
  }
}

export function ModuleListPage({ config }: { config: ModuleConfig }) {
  const user = getStoredUser();
  const navigate = useNavigate();
  const canEdit = !!config.editBase && config.idKey && user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;
  const [rows, setRows] = useState<Row[]>([]);
  const [lookups, setLookups] = useState<Record<string, FilterOption[]>>({});
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => {
    const v: Record<string, string | number | boolean> = {};
    for (const f of config.filters) {
      if (f.initial === undefined && LOCATION_PARAMS.has(f.param) && user?.primaryLocationId) {
        v[f.param] = user.primaryLocationId;
        continue;
      }
      v[f.param] = f.initial ?? (f.type === 'checkbox' ? false : f.type === 'select' ? 0 : '');
    }
    return v;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [moreCols, setMoreCols] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (config.lookups)
      apiRequest<Record<string, FilterOption[]>>(config.lookups).then(setLookups).catch(() => {});
  }, [config.lookups]);

  // ── Location → semester cascade ───────────────────────────────────────────
  // When a page filters by both, the semester list is reloaded for the chosen
  // location and reset to that location's current semester, so the grid always
  // opens on the semester actually running now.
  const locationParam = config.filters.find((f) => LOCATION_PARAMS.has(f.param))?.param;
  const semesterParam = config.filters.find((f) => SEMESTER_PARAMS.has(f.param))?.param;
  const cascades = !!locationParam && !!semesterParam;
  const [semOptions, setSemOptions] = useState<FilterOption[] | null>(null);

  // load() reads `values`; the cascade needs the freshest copy without re-firing.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const locValue = locationParam ? values[locationParam] : undefined;
  useEffect(() => {
    if (!cascades) return;
    apiRequest<{ semesters: Row[]; currentSemesterId: number }>(
      `/api/portal/schedule/semesters?locationId=${Number(locValue) || 0}`
    )
      .then((r) => {
        const opts = (r.semesters ?? [])
          .map((s) => ({ value: semesterId(s), label: String(s.SemesterName ?? '') }))
          .filter((o) => o.value > 0);
        setSemOptions(opts);
        const sem = r.currentSemesterId || Number(opts[0]?.value) || 0;
        const next = { ...valuesRef.current, [semesterParam!]: sem };
        setValues(next);
        load(next);
      })
      .catch(() => setSemOptions(null));
  }, [locValue, cascades]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildQuery(v: Record<string, string | number | boolean>): string {
    const q = new URLSearchParams();
    for (const f of config.filters) {
      if (f.submit === false) continue;
      const val = v[f.param];
      if (val === '' || val === false || val == null) continue;
      if (f.type === 'select' && Number(val) === 0 && typeof val === 'number') continue;
      q.set(f.param, String(val));
    }
    return q.toString();
  }

  function load(v = values) {
    setLoading(true);
    setError('');
    apiRequest<Row[]>(`${config.endpoint}${config.endpoint.includes('?') ? '&' : '?'}${buildQuery(v)}`)
      .then((data) => { setRows(data); setPage(0); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load data.'))
      .finally(() => setLoading(false));
  }

  // On cascading pages the semester effect above owns the first load, so we
  // don't fire a throwaway request against a not-yet-resolved semester.
  useEffect(() => { if (!cascades) load(); }, [config.endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortAsc]);

  const cols = config.columns.filter((c) => !c.extra || moreCols);
  const hasExtra = config.columns.some((c) => c.extra);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc((x) => !x);
    else { setSortKey(key); setSortAsc(true); }
  }

  function exportCsv() {
    const header = cols.map((c) => c.label).join(',');
    const lines = sorted.map((r) =>
      cols.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${config.title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const selectCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6">
      <PageHero
        compact
        title={config.title}
        subtitle={
          (loading ? 'Loading…' : `${sorted.length.toLocaleString()} rows`) +
          (config.subtitle ? ` · ${config.subtitle}` : '')
        }
        slide={config.title.length % 4}
        right={
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => navigate(`${config.editBase}/new`)}
                className="btn-grad flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-1.5"
              >
                <Plus className="size-3.5" /> Add New
              </button>
            )}
            {user?.canExport && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e5c97] hover:bg-slate-50 transition-colors"
              >
                <Download className="size-3.5" /> Export
              </button>
            )}
          </div>
        }
      />

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2"
      >
        {config.filters.map((f) => {
          const val = values[f.param];
          const set = (nv: string | number | boolean) =>
            setValues((old) => ({ ...old, [f.param]: nv }));
          switch (f.type) {
            case 'text':
              return (
                <div key={f.param} className="relative">
                  <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={String(val ?? '')}
                    onChange={(e) => set(e.target.value)}
                    placeholder={f.label}
                    className={`${f.width || 'w-48'} rounded-lg border border-slate-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40`}
                  />
                </div>
              );
            case 'date':
              return (
                <label key={f.param} className="flex items-center gap-1 text-xs text-slate-500">
                  {f.label}
                  <input type="date" value={String(val ?? '')} onChange={(e) => set(e.target.value)} className={selectCls} />
                </label>
              );
            case 'checkbox':
              return (
                <label key={f.param} className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
                  <input type="checkbox" checked={val === true} onChange={(e) => set(e.target.checked)} className="accent-[#1e5c97]" />
                  {f.label}
                </label>
              );
            case 'select': {
              const opts =
                (semOptions && f.param === semesterParam ? semOptions : null) ??
                f.options ?? lookups[f.optionsKey || ''] ?? [];
              return (
                <select
                  key={f.param}
                  value={String(val ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    set(typeof (opts[0]?.value) === 'number' ? Number(raw) : raw);
                  }}
                  className={`${selectCls} ${f.width || ''}`}
                >
                  <option value={typeof (opts[0]?.value) === 'number' ? 0 : ''}>{f.label}</option>
                  {opts.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
              );
            }
          }
        })}
        {hasExtra && (
          <label className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
            <input type="checkbox" checked={moreCols} onChange={(e) => setMoreCols(e.target.checked)} className="accent-[#1e5c97]" />
            More columns
          </label>
        )}
        <button type="submit" className="btn-grad ml-auto rounded-lg text-xs font-semibold px-4 py-1.5">
          Search
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
            <table className="tbl w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  {cols.map((c) => (
                    <th key={c.key + c.label} className="px-3 py-3 font-semibold">
                      <button type="button" onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-slate-600">
                        {c.label}
                        {sortKey === c.key
                          ? (sortAsc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)
                          : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    </th>
                  ))}
                  {canEdit && <th className="px-3 py-3 font-semibold text-right">Edit</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr
                    key={String(r[config.idKey || ''] ?? i)}
                    className="border-b border-slate-50 last:border-0"
                  >
                    {cols.map((c) => {
                      const custom = config.renderCell?.(r, c);
                      return (
                        <td key={c.key + c.label} className="px-3 py-2.5 text-slate-600 max-w-64 overflow-hidden text-ellipsis">
                          {custom !== undefined ? custom : fmt(r[c.key], c.format)}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => navigate(`${config.editBase}/${r[config.idKey!]}`)}
                          title="Edit"
                          className="text-[#1e5c97] hover:text-[#17497a]"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + (canEdit ? 1 : 0)} className="px-4 py-10 text-center text-slate-400">
                      No rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4 text-sm text-slate-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span>Page {page + 1} of {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
