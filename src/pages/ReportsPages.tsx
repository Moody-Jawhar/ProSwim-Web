// Financial / operational reports, ported from the legacy Reports*.aspx pages.
// All read-only, super-user only (the API gates them). Each config points at a
// /api/portal/modules/reports/* endpoint that calls the same P_Stats_* proc the
// WebForms page used.

import { ModuleListPage, type ModuleConfig, type FilterOption } from '../components/ModuleListPage';

const LOOKUPS = '/api/portal/modules/lookups';

// Year picker: current year back to 2018 (data starts well within that range).
const YEARS: FilterOption[] = (() => {
  const now = new Date().getFullYear();
  const out: FilterOption[] = [];
  for (let y = now; y >= 2018; y--) out.push({ value: y, label: String(y) });
  return out;
})();
const CURRENT_YEAR = new Date().getFullYear();

const REPORT_TYPES: FilterOption[] = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Daily', label: 'Daily' },
];

// ── Reports By Month (ReportsByMonth.aspx → P_Stats_Activity_ByMonth) ─────────
const byMonth: ModuleConfig = {
  title: 'Reports · By Month',
  subtitle: 'Group & private income vs. salaries and expenses',
  endpoint: '/api/portal/modules/reports/by-month',
  lookups: LOOKUPS,
  idKey: 'Mnth',
  filters: [
    { param: 'year', label: 'Year', type: 'select', options: YEARS, initial: CURRENT_YEAR },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', initial: 0, width: 'max-w-40' },
  ],
  columns: [
    { key: 'Title', label: 'Month' },
    { key: 'GrpPayments', label: 'Group', format: 'money' },
    { key: 'PrvPayments', label: 'Private', format: 'money' },
    { key: 'TotalSalaries', label: 'Salaries', format: 'money' },
    { key: 'TotalExpenses', label: 'Expenses', format: 'money' },
    { key: 'TotalMainExpenses', label: 'M-Expenses', format: 'money' },
    { key: 'TotalNet', label: 'Net', format: 'money' },
  ],
};

// ── Reports By Private (ReportsByPrivate.aspx → P_Stats_Activity_ByMonth) ─────
const byPrivate: ModuleConfig = {
  title: 'Reports · Private Sessions',
  subtitle: 'Private packages & session outcomes by month',
  endpoint: '/api/portal/modules/reports/by-private',
  lookups: LOOKUPS,
  idKey: 'Mnth',
  filters: [
    { param: 'year', label: 'Year', type: 'select', options: YEARS, initial: CURRENT_YEAR },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', initial: 0, width: 'max-w-40' },
  ],
  columns: [
    { key: 'Title', label: 'Month' },
    { key: 'PrvPacks', label: 'Packages' },
    { key: 'PrvSessions', label: 'Sessions' },
    { key: 'PrvAttendedOnTime', label: 'On Time' },
    { key: 'PrvMissedandMakeuped', label: 'Changed' },
    { key: 'PrvMakeup', label: 'Make-up' },
    { key: 'PrvCancelled', label: 'Cancelled' },
    { key: 'PrvUnIdentified', label: 'Unidentified' },
  ],
};

// ── Reports By Semester (ReportsBySemester.aspx → P_Stats_Activity_BySemester)
const bySemester: ModuleConfig = {
  title: 'Reports · By Semester',
  subtitle: 'Per-semester income, dues and headcount',
  endpoint: '/api/portal/modules/reports/by-semester',
  lookups: LOOKUPS,
  idKey: 'Title',
  filters: [
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', initial: 0, width: 'max-w-40' },
  ],
  columns: [
    { key: 'Title', label: 'Semester' },
    { key: 'GrpPayments', label: 'Group', format: 'money' },
    { key: 'PrvPayments', label: 'Private', format: 'money' },
    { key: 'TotalSalaries', label: 'Salaries', format: 'money' },
    { key: 'TotalExpenses', label: 'Expenses', format: 'money' },
    { key: 'TotalMainExpenses', label: 'M-Expenses', format: 'money' },
    { key: 'TotalNet', label: 'Net', format: 'money' },
    { key: 'GrpPaymentsDue', label: 'Due', format: 'money' },
    { key: 'GrpRegistered', label: 'Count' },
    { key: 'GrpActive', label: 'Active' },
    { key: 'GrpStopped', label: 'Stopped' },
  ],
};

// ── Reports By Coach (ReportsByCoach.aspx → P_Stats_Coach_ByMonth) ────────────
const byCoach: ModuleConfig = {
  title: 'Reports · By Coach',
  subtitle: 'A coach’s group/private income and private-session breakdown',
  endpoint: '/api/portal/modules/reports/by-coach',
  lookups: LOOKUPS,
  idKey: 'Mnth',
  filters: [
    { param: 'year', label: 'Year', type: 'select', options: YEARS, initial: CURRENT_YEAR },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-44' },
  ],
  columns: [
    { key: 'Title', label: 'Month' },
    { key: 'GrpPayments', label: 'Group', format: 'money' },
    { key: 'PrvPayments', label: 'Private', format: 'money' },
    { key: 'TotalSalaries', label: 'Salaries', format: 'money' },
    { key: 'TotalNet', label: 'Net', format: 'money' },
    { key: 'PrvPacks', label: 'Packages' },
    { key: 'PrvSessions', label: 'Sessions' },
    { key: 'PrvAttendedOnTime', label: 'On Time' },
    { key: 'PrvMissedandMakeuped', label: 'Changed' },
    { key: 'PrvMakeup', label: 'Make-up' },
    { key: 'PrvCancelled', label: 'Cancelled' },
  ],
};

// ── Reports By Attendance (ReportsByAttendance.aspx → P_Stats_Activity_ByEntrance)
const byAttendance: ModuleConfig = {
  title: 'Reports · Attendance',
  subtitle: 'Entrance counts (group / private / extra) per period',
  endpoint: '/api/portal/modules/reports/by-attendance',
  lookups: LOOKUPS,
  idKey: 'PeriodDesc',
  filters: [
    { param: 'reportType', label: 'Period', type: 'select', options: REPORT_TYPES, initial: 'Monthly' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', initial: 0, width: 'max-w-40' },
  ],
  columns: [
    { key: 'PeriodDesc', label: 'Period' },
    { key: 'PeriodFrom', label: 'From', format: 'date' },
    { key: 'PeriodTo', label: 'To', format: 'date' },
    { key: 'CntGroup', label: 'Group' },
    { key: 'CntPrivate', label: 'Private' },
    { key: 'CntExtra', label: 'Extra' },
    { key: 'CntTotal', label: 'Total' },
  ],
};

// ── Payments by Coach (PaymentsRptByCoach.aspx → P_Payment_Rpt_Coaches) ──────
const paymentsByCoach: ModuleConfig = {
  title: 'Reports · Payments by Coach',
  subtitle: 'Group payment totals & student counts per coach for a semester',
  endpoint: '/api/portal/modules/reports/payments-by-coach',
  lookups: LOOKUPS,
  idKey: 'CoachFullname',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    // Location drives the semester list but the report only takes a semester.
    { param: 'locationId', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-40', submit: false },
    { param: 'semesterId', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
  ],
  columns: [
    { key: 'CoachFullname', label: 'Coach' },
    { key: 'semestername', label: 'Semester' },
    { key: 'CountOFStds', label: 'Students' },
    { key: 'Total', label: 'Total', format: 'money' },
  ],
};

export const ReportByMonthPage = () => <ModuleListPage config={byMonth} />;
export const ReportPaymentsByCoachPage = () => <ModuleListPage config={paymentsByCoach} />;
export const ReportByPrivatePage = () => <ModuleListPage config={byPrivate} />;
export const ReportBySemesterPage = () => <ModuleListPage config={bySemester} />;
export const ReportByCoachPage = () => <ModuleListPage config={byCoach} />;
export const ReportByAttendancePage = () => <ModuleListPage config={byAttendance} />;
