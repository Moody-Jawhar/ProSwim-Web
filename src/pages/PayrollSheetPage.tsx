// Payroll sheet, port of TimeSheetPayroll.aspx. All money math happens in the
// stored procedures (rates × hours, salary %, net); this grid shows the
// computed columns, lets the SiteMaster edit hour counts / bonus / penalty /
// loans, toggle Paid / NoWork, and re-run the HR recalculation.
//
// Two ways to work: the overview grid (location filter + full column totals),
// and a per-coach payroll card (click a coach) to review and edit one coach at
// a time in a clean layout.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw, Save, Download, X, Check, History, UserCog, ChevronRight, SquarePen } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';
import { toast } from '../components/Toast';

type Row = Record<string, unknown>;
type Cur = 'USD' | 'LBP';

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const money = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const curOf = (r: Row): Cur => (str(r, 'PayrollSalaryCurrency') === 'LBP' ? 'LBP' : 'USD');
// Compact coach name: first 2 letters of the first name, then the rest as-is.
// "Ibrahim Hassan" -> "Ib Hassan", "Ahmad Al Zaybak" -> "Ah Al Zaybak".
const shortName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length <= 1 ? full : [parts[0].slice(0, 2), ...parts.slice(1)].join(' ');
};

// [countField, totalField, label]
const DISCIPLINES: [string, string, string][] = [
  ['PayrollPrivateHrCnt', 'PayrollPrivateTotal', 'Private'],
  ['PayrollTeamHrCnt', 'PayrollTeamTotal', 'Team'],
  ['PayrollSchoolHrCnt', 'PayrollSchoolTotal', 'School'],
  ['PayrollAquaBabyHrCnt', 'PayrollAquaBabyTotal', 'AqBaby'],
  ['PayrollAquaGymHrCnt', 'PayrollAquaGymTotal', 'AqGym'],
  ['PayrollPhysioHrCnt', 'PayrollPhysioTotal', 'Physio'],
  ['PayrollMiscHrCnt', 'PayrollMiscTotal', 'Misc'],
];
// system-detected hours field per discipline (shown read-only in the card)
const SYS_HR: Record<string, string> = {
  PayrollPrivateHrCnt: 'PayrollPrivateHr', PayrollTeamHrCnt: 'PayrollTeamHr',
  PayrollSchoolHrCnt: 'PayrollSchoolHr', PayrollAquaBabyHrCnt: 'PayrollAquaBabyHr',
  PayrollAquaGymHrCnt: 'PayrollAquaGymHr', PayrollPhysioHrCnt: 'PayrollPhysioHr',
  PayrollMiscHrCnt: 'PayrollMiscHr',
};

// label, field, sign(- means it reduces net) for the adjustment columns
const ADJUSTMENTS: [string, string, 1 | -1][] = [
  ['Bonus', 'PayrollBonus', 1],
  ['Penalty', 'PayrollPenalty', -1],
  ['Advance', 'PayrollLoansShort', -1],
  ['Loans', 'PayrollLoansLong', -1],
];

export function PayrollSheetPage() {
  const { timesheetId } = useParams<{ timesheetId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, number>>>({});
  const [showNoWork, setShowNoWork] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const [loc, setLoc] = useState(''); // '' = all locations
  const [openId, setOpenId] = useState<number | null>(null);
  const [startHist, setStartHist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load(refresh = false) {
    setLoading(true);
    setError('');
    const q = new URLSearchParams();
    if (showNoWork) q.set('showNoWork', 'true');
    if (refresh) q.set('refresh', 'true');
    apiRequest<Row[]>(`/api/portal/payroll/sheet/${timesheetId}?${q}`)
      .then((data) => { setRows(data); setEdits({}); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the payroll.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => load(), [timesheetId, showNoWork]); // eslint-disable-line react-hooks/exhaustive-deps

  // Location filter options built from the loaded sheet.
  const locations = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) { const n = str(r, 'LocationNickName'); if (n) seen.add(n); }
    return [...seen].sort();
  }, [rows]);

  const viewRows = useMemo(
    () => (loc ? rows.filter((r) => str(r, 'LocationNickName') === loc) : rows),
    [rows, loc],
  );

  // Hide disciplines with zero hours across the view unless "show zero" is on.
  const visibleDisciplines = useMemo(
    () => DISCIPLINES.filter(([cnt]) => showZero || viewRows.some((r) => num(r, cnt) > 0)),
    [viewRows, showZero],
  );

  const title = rows.length > 0 ? str(rows[0], 'TimesheetTitle') : `Timesheet #${timesheetId}`;

  function edit(payrollId: number, field: string, value: number) {
    setEdits((prev) => ({ ...prev, [payrollId]: { ...prev[payrollId], [field]: value } }));
    setNotice('');
  }
  function val(r: Row, field: string): number {
    const id = num(r, 'PayrollID');
    return edits[id]?.[field] ?? num(r, field);
  }

  async function toggle(r: Row, kind: 'paid' | 'nowork', on: boolean) {
    const id = num(r, 'PayrollID');
    try {
      await apiRequest(`/api/portal/payroll/rows/${id}/${kind}`, {
        method: 'POST',
        body: JSON.stringify(kind === 'paid' ? { paid: on } : { noWork: on }),
      });
      setRows((prev) => prev.map((row) =>
        num(row, 'PayrollID') === id
          ? { ...row, [kind === 'paid' ? 'PayrollIndivPaid' : 'PayrollIndivNoWork']: on }
          : row));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the row.');
    }
  }

  // Persist one row from its pending edits (used by both the card and Save Changes).
  async function saveRow(id: number) {
    const row = rows.find((r) => num(r, 'PayrollID') === id);
    if (!row) return;
    const fields = edits[id] ?? {};
    const body: Record<string, number> = {};
    for (const p of [
      'PayrollSalary', 'PayrollPrivateHr', 'PayrollPrivateHrCnt', 'PayrollTeamHr', 'PayrollTeamHrCnt',
      'PayrollSchoolHr', 'PayrollSchoolHrCnt', 'PayrollAquaBabyHr', 'PayrollAquaBabyHrCnt',
      'PayrollAquaGymHr', 'PayrollAquaGymHrCnt', 'PayrollPhysioHr', 'PayrollPhysioHrCnt',
      'PayrollMiscHr', 'PayrollMiscHrCnt', 'PayrollBonus', 'PayrollLoansShort', 'PayrollLoansLong',
      'PayrollPenalty', 'PayrollNetToPay',
    ])
      body[p] = fields[p] ?? num(row, p);
    await apiRequest(`/api/portal/payroll/rows/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async function saveAll() {
    const dirty = Object.keys(edits).map(Number);
    if (dirty.length === 0) { setNotice('Nothing to save.'); return; }
    setBusy(true);
    setError('');
    try {
      for (const id of dirty) await saveRow(id);
      setNotice(`${dirty.length} row(s) saved, recalculating…`);
      toast.success('Payroll saved.');
      load(true); // the procs recompute the totals
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save the changes.';
      setError(m); toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  // Save just one coach (from the card), then close & recalc.
  async function saveOne(id: number) {
    setBusy(true);
    try {
      await saveRow(id);
      toast.success('Coach payroll saved.');
      setOpenId(null);
      load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  // Per-column totals, split by currency (only nonzero currencies render).
  const sumCur = (field: string) => {
    const o: Record<Cur, number> = { USD: 0, LBP: 0 };
    for (const r of viewRows) o[curOf(r)] += num(r, field);
    return o;
  };
  const totals = useMemo(() => {
    const net = sumCur('PayrollNetToPay');
    const paid: Record<Cur, number> = { USD: 0, LBP: 0 };
    for (const r of viewRows) if (r.PayrollIndivPaid === true) paid[curOf(r)] += num(r, 'PayrollNetToPay');
    return {
      salary: sumCur('PayrollSalary'),
      disc: Object.fromEntries(visibleDisciplines.map(([, t]) => [t, sumCur(t)])),
      bonus: sumCur('PayrollBonus'),
      penalty: sumCur('PayrollPenalty'),
      advance: sumCur('PayrollLoansShort'),
      loans: sumCur('PayrollLoansLong'),
      subtotal: sumCur('SubTotal'),
      net,
      paid,
      balance: { USD: net.USD - paid.USD, LBP: net.LBP - paid.LBP } as Record<Cur, number>,
    };
  }, [viewRows, visibleDisciplines]); // eslint-disable-line react-hooks/exhaustive-deps

  const user = getStoredUser();
  const canEdit = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;
  const canExport = user?.canExport;
  const dirtyCount = Object.keys(edits).length;

  function exportCsv() {
    const cols: [string, (r: Row) => string][] = [
      ['Location', (r) => str(r, 'LocationNickName')],
      ['Coach', (r) => str(r, 'CoachFullName')],
      ['Currency', (r) => curOf(r)],
      ['Salary', (r) => String(num(r, 'PayrollSalary'))],
      ...DISCIPLINES.map(([, total, label]) =>
        [label, (r: Row) => String(num(r, total))] as [string, (r: Row) => string]),
      ['Bonus', (r) => String(num(r, 'PayrollBonus'))],
      ['Penalty', (r) => String(num(r, 'PayrollPenalty'))],
      ['Advance', (r) => String(num(r, 'PayrollLoansShort'))],
      ['Loans', (r) => String(num(r, 'PayrollLoansLong'))],
      ['SubTotal', (r) => String(num(r, 'SubTotal'))],
      ['Net2Pay', (r) => String(num(r, 'PayrollNetToPay'))],
      ['Paid', (r) => (r.PayrollIndivPaid === true ? 'Yes' : 'No')],
    ];
    const header = cols.map((c) => c[0]).join(',');
    const lines = viewRows.map((r) => cols.map((c) => `"${c[1](r).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${timesheetId}${loc ? '-' + loc : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── shared cell styles ──────────────────────────────────────────────────
  const numInput =
    'w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 disabled:bg-slate-50';
  const CurStack = ({ v, cls = '' }: { v: Record<Cur, number>; cls?: string }) => (
    <div className={`leading-tight tabular-nums ${cls}`}>
      {v.USD ? <div>{money(v.USD)}</div> : null}
      {v.LBP ? <div>{money(v.LBP)}</div> : null}
      {!v.USD && !v.LBP ? <span className="text-slate-300">0</span> : null}
    </div>
  );

  const openRow = openId != null ? rows.find((r) => num(r, 'PayrollID') === openId) : undefined;

  return (
    <div className="p-6 md:p-8">
      <SmartBack label="Timesheets" fallback="/payroll/timesheets" />
      <PageHero title={`Payroll: ${title}`} subtitle={`${viewRows.length} coach(es)${loc ? ` · ${loc}` : ''}`} slide={2} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="font-semibold text-slate-500">Location</span>
          <select value={loc} onChange={(e) => setLoc(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input type="checkbox" checked={showNoWork} onChange={(e) => setShowNoWork(e.target.checked)} className="accent-[#1e5c97]" />
          Show "No Work"
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="accent-[#1e5c97]" />
          Show zero columns
        </label>
        <div className="flex-1" />
        {canExport && viewRows.length > 0 && (
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-[#1e5c97] text-sm font-semibold px-4 py-1.5 hover:bg-slate-50">
            <Download className="size-4" /> Export
          </button>
        )}
        <button onClick={() => load(true)} disabled={busy || loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#1e5c97]/30 text-[#1e5c97] text-sm font-semibold px-4 py-1.5 hover:bg-[#e8f0f8] disabled:opacity-50">
          <RefreshCw className="size-4" /> Re-Calculate from HR
        </button>
        {canEdit && (
          <button onClick={saveAll} disabled={busy || dirtyCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes {dirtyCount > 0 && `(${dirtyCount})`}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}
      <p className="text-xs text-slate-400 mb-3">Tip: click a coach's name to open their payroll card and edit it.</p>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b-2 border-slate-200 bg-slate-50">
                <th className="px-1.5 py-2 text-center font-semibold"></th>
                <th className="px-2 py-2 text-left font-semibold">Loc</th>
                <th className="px-2 py-2 text-left font-semibold">Coach</th>
                <th className="px-2 py-2 text-right font-semibold">Salary</th>
                {visibleDisciplines.map(([cnt, , label]) => (
                  <th key={cnt} className="px-1.5 py-2 text-center font-semibold border-l border-slate-200">{label}</th>
                ))}
                <th className="px-1.5 py-2 text-right font-semibold border-l border-slate-200">Bonus</th>
                <th className="px-1.5 py-2 text-right font-semibold">Penalty</th>
                <th className="px-1.5 py-2 text-right font-semibold">Advance</th>
                <th className="px-1.5 py-2 text-right font-semibold">Loans</th>
                <th className="px-2 py-2 text-right font-semibold border-l border-slate-200">SubTotal</th>
                <th className="px-2 py-2 text-right font-semibold">Net2Pay</th>
                <th className="px-1.5 py-2 text-center font-semibold">Paid</th>
                <th className="px-1.5 py-2 text-center font-semibold">NoWork</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map((r) => {
                const id = num(r, 'PayrollID');
                const paid = r.PayrollIndivPaid === true;
                const noWork = r.PayrollIndivNoWork === true;
                const cur = curOf(r);
                return (
                  <tr key={id} className={`border-b border-slate-100 ${noWork ? 'bg-rose-50/60' : paid ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-1.5 py-1">
                      <div className="flex items-center justify-center gap-0.5">
                        <button title="Edit this payroll" onClick={() => { setStartHist(false); setOpenId(id); }}
                          className="rounded-md p-1 text-[#1e5c97] hover:bg-[#e8f0f8]"><SquarePen className="size-4" /></button>
                        <button title="Payroll history" onClick={() => { setStartHist(true); setOpenId(id); }}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><History className="size-4" /></button>
                        <Link title="Coach file & HR rate" to={`/coaches/${num(r, 'CoachID')}`}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><UserCog className="size-4" /></Link>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-slate-500">{str(r, 'LocationIcon') || str(r, 'LocationNickName')}</td>
                    <td className="px-2 py-1">
                      <Link to={`/coaches/${num(r, 'CoachID')}`} title={str(r, 'CoachFullName')}
                        className="font-semibold text-[#1e5c97] hover:underline">{shortName(str(r, 'CoachFullName'))}</Link>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums font-medium bg-emerald-50/40">{money(num(r, 'PayrollSalary'))}</td>
                    {visibleDisciplines.map(([cnt, total]) => (
                      <td key={cnt} className="px-1.5 py-1 border-l border-slate-100 bg-sky-50/40">
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} disabled={!canEdit} value={val(r, cnt)}
                            onChange={(e) => edit(id, cnt, Number(e.target.value))}
                            className="w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 disabled:bg-slate-50" />
                          <span className="text-xs tabular-nums text-slate-500">{money(num(r, total))}</span>
                        </div>
                      </td>
                    ))}
                    {ADJUSTMENTS.map(([, f, sign]) => (
                      <td key={f} className={`px-1.5 py-1 text-right ${f === 'PayrollBonus' ? 'border-l border-slate-100' : ''} ${sign < 0 ? 'bg-rose-50/50' : 'bg-emerald-50/40'}`}>
                        <input type="number" disabled={!canEdit} value={val(r, f)}
                          onChange={(e) => edit(id, f, Number(e.target.value))}
                          className={`${numInput} ${sign < 0 ? 'text-rose-700' : 'text-emerald-700'}`} />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right tabular-nums font-semibold bg-slate-50 border-l border-slate-100">{money(num(r, 'SubTotal'))}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-extrabold bg-amber-50/70">{cur === 'USD' ? '$' : 'LL'} {money(num(r, 'PayrollNetToPay'))}</td>
                    <td className="px-1.5 py-1 text-center">
                      <input type="checkbox" checked={paid} disabled={!canEdit} onChange={(e) => toggle(r, 'paid', e.target.checked)} className="size-4 accent-emerald-600" />
                    </td>
                    <td className="px-1.5 py-1 text-center">
                      <input type="checkbox" checked={noWork} disabled={!canEdit} onChange={(e) => toggle(r, 'nowork', e.target.checked)} className="size-4 accent-rose-500" />
                    </td>
                  </tr>
                );
              })}
              {viewRows.length === 0 && (
                <tr><td colSpan={visibleDisciplines.length + 12} className="px-4 py-10 text-center text-slate-400">No payroll rows.</td></tr>
              )}
            </tbody>
            {viewRows.length > 0 && (
              <tfoot>
                <tr className="text-sm bg-slate-100 border-t-2 border-slate-300">
                  <td />
                  <td className="px-2 py-2 font-bold text-slate-600" colSpan={2}>Totals</td>
                  <td className="px-2 py-2 text-right font-bold"><CurStack v={totals.salary} /></td>
                  {visibleDisciplines.map(([cnt, total]) => (
                    <td key={cnt} className="px-1.5 py-2 text-right font-semibold text-slate-600 border-l border-slate-200"><CurStack v={totals.disc[total]} /></td>
                  ))}
                  <td className="px-1.5 py-2 text-right font-semibold text-emerald-700 border-l border-slate-200"><CurStack v={totals.bonus} /></td>
                  <td className="px-1.5 py-2 text-right font-semibold text-rose-700"><CurStack v={totals.penalty} /></td>
                  <td className="px-1.5 py-2 text-right font-semibold text-rose-700"><CurStack v={totals.advance} /></td>
                  <td className="px-1.5 py-2 text-right font-semibold text-rose-700"><CurStack v={totals.loans} /></td>
                  <td className="px-2 py-2 text-right font-bold border-l border-slate-200"><CurStack v={totals.subtotal} /></td>
                  <td className="px-2 py-2 text-right font-bold">
                    <CurStack v={totals.net} />
                    <div className="mt-1 border-t border-slate-300 pt-1 text-[11px] font-semibold">
                      <div className="text-emerald-700">Paid {money(totals.paid.USD + totals.paid.LBP)}</div>
                      <div className="text-rose-600">Bal {money(totals.balance.USD + totals.balance.LBP)}</div>
                    </div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {openRow && (
        <CoachCard
          row={openRow}
          canEdit={canEdit}
          busy={busy}
          startWithHistory={startHist}
          currentTimesheetId={Number(timesheetId)}
          val={val}
          edit={edit}
          onToggle={toggle}
          onSave={() => saveOne(num(openRow, 'PayrollID'))}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ── Per-coach payroll card (modal): review + edit one coach cleanly ──────────
function CoachCard({
  row, canEdit, busy, startWithHistory, currentTimesheetId, val, edit, onToggle, onSave, onClose,
}: {
  row: Row; canEdit: boolean; busy: boolean;
  startWithHistory?: boolean; currentTimesheetId?: number;
  val: (r: Row, f: string) => number;
  edit: (id: number, f: string, v: number) => void;
  onToggle: (r: Row, kind: 'paid' | 'nowork', on: boolean) => void;
  onSave: () => void; onClose: () => void;
}) {
  const id = num(row, 'PayrollID');
  const coachId = num(row, 'CoachID');
  const cur = curOf(row);
  const sym = cur === 'USD' ? '$' : 'LL';
  const paid = row.PayrollIndivPaid === true;
  const noWork = row.PayrollIndivNoWork === true;

  const box = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 disabled:bg-slate-50';
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';

  const [showHist, setShowHist] = useState(!!startWithHistory);
  const [hist, setHist] = useState<Row[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    if (!showHist || hist || histLoading || !coachId) return;
    setHistLoading(true);
    apiRequest<Row[]>(`/api/portal/payroll/coach-history/${coachId}`)
      .then((d) => setHist(Array.isArray(d) ? d : []))
      .catch(() => setHist([]))
      .finally(() => setHistLoading(false));
  }, [showHist, coachId]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkBtn = 'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#e8f0f8] px-2.5 py-0.5 text-xs font-bold text-[#1e5c97]">
                <History className="size-3" /> {str(row, 'TimesheetTitle') || (currentTimesheetId ? `Timesheet #${currentTimesheetId}` : 'Payroll')}
              </div>
              <h2 className="text-lg font-bold text-slate-800">{str(row, 'CoachFullName')}</h2>
              <p className="text-sm text-slate-500">{str(row, 'LocationNickName')} · paid in {cur}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
          </div>
          {/* quick links */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/coaches/${coachId}`} onClick={onClose}
              className={`${linkBtn} border-slate-200 text-[#1e5c97] hover:bg-[#e8f0f8]`}>
              <UserCog className="size-3.5" /> Edit coach file &amp; HR rate
            </Link>
            <button onClick={() => setShowHist((s) => !s)}
              className={`${linkBtn} ${showHist ? 'border-[#1e5c97] bg-[#e8f0f8] text-[#1e5c97]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <History className="size-3.5" /> All payrolls
            </button>
          </div>
        </div>

        {/* history panel */}
        {showHist && (
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <p className={label + ' mb-2'}>Payroll history</p>
            {histLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" /> Loading…</div>
            ) : !hist || hist.length === 0 ? (
              <p className="text-sm text-slate-400">No past payrolls found.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
                {hist.map((h) => {
                  const hts = num(h, 'TimesheetID');
                  const hcur = curOf(h);
                  const isCurrent = hts === currentTimesheetId;
                  return (
                    <Link key={num(h, 'PayrollID')} to={`/payroll/sheet/${hts}`} onClick={onClose}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        {str(h, 'TimesheetTitle') || `#${hts}`}
                        {isCurrent && <span className="rounded bg-[#e8f0f8] px-1.5 py-0.5 text-[10px] font-bold text-[#1e5c97]">current</span>}
                      </span>
                      <span className="flex items-center gap-3 tabular-nums">
                        <span className={h.PayrollIndivPaid === true ? 'text-emerald-600' : 'text-rose-500'}>
                          {h.PayrollIndivPaid === true ? 'Paid' : 'Unpaid'}
                        </span>
                        <span className="font-bold text-slate-800">{hcur === 'USD' ? '$' : 'LL'} {money(num(h, 'PayrollNetToPay'))}</span>
                        <ChevronRight className="size-4 text-slate-300" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">Click a month to open that payroll sheet, where you can edit it.</p>
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* salary */}
          <div className="flex items-center gap-3">
            <label className={label + ' shrink-0'}>Salary ({sym})</label>
            <input type="number" disabled={!canEdit} value={val(row, 'PayrollSalary')}
              onChange={(e) => edit(id, 'PayrollSalary', Number(e.target.value))} className={box + ' max-w-[160px]'} />
          </div>

          {/* disciplines */}
          <div>
            <p className={label + ' mb-2'}>Hours</p>
            {/* column header */}
            <div className="grid grid-cols-12 items-center gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <span className="col-span-3">Discipline</span>
              <span className="col-span-3 text-right">System</span>
              <span className="col-span-3 text-right">Counted</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {DISCIPLINES.map(([cnt, total, dl]) => (
                <div key={cnt} className="grid grid-cols-12 items-center gap-2 px-3 py-0.5 odd:bg-slate-50/60">
                  <span className="col-span-3 text-sm font-medium text-slate-700">{dl}</span>
                  <span className="col-span-3 text-right text-sm text-slate-400 tabular-nums" title="System-detected hours">{money(num(row, SYS_HR[cnt]))}</span>
                  <div className="col-span-3">
                    <input type="number" min={0} disabled={!canEdit} value={val(row, cnt)}
                      onChange={(e) => edit(id, cnt, Number(e.target.value))}
                      className="w-full rounded-md border border-sky-200 bg-sky-50/50 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 disabled:bg-slate-50" />
                  </div>
                  <span className="col-span-3 text-right text-sm font-semibold text-slate-600 tabular-nums">{sym} {money(num(row, total))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* adjustments */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ADJUSTMENTS.map(([al, f, sign]) => (
              <div key={f}>
                <label className={label}>{al}{sign < 0 ? ' −' : ' +'}</label>
                <input type="number" disabled={!canEdit} value={val(row, f)}
                  onChange={(e) => edit(id, f, Number(e.target.value))}
                  className={`${box} mt-1 ${sign < 0 ? 'text-rose-700' : 'text-emerald-700'}`} />
              </div>
            ))}
          </div>

          {/* summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#e8f0f8] px-4 py-2.5">
            <div>
              <p className={label}>SubTotal</p>
              <p className="text-base font-bold text-slate-700 tabular-nums">{sym} {money(num(row, 'SubTotal'))}</p>
            </div>
            <div className="text-right">
              <p className={label}>Net to Pay</p>
              <p className="text-xl font-extrabold text-[#1e5c97] tabular-nums">{sym} {money(num(row, 'PayrollNetToPay'))}</p>
            </div>
          </div>

          {/* toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 select-none">
              <input type="checkbox" checked={paid} disabled={!canEdit} onChange={(e) => onToggle(row, 'paid', e.target.checked)} className="size-4 accent-emerald-600" />
              Paid
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 select-none">
              <input type="checkbox" checked={noWork} disabled={!canEdit} onChange={(e) => onToggle(row, 'nowork', e.target.checked)} className="size-4 accent-rose-500" />
              No Work this month
            </label>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3">
          <p className="mr-auto text-xs text-slate-400">Saving re-runs the HR recalculation for updated totals.</p>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
          {canEdit && (
            <button onClick={onSave} disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] px-5 py-2 text-sm font-semibold text-white hover:bg-[#17497a] disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
