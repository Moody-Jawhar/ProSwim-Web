import { ModuleListPage, type ModuleConfig } from '../components/ModuleListPage';

// Configured list pages for the migrated legacy modules. Each maps 1:1 to a
// legacy XxxList.aspx page and its stored procedure (see PortalModulesController).

const LOOKUPS = '/api/portal/modules/lookups';

const PACKAGE_STATUSES = ['Active', 'Closed', 'ClosedNeedPayment', 'MovedtoGroup', 'Freeze', 'Cancelled', 'Transfer']
  .map((v) => ({ value: v, label: v }));

const NEED_ATTENTION = [
  { value: 'AttendanceMoreThanPayment2', label: 'Need Payment' },
  { value: 'NeedtoBeClosed', label: 'Need to Be Closed' },
  { value: 'NeedFollowup', label: 'Need Followup' },
  { value: 'Freeze', label: 'Freeze' },
];

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((v) => ({ value: v, label: v }));

const EXTRA_TYPES = ['AquaBaby', 'AquaGym', 'AquaMermaid', 'MemberShipPasses', 'MemberShip', 'Others']
  .map((v) => ({ value: v, label: v }));

// ── Registrations ────────────────────────────────────────────────────────────

const registrations: ModuleConfig = {
  title: 'Registrations',
  endpoint: '/api/portal/modules/registrations',
  lookups: LOOKUPS,
  idKey: 'RegistrationID',
  editBase: '/registrations',
  filters: [
    { param: 'searchFor', label: 'Search student…', type: 'text' },
    // P_Registration_Select takes no location — the location picker scopes the
    // semester list, and the semester scopes the rows.
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36', submit: false },
    { param: 'semesterIds', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-36' },
    { param: 'active', label: 'Active', type: 'checkbox', initial: true },
    { param: 'stopped', label: 'Stopped', type: 'checkbox', initial: true },
    { param: 'withDiscount', label: 'With Discount', type: 'checkbox' },
    { param: 'onlyDue', label: 'Only Due', type: 'checkbox' },
  ],
  columns: [
    { key: 'StudentFullName', label: 'Student' },
    { key: 'PhoneNumber1', label: 'Phone' },
    { key: 'RegistrationNumberOfTimes', label: 'Times' },
    { key: 'ClassName1', label: 'Class 1' },
    { key: 'ClassName2', label: 'Class 2' },
    { key: 'Status', label: 'Status' },
    { key: 'SemesterName', label: 'Semester' },
    { key: 'RegistrationDate', label: 'Start', format: 'date' },
    { key: 'DOB', label: 'DOB', format: 'date', extra: true },
    { key: 'ClassName3', label: 'Class 3', extra: true },
    { key: 'DiscountFullRemark', label: 'Remarks', extra: true },
    { key: 'RegistrationCost', label: 'Total', format: 'money', extra: true },
    { key: 'RegistrationDiscount', label: 'Disc', format: 'money', extra: true },
    { key: 'RegistrationNetToPay', label: 'Net', format: 'money', extra: true },
    { key: 'PaidAmount', label: 'Paid', format: 'money', extra: true },
    { key: 'DueAmount', label: 'Due', format: 'money', extra: true },
    { key: 'SessionsTotal', label: 'S-Total', extra: true },
    { key: 'SessionsAttended', label: 'S-Attended', extra: true },
    { key: 'SessionsMissed', label: 'S-Missed', extra: true },
  ],
};

// ── Group payments ───────────────────────────────────────────────────────────

const payments: ModuleConfig = {
  title: 'Group Payments',
  endpoint: '/api/portal/modules/payments',
  lookups: LOOKUPS,
  idKey: 'PaymentID',
  editBase: '/payments',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'semesterIds', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
    { param: 'onlyCurrentSemester', label: 'Current Semester Only', type: 'checkbox' },
  ],
  columns: [
    { key: 'LocationNickName', label: 'Location' },
    { key: 'SemesterName', label: 'Semester' },
    { key: 'IDShow', label: 'ID' },
    { key: 'IssuedTo', label: 'Issued To' },
    { key: 'PaymentDate', label: 'Date', format: 'date' },
    { key: 'PaymentTotalAmount', label: 'Amount', format: 'money' },
    { key: 'PaymentPaidAmount', label: 'Paid', format: 'money' },
    { key: 'PaymentPaidCurrency', label: 'Curr' },
    { key: 'PaymentMode', label: 'Mode' },
    { key: 'Serial', label: 'Delivery S/N', extra: true },
    { key: 'PayLoc', label: 'Pay Loc', extra: true },
  ],
};

// ── Due payments ─────────────────────────────────────────────────────────────

const paymentsDue: ModuleConfig = {
  title: 'Due Payments',
  endpoint: '/api/portal/modules/payments-due',
  lookups: LOOKUPS,
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'semesterIds', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'onlyDue', label: 'Only With Due', type: 'checkbox' },
    { param: 'showActive', label: 'Active', type: 'checkbox', initial: true },
    { param: 'showStopped', label: 'Stopped', type: 'checkbox', initial: true },
  ],
  columns: [
    { key: 'SemesterName', label: 'Semester' },
    { key: 'StudentFullName', label: 'Student' },
    { key: 'Phone', label: 'Phone' },
    { key: 'Total', label: 'Total', format: 'money' },
    { key: 'PaidAmount', label: 'Paid', format: 'money' },
    { key: 'RegistrationPaidPrevSemester', label: 'On Hold', format: 'money' },
    { key: 'DueAmount', label: 'Due', format: 'money' },
    { key: 'DuePercent', label: 'Due %' },
  ],
};

// ── Private packages ─────────────────────────────────────────────────────────

const privatePackages: ModuleConfig = {
  title: 'Private Packages',
  endpoint: '/api/portal/modules/private-packages',
  lookups: LOOKUPS,
  idKey: 'PackageId',
  editBase: '/privates',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'status', label: 'Status', type: 'select', options: PACKAGE_STATUSES, initial: 'Active' },
    { param: 'needAttention', label: 'Attention', type: 'select', options: NEED_ATTENTION },
    { param: 'sessionDay', label: 'Day', type: 'select', options: WEEK_DAYS, width: 'max-w-24' },
    { param: 'dateFrom', label: 'From', type: 'date' },
    { param: 'dateTo', label: 'To', type: 'date' },
    { param: 'onlyDue', label: 'Only Due', type: 'checkbox' },
  ],
  columns: [
    { key: 'LocationNickName', label: 'Location' },
    { key: 'CoachFullName', label: 'Coach' },
    { key: 'PackageDesc', label: 'Package' },
    { key: 'StudentPackagesCount', label: '#' },
    { key: 'PackageStartDate', label: 'Start', format: 'date' },
    { key: 'PackageNumberOfSessions', label: 'Sessions' },
    { key: 'SessionsLeft', label: 'Avlb' },
    { key: 'PackageCurrency', label: 'Curr' },
    { key: 'PackageAmount', label: 'Amount', format: 'money' },
    { key: 'DuePayment', label: 'Due', format: 'money' },
    { key: 'PackageStatus', label: 'Status' },
    { key: 'Phone', label: 'Phone', extra: true },
    { key: 'PackageRemarks', label: 'Remarks', extra: true },
  ],
};

// ── Private / extra / membership payments ────────────────────────────────────

function privatePaymentsConfig(mode: string, title: string): ModuleConfig {
  return {
    title,
    endpoint: `/api/portal/modules/private-payments?mode=${mode}`,
    lookups: LOOKUPS,
    idKey: 'PrivatePaymentID',
    // Only true private payments have an in-app form; extra/membership stay list-only.
    ...(mode === 'private' ? { editBase: '/pr-payments' } : {}),
    filters: [
      { param: 'searchFor', label: 'Search…', type: 'text' },
      { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
      { param: 'dateFrom', label: 'From', type: 'date' },
      { param: 'dateTo', label: 'To', type: 'date' },
    ],
    columns: [
      { key: 'ClassType', label: 'Type' },
      { key: 'PackageName', label: 'Package' },
      { key: 'IDShow', label: 'ID' },
      { key: 'IssuedTo', label: 'Issued To' },
      { key: 'PrivatePaymentDate', label: 'Date', format: 'date' },
      { key: 'PrivatePaymentTotalAmount', label: 'Amount', format: 'money' },
      { key: 'PrivatePaymentPaidAmount', label: 'Paid', format: 'money' },
      { key: 'PrivatePaymentPaidCurrency', label: 'Curr' },
      { key: 'PaymentMode', label: 'Mode' },
      { key: 'Serial', label: 'Delivery S/N', extra: true },
      { key: 'PayLoc', label: 'Pay Loc', extra: true },
    ],
  };
}

// ── Extra classes / memberships ──────────────────────────────────────────────

function extraClassesConfig(types: string, title: string): ModuleConfig {
  return {
    title,
    endpoint: `/api/portal/modules/extra-classes${types ? `?types=${types}` : ''}`,
    lookups: LOOKUPS,
    idKey: 'ExtraClassId',
    filters: [
      { param: 'searchFor', label: 'Search…', type: 'text' },
      { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
      ...(types ? [] : [{ param: 'types', label: 'Type', type: 'select' as const, options: EXTRA_TYPES }]),
      { param: 'status', label: 'Status', type: 'select', options: PACKAGE_STATUSES, initial: 'Active' },
      { param: 'dateFrom', label: 'From', type: 'date' },
      { param: 'dateTo', label: 'To', type: 'date' },
      { param: 'onlyDue', label: 'Only Due', type: 'checkbox' },
    ],
    columns: [
      { key: 'ExtraClassType', label: 'Type' },
      { key: 'LocationNickName', label: 'Location' },
      { key: 'StudentFullname', label: 'Student' },
      { key: 'ExtraClassStartDate', label: 'Start', format: 'date' },
      { key: 'ExtraClassNumberOfSessions', label: 'Sessions' },
      { key: 'SessionsLeft', label: 'Available' },
      { key: 'ExtraClassCurrency', label: 'Curr' },
      { key: 'ExtraClassCost', label: 'Cost', format: 'money' },
      { key: 'DuePayment', label: 'Due', format: 'money' },
      { key: 'Phone', label: 'Phone', extra: true },
      { key: 'ExtraClassValidityMonths', label: 'Validity (m)', extra: true },
      { key: 'ExtraClassDescription', label: 'Description', extra: true },
    ],
  };
}

// ── Coaches ──────────────────────────────────────────────────────────────────

const coaches: ModuleConfig = {
  title: 'Coaches',
  endpoint: '/api/portal/modules/coaches',
  lookups: LOOKUPS,
  idKey: 'CoachId',
  editBase: '/coaches',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationIds', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'active', label: 'Active', type: 'checkbox', initial: true },
    { param: 'inactive', label: 'Inactive', type: 'checkbox' },
    { param: 'onlyPrimary', label: 'Only Primary', type: 'checkbox' },
  ],
  columns: [
    { key: 'CoachFullName', label: 'Coach' },
    { key: 'locationNickName', label: 'Location' },
    { key: 'CoachEmail', label: 'Email' },
    { key: 'CoachPhoneNumber', label: 'Phone' },
    { key: 'CoachActive', label: 'Active', format: 'bool' },
    { key: 'CoachDailyHrs', label: 'Daily Hrs' },
    { key: 'CoachWeeklyHrs', label: 'Weekly Hrs' },
  ],
};

// ── Classes ──────────────────────────────────────────────────────────────────

const classes: ModuleConfig = {
  title: 'Classes',
  endpoint: '/api/portal/modules/classes',
  lookups: LOOKUPS,
  idKey: 'ClassID',
  editBase: '/classes',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationId', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'semesterId', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-36' },
    { param: 'deleted', label: 'Deleted', type: 'checkbox' },
  ],
  columns: [
    { key: 'SemesterName', label: 'Semester' },
    { key: 'LocationNickName', label: 'Location' },
    { key: 'CoachFullName', label: 'Coach' },
    { key: 'ClassDay', label: 'Day' },
    { key: 'ClassTimeFrom', label: 'Time' },
    { key: 'ClassPeriod', label: 'Period' },
  ],
};

// ── Semesters ────────────────────────────────────────────────────────────────

const semesters: ModuleConfig = {
  title: 'Semesters',
  endpoint: '/api/portal/modules/semesters',
  lookups: LOOKUPS,
  idKey: 'SemesterID',
  editBase: '/semesters',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    { param: 'locationId', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36' },
    { param: 'currentUpcoming', label: 'Current/Upcoming', type: 'checkbox', initial: true },
    { param: 'deleted', label: 'Deleted', type: 'checkbox' },
  ],
  columns: [
    { key: 'SemesterName', label: 'Semester' },
    { key: 'locationNickName', label: 'Location' },
    { key: 'SemesterStart', label: 'Start', format: 'date' },
    { key: 'SemesterEnd', label: 'End', format: 'date' },
    { key: 'SemesterNumberOfWeeks', label: 'Weeks' },
    { key: 'SemesterDeleted', label: 'Deleted', format: 'bool' },
  ],
};

// ── Group sessions ───────────────────────────────────────────────────────────

const sessions: ModuleConfig = {
  title: 'Sessions & Attendance',
  endpoint: '/api/portal/modules/sessions',
  lookups: LOOKUPS,
  idKey: 'SessionId',
  filters: [
    { param: 'searchFor', label: 'Search…', type: 'text' },
    // As with registrations, P_Classes_Sessions_Select has no location param.
    { param: 'locationId', label: 'Location', type: 'select', optionsKey: 'locations', width: 'max-w-36', submit: false },
    { param: 'semesterId', label: 'Semester', type: 'select', optionsKey: 'semesters', width: 'max-w-44' },
    { param: 'coachId', label: 'Coach', type: 'select', optionsKey: 'coaches', width: 'max-w-36' },
    { param: 'day', label: 'Day', type: 'select', options: WEEK_DAYS, width: 'max-w-24' },
    { param: 'date', label: 'Date', type: 'date' },
  ],
  columns: [
    { key: 'ClassName', label: 'Class' },
    { key: 'SessionDate', label: 'Date', format: 'date' },
    { key: 'SessionStatus', label: 'Status' },
    { key: 'Registered', label: 'Registered' },
    { key: 'Attended', label: 'Attended' },
    { key: 'Makeuped', label: 'Makeup' },
    { key: 'SessionRemarks', label: 'Remarks' },
  ],
};

// ── Exported pages ───────────────────────────────────────────────────────────

export const RegistrationsPage = () => <ModuleListPage config={registrations} />;
export const PaymentsPage = () => <ModuleListPage config={payments} />;
export const PaymentsDuePage = () => <ModuleListPage config={paymentsDue} />;
export const PrivatePackagesPage = () => <ModuleListPage config={privatePackages} />;
export const PrivatePaymentsPage = () => <ModuleListPage config={privatePaymentsConfig('private', 'Private Payments')} />;
export const ExtraPaymentsPage = () => <ModuleListPage config={privatePaymentsConfig('extra', 'Extra Class Payments')} />;
export const MembershipPaymentsPage = () => <ModuleListPage config={privatePaymentsConfig('memberships', 'Membership Payments')} />;
export const ExtraClassesPage = () => <ModuleListPage config={extraClassesConfig('', 'Extra Classes')} />;
export const MembershipsPage = () => <ModuleListPage config={extraClassesConfig('MemberShipPasses,MemberShip', 'Memberships')} />;
export const CoachesPage = () => <ModuleListPage config={coaches} />;
export const ClassesPage = () => <ModuleListPage config={classes} />;
export const SemestersPage = () => <ModuleListPage config={semesters} />;
export const SessionsPage = () => <ModuleListPage config={sessions} />;
