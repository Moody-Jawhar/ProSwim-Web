// List pages for the legacy modules ported in this batch: expenses, private
// package types, payroll (timesheets / addons / coach attendance) and portal
// users. Each maps 1:1 to a legacy XxxList.aspx page via the new controllers.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, KeyRound, Calculator } from 'lucide-react';
import { ModuleListPage, type ModuleConfig } from '../components/ModuleListPage';
import { apiRequest } from '../api/portalApi';

const LOOKUPS = '/api/portal/modules/lookups';

const ADDON_TYPES = [
  { value: 'Bonus', label: 'Bonus' },
  { value: 'LongLoan', label: 'Long Loan' },
  { value: 'Penalty', label: 'Penalty' },
];

// ── Expenses (ExpensesList.aspx) ─────────────────────────────────────────────

const expenses: ModuleConfig = {
  title: 'Expenses',
  subtitle: 'Cash expenses, loans and refunds',
  endpoint: '/api/portal/finance/expenses',
  lookups: LOOKUPS,
  idKey: 'ExpenseID',
  editBase: '/expenses',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'semesterIds', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-36' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
  ],
  columns: [
    { key: 'SemesterName', label: 'Semester' },
    { key: 'ExpenseDate', label: 'Date', format: 'date' },
    { key: 'ExpenseAmount', label: 'Amount', format: 'money' },
    { key: 'ExpensePaidAmount', label: 'Paid', format: 'money' },
    { key: 'ExpensePaidCurrency', label: 'Curr' },
    { key: 'ExpenseType', label: 'Type' },
    { key: 'ExpenseRemarks_WCoach', label: 'Remarks' },
    { key: 'Serial', label: 'Delivery S/N', extra: true },
  ],
};

// ── Private package types (PrivatePackagesSettings.aspx) ─────────────────────

const packTypes: ModuleConfig = {
  title: 'Pack Types',
  subtitle: 'Private package types & pricing',
  endpoint: '/api/portal/admin/pack-types',
  lookups: LOOKUPS,
  idKey: 'PrivatePackageId',
  editBase: '/pack-types',
  filters: [
    { param: 'locationId', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-44' },
  ],
  columns: [
    { key: 'PrivatePackageName', label: 'Package Name' },
    { key: 'PrivatePackageCurrency', label: 'Curr' },
    { key: 'PrivatePackagePriceForOneStudent', label: 'For One', format: 'money' },
    { key: 'PrivatePackagePriceForTwoStudents', label: 'For Two', format: 'money' },
    { key: 'PrivatePackagePriceForThreeStudents', label: 'For Three', format: 'money' },
    { key: 'PrivatePackageSessionsCount', label: 'Sessions' },
    { key: 'PrivatePackageActive', label: 'Active', format: 'bool' },
  ],
};

// ── Timesheets (TimesheetsList.aspx) ─────────────────────────────────────────

const timesheets: ModuleConfig = {
  title: 'Timesheets',
  subtitle: 'Monthly payroll timesheets',
  endpoint: '/api/portal/payroll/timesheets',
  idKey: 'TimesheetID',
  editBase: '/payroll/timesheets',
  filters: [
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
  ],
  columns: [
    { key: 'TimesheetYr', label: 'Year' },
    { key: 'TimesheetMonth', label: 'Month' },
    { key: 'TimesheetStartDate', label: 'Start', format: 'date' },
    { key: 'TimesheetEndDate', label: 'End', format: 'date' },
    { key: 'TimesheetStatus', label: 'Status' },
    { key: 'TimesheetRemarks', label: 'Remarks' },
    { key: '_payroll', label: '' },
  ],
  renderCell: (row, col) => {
    if (col.key !== '_payroll') return undefined;
    return (
      <Link
        to={`/payroll/sheet/${row.TimesheetID}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs font-bold text-[#1e5c97] hover:underline"
      >
        <Calculator className="size-3.5" /> Payroll
      </Link>
    );
  },
};

// ── Addons (TimesheetsAddonsList.aspx) ───────────────────────────────────────

const addons: ModuleConfig = {
  title: 'Payroll Add-ons',
  subtitle: 'Bonuses, long loans and penalties',
  endpoint: '/api/portal/payroll/addons',
  lookups: LOOKUPS,
  idKey: 'AddonID',
  editBase: '/payroll/addons',
  filters: [
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'type', label: 'Type', type: 'select', options: ADDON_TYPES, width: 'max-w-32' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
    { param: 'byAddonDate', label: 'Addon Date', type: 'checkbox', initial: true },
    { param: 'byPaymentDate', label: 'Payment Date', type: 'checkbox', initial: true },
  ],
  columns: [
    { key: 'LocationIcon', label: 'Loc' },
    { key: 'AddonDate', label: 'Date', format: 'date' },
    { key: 'CoachFullName', label: 'Coach' },
    { key: 'AddonType', label: 'Type' },
    { key: 'AddonCurrency', label: 'Curr' },
    { key: 'AddonAmount', label: 'Amount', format: 'money' },
    { key: 'Pay1', label: 'Pay 1', format: 'money' },
    { key: 'Pay2', label: 'Pay 2', format: 'money' },
    { key: 'Pay3', label: 'Pay 3', format: 'money' },
  ],
};

// ── Coach attendance (CoachsAttendancesList.aspx) ────────────────────────────

const coachAttendance: ModuleConfig = {
  title: 'Coach Attendance',
  subtitle: 'Absences, lateness and deductions',
  endpoint: '/api/portal/payroll/coach-attendance',
  lookups: LOOKUPS,
  idKey: 'Coaches_Attendance_ID',
  editBase: '/payroll/coach-attendance',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-36' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
    { param: 'needApproval', label: 'Need Approval', type: 'checkbox' },
  ],
  columns: [
    { key: 'Coaches_Attendance_Date', label: 'Date', format: 'date' },
    { key: 'CoachFullName', label: 'Coach' },
    { key: 'LocationIcon', label: 'Loc' },
    { key: 'Coaches_Attendance_Absent', label: 'Absent', format: 'bool' },
    { key: 'Coaches_Attendance_Late', label: 'Late', format: 'bool' },
    { key: 'Coaches_Attendance_EarlyLeave', label: 'Early', format: 'bool' },
    { key: 'ReasonName', label: 'Reason' },
    { key: 'Coaches_Attendance_AbsentTime', label: 'Time' },
    { key: 'Coaches_Attendance_Approved', label: 'Approved', format: 'bool' },
    { key: 'Coaches_Attendance_Approvedby', label: 'By', extra: true },
    { key: 'Coaches_Attendance_Remarks', label: 'Remarks', extra: true },
    { key: 'Coaches_Attendance_AbsentDeduct', label: 'Deduct', extra: true },
    { key: 'Coaches_Attendance_AbsentDeductReason', label: 'Deduct Reason', extra: true },
  ],
};

// ── Portal users (UsersList.aspx) — passwords never leave the server ─────────

function ResetPasswordButton({ userId, name }: { userId: number; name: string }) {
  const [busy, setBusy] = useState(false);
  async function reset(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Reset the password for ${name}? A new temporary password will be generated.`)) return;
    setBusy(true);
    try {
      const r = await apiRequest<{ newPassword: string }>(`/api/portal/admin/users/${userId}/reset-password`, { method: 'POST' });
      window.alert(`New temporary password for ${name}:\n\n${r.newPassword}\n\nShare it now — it is not shown again.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={reset}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />} Reset
    </button>
  );
}

const users: ModuleConfig = {
  title: 'Users',
  subtitle: 'Portal user accounts & permissions',
  endpoint: '/api/portal/admin/users',
  idKey: 'UserID',
  editBase: '/users',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'deleted', label: 'Deleted', type: 'checkbox' },
  ],
  columns: [
    { key: 'UserFullName', label: 'Full Name' },
    { key: 'UserEmail', label: 'Email' },
    { key: 'UserPhoneNumber', label: 'Phone' },
    { key: 'UserType', label: 'Type' },
    { key: 'LocationNickName', label: 'Location' },
    { key: 'UserActive', label: 'Active', format: 'bool' },
    { key: 'UserLastLoginDate', label: 'Last Login', format: 'date' },
    { key: 'UserNumberofLogins', label: 'Logins', extra: true },
    { key: '_reset', label: '' },
  ],
  renderCell: (row, col) => {
    if (col.key !== '_reset') return undefined;
    return <ResetPasswordButton userId={Number(row.UserID)} name={String(row.UserFullName ?? '')} />;
  },
};

export const ExpensesListPage = () => <ModuleListPage config={expenses} />;
export const PackTypesPage = () => <ModuleListPage config={packTypes} />;
export const TimesheetsPage = () => <ModuleListPage config={timesheets} />;
export const AddonsListPage = () => <ModuleListPage config={addons} />;
export const CoachAttendancePage = () => <ModuleListPage config={coachAttendance} />;
export const UsersAdminPage = () => <ModuleListPage config={users} />;
