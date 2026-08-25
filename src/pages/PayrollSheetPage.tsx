// Payroll sheet — port of TimeSheetPayroll.aspx. All money math happens in the
// stored procedures (rates × hours, salary %, net); this grid shows the
// computed columns, lets the SiteMaster edit hour counts / bonus / penalty /
// loans, toggle Paid / NoWork, and re-run the HR recalculation.

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw, Save, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const money = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

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

const EXTRA_EDITABLE = ['PayrollBonus', 'PayrollPenalty', 'PayrollLoansShort', 'PayrollLoansLong'];

export function PayrollSheetPage() {
  const { timesheetId } = useParams<{ timesheetId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, number>>>({});
  const [showNoWork, setShowNoWork] = useState(false);
  const [showZero, setShowZero] = useState(false);
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

  // Hide disciplines with zero hours across the sheet unless "show zero" is on.
  const visibleDisciplines = useMemo(
    () => DISCIPLINES.filter(([cnt]) => showZero || rows.some((r) => num(r, cnt) > 0)),
    [rows, showZero],
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
      window.alert(e instanceof Error ? e.message : 'Could not update the row.');
    }
  }

  async function saveAll() {
    const dirty = Object.entries(edits);
    if (dirty.length === 0) { setNotice('Nothing to save.'); return; }
    setBusy(true);
    setError('');
    try {
      for (const [idStr, fields] of dirty) {
        const id = Number(idStr);
        const row = rows.find((r) => num(r, 'PayrollID') === id);
        if (!row) continue;
        const body: Record<string, number> = {};
        for (const p of [
          'PayrollSalary', 'PayrollPrivateHr', 'PayrollPrivateHrCnt', 'PayrollTeamHr', 'PayrollTeamHrCnt',
          'PayrollSchoolHr', 'PayrollSchoolHrCnt', 'PayrollAquaBabyHr', 'PayrollAquaBabyHrCnt',
          'PayrollAquaGymHr', 'PayrollAquaGymHrCnt', 'PayrollPhysioHr', 'PayrollPhysioHrCnt',
          'PayrollMiscHr', 'PayrollMiscHrCnt', 'PayrollBonus', 'PayrollLoansShort', 'PayrollLoansLong',
          'PayrollPenalty', 'PayrollNetToPay',
        ])
          body[p] = fields[p] ?? num(row, p === 'PayrollNetToPay' ? 'PayrollNetToPAy' : p);
        await apiRequest(`/api/portal/payroll/rows/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      setNotice(`${dirty.length} row(s) saved — recalculating…`);
      load(true); // the procs recompute the totals
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the changes.');
    } finally {
      setBusy(false);
    }
  }

  // Footer totals per currency column.
  const totals = useMemo(() => {
    const sum = (field: string, curField: string, cur: string) =>
      rows.reduce((s, r) => (str(r, curField) === cur ? s + num(r, field) : s), 0);
    return {
      salaryLB: sum('PayrollSalary', 'PayrollSalaryCurrency', 'LBP'),
      salaryUS: sum('PayrollSalary', 'PayrollSalaryCurrency', 'USD'),
      netLB: sum('PayrollNetToPAy', 'PayrollSalaryCurrency', 'LBP'),
      netUS: sum('PayrollNetToPAy', 'PayrollSalaryCurrency', 'USD'),
      netBalLB: rows.reduce((s, r) => (str(r, 'PayrollSalaryCurrency') === 'LBP' && r.PayrollIndivPaid !== true ? s + num(r, 'PayrollNetToPAy') : s), 0),
      netBalUS: rows.reduce((s, r) => (str(r, 'PayrollSalaryCurrency') === 'USD' && r.PayrollIndivPaid !== true ? s + num(r, 'PayrollNetToPAy') : s), 0),
    };
  }, [rows]);

  const cellInput = 'w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1e5c97]/50';

  return (
    <div className="p-6 md:p-8">
      <Link to="/payroll/timesheets" className="inline-flex items-center gap-1 text-sm text-[#1e5c97] hover:underline mb-2">
        <ArrowLeft className="size-4" /> Timesheets
      </Link>
      <PageHero title={`Payroll — ${title}`} subtitle={`${rows.length} coach(es)`} slide={2} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input type="checkbox" checked={showNoWork} onChange={(e) => setShowNoWork(e.target.checked)} className="accent-[#1e5c97]" />
          Show "No Work"
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="accent-[#1e5c97]" />
          Show zero columns
        </label>
        <div className="flex-1" />
        <button onClick={() => load(true)} disabled={busy || loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#1e5c97]/30 text-[#1e5c97] text-sm font-semibold px-4 py-1.5 hover:bg-[#e8f0f8] disabled:opacity-50">
          <RefreshCw className="size-4" /> Re-Calculate from HR
        </button>
        <button onClick={saveAll} disabled={busy || Object.keys(edits).length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Changes {Object.keys(edits).length > 0 && `(${Object.keys(edits).length})`}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-x-auto">
          <table className="tbl w-full text-xs whitespace-nowrap">
            <thead>
              <tr>
                <th className="text-left">Loc</th>
                <th className="text-left">Coach</th>
                <th className="text-right">Salary</th>
                {visibleDisciplines.map(([cnt, , label]) => (
                  <th key={cnt} colSpan={2} className="text-center">{label} (hrs · total)</th>
                ))}
                <th className="text-right">Bonus</th>
                <th className="text-right">Penalty</th>
                <th className="text-right">Advance</th>
                <th className="text-right">Loans</th>
                <th className="text-right">SubTotal</th>
                <th className="text-right">Net2Pay</th>
                <th className="text-center">Paid</th>
                <th className="text-center">NoWork</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = num(r, 'PayrollID');
                const paid = r.PayrollIndivPaid === true;
                const noWork = r.PayrollIndivNoWork === true;
                const salCur = str(r, 'PayrollSalaryCurrency');
                return (
                  <tr key={id} className={noWork ? 'bg-red-50' : paid ? 'bg-emerald-50' : ''}>
                    <td>{str(r, 'LocationIcon')}</td>
                    <td className="font-semibold">{str(r, 'CoachFullName')}</td>
                    <td className="text-right">{salCur} {money(num(r, 'PayrollSalary'))}</td>
                    {visibleDisciplines.map(([cnt, total]) => (
                      <React.Fragment key={cnt}>
                        <td className="text-right">
                          <input type="number" value={val(r, cnt)}
                            onChange={(e) => edit(id, cnt, Number(e.target.value))}
                            className={cellInput} style={{ width: 56 }} />
                        </td>
                        <td className="text-right text-slate-500">{money(num(r, total))}</td>
                      </React.Fragment>
                    ))}
                    {EXTRA_EDITABLE.map((f) => (
                      <td key={f} className="text-right">
                        <input type="number" value={val(r, f)}
                          onChange={(e) => edit(id, f, Number(e.target.value))}
                          className={cellInput} />
                      </td>
                    ))}
                    <td className="text-right font-semibold">{money(num(r, 'SubTotal'))}</td>
                    <td className="text-right font-extrabold">{salCur} {money(num(r, 'PayrollNetToPAy'))}</td>
                    <td className="text-center">
                      <input type="checkbox" checked={paid} onChange={(e) => toggle(r, 'paid', e.target.checked)} className="accent-emerald-600" />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={noWork} onChange={(e) => toggle(r, 'nowork', e.target.checked)} className="accent-red-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-slate-50">
                <td colSpan={2}>Totals</td>
                <td className="text-right">
                  {totals.salaryLB > 0 && <div>LB {money(totals.salaryLB)}</div>}
                  {totals.salaryUS > 0 && <div>US {money(totals.salaryUS)}</div>}
                </td>
                <td colSpan={visibleDisciplines.length * 2 + EXTRA_EDITABLE.length + 1} />
                <td className="text-right">
                  {totals.netBalLB > 0 && <div className="text-red-600">Bal LB {money(totals.netBalLB)}</div>}
                  {totals.netBalUS > 0 && <div className="text-red-600">Bal US {money(totals.netBalUS)}</div>}
                  {totals.netLB > 0 && <div>LB {money(totals.netLB)}</div>}
                  {totals.netUS > 0 && <div>US {money(totals.netUS)}</div>}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
