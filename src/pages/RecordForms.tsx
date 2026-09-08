import { RecordFormPage, type RecordFormConfig } from '../components/RecordFormPage';

const LOOKUPS = '/api/portal/modules/lookups';

const CURRENCY = [
  { value: 'USD', label: 'USD' },
  { value: 'LBP', label: 'LBP' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({ value: d, label: d }));

// ── Semester ─────────────────────────────────────────────────────────────────

const semester: RecordFormConfig = {
  title: 'Semester',
  listPath: '/semesters',
  slug: 'semester',
  idKey: 'SemesterId',
  titleKey: 'SemesterName',
  lookups: LOOKUPS,
  heroSlide: 3,
  createDefaults: {
    SemesterCurrency: 'USD',
    SemesterNumberOfWeeks: 16,
    SemesterStudentsPerClass: 5,
    SemesterDeleted: false,
    SemesterCurrent: false,
    SemesterUpcoming: true,
    Exclusivecurrent: false,
    SemesterStop: '1900-01-01',
  },
  sections: [
    {
      title: 'Semester',
      fields: [
        { key: 'SemesterName', label: 'Name', type: 'text' },
        { key: 'SemesterPrimaryLocationId', label: 'Location', type: 'select', optionsKey: 'locations' },
        { key: 'SemesterStart', label: 'Start date', type: 'date' },
        { key: 'SemesterEnd', label: 'End date', type: 'date' },
        { key: 'SemesterNumberOfWeeks', label: 'Number of weeks', type: 'number' },
        { key: 'SemesterStudentsPerClass', label: 'Students per class', type: 'number' },
        { key: 'SemesterDescription', label: 'Description', type: 'textarea' },
      ],
    },
    {
      title: 'Pricing',
      fields: [
        { key: 'SemesterCurrency', label: 'Currency', type: 'select', options: CURRENCY },
        { key: 'SemesterAmountKit', label: 'Kit amount', type: 'number' },
        { key: 'SemesterAmountOne', label: '1× / week', type: 'number' },
        { key: 'SemesterAmountTwo', label: '2× / week', type: 'number' },
        { key: 'SemesterAmountThree', label: '3× / week', type: 'number' },
        { key: 'SemesterAmountFour', label: '4× / week', type: 'number' },
        { key: 'SemesterAmountFive', label: '5× / week', type: 'number' },
        { key: 'SemesterAmountSix', label: '6× / week', type: 'number' },
        { key: 'SemesterAmountSeven', label: '7× / week', type: 'number' },
      ],
    },
    {
      title: 'Flags',
      fields: [
        { key: 'SemesterCurrent', label: 'Current', type: 'checkbox' },
        { key: 'SemesterUpcoming', label: 'Upcoming', type: 'checkbox' },
        { key: 'Exclusivecurrent', label: 'Exclusive current', type: 'checkbox' },
        { key: 'SemesterDeleted', label: 'Deleted', type: 'checkbox' },
      ],
    },
  ],
};

// ── Coach ────────────────────────────────────────────────────────────────────

const coach: RecordFormConfig = {
  title: 'Coach',
  listPath: '/coaches',
  slug: 'coach',
  idKey: 'CoachId',
  titleKey: 'CoachFullName',
  lookups: LOOKUPS,
  heroSlide: 1,
  createDefaults: {
    CoachActive: true,
    CoachDateOfBirth: '1990-01-01',
    CoachStartingDate: new Date().toISOString().slice(0, 10),
    CoachPayrollSalaryCurrency: 'USD',
    CoachPayrollHrlyCurrency: 'USD',
  },
  sections: [
    {
      title: 'Personal',
      fields: [
        { key: 'CoachFullName', label: 'Full name', type: 'text' },
        { key: 'CoachGender', label: 'Gender', type: 'select', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }] },
        { key: 'CoachDateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'CoachNationality', label: 'Nationality', type: 'text' },
        { key: 'CoachPhoneNumber', label: 'Phone', type: 'text' },
        { key: 'CoachEmail', label: 'Email', type: 'text' },
        { key: 'CoachStartingDate', label: 'Starting date', type: 'date' },
        { key: 'CoachActive', label: 'Active', type: 'checkbox' },
      ],
    },
    {
      title: 'Assignment',
      fields: [
        { key: 'CoachPrimaryLocationId', label: 'Primary location', type: 'select', optionsKey: 'locations' },
        { key: 'CoachSecondaryLocationId', label: 'Second location', type: 'select', optionsKey: 'locations' },
        { key: 'CoachLevel', label: 'Level', type: 'text' },
        { key: 'CoachJobDescription', label: 'Job description', type: 'text' },
      ],
    },
    {
      title: 'Coaching types',
      fields: [
        { key: 'CoachGroup', label: 'Group', type: 'checkbox' },
        { key: 'CoachPrivate', label: 'Private', type: 'checkbox' },
        { key: 'CoachOther', label: 'Other', type: 'checkbox' },
      ],
    },
    {
      title: 'Payroll',
      fields: [
        { key: 'CoachPayrollSalaryCurrency', label: 'Salary currency', type: 'select', options: CURRENCY },
        { key: 'CoachPayrollSalary', label: 'Monthly salary', type: 'number' },
        { key: 'CoachPayrollHrlyCurrency', label: 'Hourly currency', type: 'select', options: CURRENCY },
        { key: 'CoachPayrollPRHour', label: 'Private / hour', type: 'number' },
        { key: 'CoachPayrollTeamHour', label: 'Team / hour', type: 'number' },
        { key: 'CoachPayrollSchoolHour', label: 'School / hour', type: 'number' },
      ],
    },
    {
      title: 'Notes',
      fields: [{ key: 'CoachNotes', label: 'Notes', type: 'textarea' }],
    },
  ],
};

// ── Class ────────────────────────────────────────────────────────────────────

const klass: RecordFormConfig = {
  title: 'Class',
  listPath: '/classes',
  slug: 'class',
  idKey: 'ClassId',
  titleKey: 'ClassDay',
  lookups: LOOKUPS,
  heroSlide: 2,
  createDefaults: {
    ClassDeleted: false,
    ClassObligatoryRemarksWhenAbsent: false,
    ClassPeriod: '',
  },
  sections: [
    {
      title: 'Class',
      fields: [
        { key: 'ClassLocationId', label: 'Location', type: 'select', optionsKey: 'locations' },
        { key: 'ClassSemesterId', label: 'Semester', type: 'select', optionsKey: 'semesters' },
        { key: 'CoachId', label: 'Coach', type: 'select', optionsKey: 'coaches' },
        { key: 'ClassLevelId', label: 'Level', type: 'select', optionsKey: 'levels' },
        { key: 'ClassDay', label: 'Day', type: 'select', options: DAYS },
        { key: 'ClassTimeFrom', label: 'Time (e.g. 17:30)', type: 'text' },
        { key: 'ClassPeriod', label: 'Period', type: 'text' },
        { key: 'ClassRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
    {
      title: 'Flags',
      fields: [
        { key: 'ClassObligatoryRemarksWhenAbsent', label: 'Require remark when absent', type: 'checkbox' },
        { key: 'ClassDeleted', label: 'Deleted', type: 'checkbox' },
      ],
    },
  ],
};

// ── Student (create) ─────────────────────────────────────────────────────────

const student: RecordFormConfig = {
  title: 'Student',
  listPath: '/students',
  slug: 'student',
  idKey: 'StudentId',
  titleKey: 'StudentFullName',
  lookups: LOOKUPS,
  heroSlide: 2,
  createDefaults: {
    StudentActive: true,
    StudentDeleted: false,
    StudentDateOfBirth: '2015-01-01',
    StudentStartingDate: new Date().toISOString().slice(0, 10),
    StudentPhoneNumberCode1: '961',
    StudentNationality1: 'Lebanese',
  },
  sections: [
    {
      title: 'Personal',
      fields: [
        { key: 'StudentFirstName', label: 'First name', type: 'text' },
        { key: 'StudentMiddleName', label: 'Middle name', type: 'text' },
        { key: 'StudentLastName', label: 'Last name', type: 'text' },
        { key: 'StudentGender', label: 'Gender', type: 'select', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }] },
        { key: 'StudentDateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'StudentBloodTypeId', label: 'Blood type', type: 'select', optionsKey: 'bloodTypes' },
        { key: 'StudentSchool', label: 'School', type: 'text' },
        { key: 'StudentNationality1', label: 'Nationality', type: 'text' },
      ],
    },
    {
      title: 'Contact',
      fields: [
        { key: 'StudentPhoneNumberCode1', label: 'Phone code', type: 'text' },
        { key: 'StudentPhoneNumber1', label: 'Phone', type: 'text' },
        { key: 'StudentEmail', label: 'Email', type: 'text' },
        { key: 'StudentAddressCity', label: 'City', type: 'text' },
      ],
    },
    {
      title: 'Swimming',
      fields: [
        { key: 'StudentPrimaryLocationId', label: 'Primary location', type: 'select', optionsKey: 'locations' },
        { key: 'StudentStartingDate', label: 'Starting date', type: 'date' },
        { key: 'StudentGroupSwimmer', label: 'Group Training', type: 'checkbox' },
        { key: 'StudentPrivateSwimmer', label: 'Private Training', type: 'checkbox' },
        { key: 'StudentSchoolSwimmer', label: 'School', type: 'checkbox' },
        { key: 'StudentActive', label: 'Active', type: 'checkbox' },
      ],
    },
    {
      title: 'Notes',
      fields: [{ key: 'StudentNotes', label: 'Notes', type: 'textarea' }],
    },
  ],
};

// The blood-type lookup isn't in the generic modules lookups endpoint; the
// student form falls back gracefully (dropdown just shows "-" until picked).

// ── Expense (ExpensesIndividual.aspx) ────────────────────────────────────────

const expense: RecordFormConfig = {
  title: 'Expense',
  listPath: '/expenses',
  slug: 'expense',
  idKey: 'ExpenseId',
  titleKey: 'ExpenseType',
  lookups: '/api/portal/modules/lookups',
  heroSlide: 3,
  createDefaults: {
    ExpensePaidCurrency: 'USD',
    ExpensePaidCurrencyRate: 1500,
    ExpenseType: 'Other',
    ExpenseCoachId: 0,
  },
  sections: [
    {
      title: 'Expense',
      fields: [
        { key: 'ExpenseSemesterId', label: 'Semester', type: 'select', optionsKey: 'semesters' },
        { key: 'ExpenseDate', label: 'Date', type: 'date' },
        { key: 'ExpensePaidAmount', label: 'Amount Paid', type: 'number' },
        { key: 'ExpensePaidCurrency', label: 'Currency', type: 'select', options: [
          { value: 'LBP', label: 'LBP' }, { value: 'USD', label: 'USD' },
        ] },
        { key: 'ExpensePaidCurrencyRate', label: 'USD to LBP Rate', type: 'number' },
        { key: 'ExpenseAmount', label: 'Amount (normalized)', type: 'number' },
        { key: 'ExpenseType', label: 'Type', type: 'select', options: [
          'Loan', 'Return/Refund', 'Tools', 'M.Sakr', 'Gr Pay By M.Sakr', 'Pr Pay By M.Sakr', 'Other',
        ].map((v) => ({ value: v, label: v })) },
        { key: 'ExpenseCoachId', label: 'Coach', type: 'select', optionsKey: 'coaches' },
        { key: 'ExpenseRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
  ],
};

// ── Private package type (PrivatePackagesSettingsIndividual.aspx) ────────────

const packType: RecordFormConfig = {
  title: 'Pack Type',
  listPath: '/pack-types',
  slug: 'pack-type',
  idKey: 'PrivatePackageId',
  titleKey: 'PrivatePackageName',
  lookups: '/api/portal/modules/lookups',
  heroSlide: 4,
  createDefaults: {
    PrivatePackageCurrency: 'LBP',
    PrivatePackageSessionsCount: 10,
    PrivatePackageActive: true,
  },
  sections: [
    {
      title: 'Package Type',
      fields: [
        { key: 'PrivatePackageLocationId', label: 'Location', type: 'select', optionsKey: 'locations' },
        { key: 'PrivatePackageName', label: 'Package Name', type: 'text' },
        { key: 'PrivatePackageCurrency', label: 'Currency (fixed after create)', type: 'select', options: [
          { value: 'LBP', label: 'LBP' }, { value: 'USD', label: 'USD' },
        ] },
        { key: 'PrivatePackageSessionsCount', label: 'Sessions', type: 'number' },
        { key: 'PrivatePackagePriceForOneStudent', label: 'Price For One', type: 'number' },
        { key: 'PrivatePackagePriceForTwoStudents', label: 'Price For Two', type: 'number' },
        { key: 'PrivatePackagePriceForThreeStudents', label: 'Price For Three', type: 'number' },
        { key: 'PrivatePackageActive', label: 'Active', type: 'checkbox' },
      ],
    },
  ],
};

// ── Portal user (UsersIndividual.aspx) ───────────────────────────────────────

const portalUser: RecordFormConfig = {
  title: 'User',
  listPath: '/users',
  slug: 'user',
  idKey: 'UserID',
  titleKey: 'UserFullname',
  lookups: '/api/portal/modules/lookups',
  heroSlide: 1,
  createDefaults: {
    UserType: 'User',
    UserActive: true,
    UserExport: true,
    UserSaving: true,
    UserNotifications: true,
  },
  sections: [
    {
      title: 'Account',
      fields: [
        { key: 'UserFullname', label: 'Full Name', type: 'text' },
        { key: 'UserEmail', label: 'Email', type: 'text' },
        { key: 'UserPhoneNumber', label: 'Phone Number', type: 'text' },
        { key: 'UserType', label: 'User Type', type: 'select', options: [
          'SiteMaster', 'SuperUser', 'Payment/Audit', 'User', 'Guest',
        ].map((v) => ({ value: v, label: v })) },
        { key: 'UserPrimaryLocationId', label: 'Primary Location', type: 'select', optionsKey: 'locations' },
      ],
    },
    {
      title: 'Access Management',
      fields: [
        { key: 'UserActive', label: 'Active', type: 'checkbox' },
        { key: 'UserDeleted', label: 'Deleted', type: 'checkbox' },
        { key: 'UserExport', label: 'Exports', type: 'checkbox' },
        { key: 'UserSaving', label: 'Save / Edit', type: 'checkbox' },
        { key: 'UserNotifications', label: 'Notifications', type: 'checkbox' },
      ],
    },
  ],
};

// ── Timesheet (TimeSheetsIndividual.aspx) ────────────────────────────────────

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  .map((v) => ({ value: v, label: v }));
const YEARS = Array.from({ length: 10 }, (_, i) => String(2019 + i))
  .map((v) => ({ value: v, label: v }));

const timesheet: RecordFormConfig = {
  title: 'Timesheet',
  listPath: '/payroll/timesheets',
  slug: 'timesheet',
  idKey: 'TimesheetID',
  titleKey: 'TimesheetStatus',
  heroSlide: 2,
  createDefaults: {
    TimesheetStatus: 'Open',
    TimesheetSalaryPercent: 100,
    TimeSheetCurrencyRate: 1500,
  },
  sections: [
    {
      title: 'Timesheet',
      fields: [
        { key: 'TimesheetMonth', label: 'Month', type: 'select', options: MONTHS },
        { key: 'TimesheetYr', label: 'Year', type: 'select', options: YEARS },
        { key: 'TimesheetStartDate', label: 'Start Date', type: 'date' },
        { key: 'TimesheetEndDate', label: 'End Date', type: 'date' },
        { key: 'TimesheetStatus', label: 'Status', type: 'select', options: [
          { value: 'Open', label: 'Open' },
          { value: 'Closed', label: 'Closed' },
          { value: 'ClosedNoPayment', label: 'Closed. No Payment' },
        ] },
        { key: 'TimesheetSalaryPercent', label: 'Salary %', type: 'number' },
        { key: 'TimeSheetCurrencyRate', label: 'USD to LBP Rate', type: 'number' },
        { key: 'TimesheetRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
  ],
};

// ── Coach attendance (CoachsAttendancesIndividual.aspx) ──────────────────────

const ABSENT_TIMES = ['', '0-15', '15-30', '30-45', '1', '2', '3', '4', 'Day', '2Day', '3Day', '1Month']
  .map((v) => ({ value: v, label: v === '' ? 'On Time' : v }));
const DEDUCTS = ['', '1Hr', '2Hrs', '3Hrs', '4Hrs', '1Day', '2Day', '3Day', '1Month']
  .map((v) => ({ value: v, label: v === '' ? 'No Deduction' : v }));

const coachAttendanceForm: RecordFormConfig = {
  title: 'Coach Attendance',
  listPath: '/payroll/coach-attendance',
  slug: 'coach-attendance',
  idKey: 'Coaches_Attendance_ID',
  titleKey: 'CoachFullName',
  lookups: '/api/portal/payroll/attendance-lookups',
  heroSlide: 3,
  createDefaults: {
    Coaches_Attendance_ReasonID: 2,
    Coaches_Attendance_Absent: true,
  },
  sections: [
    {
      title: 'Attendance',
      fields: [
        { key: 'Coaches_Attendance_CoachID', label: 'Coach', type: 'select', optionsKey: 'coaches' },
        { key: 'Coaches_Attendance_Date', label: 'Date', type: 'date' },
        { key: 'Coaches_Attendance_ReasonID', label: 'Reason', type: 'select', optionsKey: 'reasons' },
        { key: 'Coaches_Attendance_Absent', label: 'Absent', type: 'checkbox' },
        { key: 'Coaches_Attendance_Late', label: 'Late', type: 'checkbox' },
        { key: 'Coaches_Attendance_EarlyLeave', label: 'Early Leave', type: 'checkbox' },
        { key: 'Coaches_Attendance_AbsentTime', label: 'Time Missed', type: 'select', options: ABSENT_TIMES },
        { key: 'Coaches_Attendance_AbsentDeduct', label: 'Deduction', type: 'select', options: DEDUCTS },
        { key: 'Coaches_Attendance_AbsentDeductReason', label: 'Deduction Reason', type: 'select', options: [
          { value: '', label: 'No Reason' }, { value: 'ByProswim', label: 'By ProSwim' }, { value: 'ByCoach', label: 'By Coach' },
        ] },
        { key: 'Coaches_Attendance_Approved', label: 'Approved', type: 'checkbox' },
        { key: 'Coaches_Attendance_Approvedby', label: 'Approved By', type: 'text' },
        { key: 'Coaches_Attendance_ApprovedManager', label: 'Manager Approved (SiteMaster only)', type: 'checkbox' },
        { key: 'Coaches_Attendance_Remarks', label: 'Remarks', type: 'textarea' },
      ],
    },
  ],
};

// ── Location ─────────────────────────────────────────────────────────────────

const location: RecordFormConfig = {
  title: 'Location',
  listPath: '/locations',
  slug: 'location',
  idKey: 'LocationId',
  titleKey: 'LocationNickName',
  createDefaults: { LocationActive: true },
  sections: [
    {
      title: 'Location',
      fields: [
        { key: 'LocationNickName', label: 'Nick Name', type: 'text' },
        { key: 'LocationFullName', label: 'Full Name', type: 'text' },
        { key: 'LocationCity', label: 'City', type: 'text' },
        { key: 'LocationColor', label: 'Color', type: 'text' },
        { key: 'LocationFullAddress', label: 'Full Address', type: 'textarea' },
        { key: 'LocationRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
    {
      title: 'Contact',
      fields: [
        { key: 'LocationContact', label: 'Contact', type: 'text' },
        { key: 'LocationContactPhone', label: 'Contact Phone', type: 'text' },
        { key: 'LocationPhone1', label: 'Phone 1', type: 'text' },
        { key: 'LocationPhone2', label: 'Phone 2', type: 'text' },
        { key: 'LocationInfoEmail', label: 'Info Email', type: 'text' },
        { key: 'LocationFax', label: 'Fax', type: 'text' },
        { key: 'LocationWebsiteText', label: 'Website Text', type: 'text' },
        { key: 'LocationWebsite', label: 'Website URL', type: 'text' },
      ],
    },
    {
      title: 'WhatsApp & Map',
      fields: [
        { key: 'LocationWAName', label: 'WhatsApp Name', type: 'text' },
        { key: 'LocationWAPhone', label: 'WhatsApp Phone', type: 'text' },
        { key: 'LocationXLAT', label: 'Map Latitude', type: 'text' },
        { key: 'LocationXLONG', label: 'Map Longitude', type: 'text' },
        { key: 'LocationMapURL', label: 'Map URL', type: 'text' },
        { key: 'LocationIcon', label: 'Icon', type: 'text' },
        { key: 'LocationWABulk', label: 'Bulk WhatsApp', type: 'checkbox' },
        { key: 'LocationWAAuto', label: 'Auto WhatsApp', type: 'checkbox' },
      ],
    },
    {
      title: 'Status',
      fields: [
        { key: 'LocationActive', label: 'Active', type: 'checkbox' },
        { key: 'LocationSchool', label: 'School', type: 'checkbox' },
        { key: 'LocationDeleted', label: 'Deleted', type: 'checkbox' },
      ],
    },
  ],
};

// ── Main Expense ─────────────────────────────────────────────────────────────

const mainExpense: RecordFormConfig = {
  title: 'Main Expense',
  listPath: '/main-expenses',
  slug: 'mainexpense',
  idKey: 'ExpenseId',
  titleKey: 'ExpenseType',
  lookups: LOOKUPS,
  createDefaults: { ExpensePaidCurrency: 'USD', ExpensePaidCurrencyRate: 1 },
  sections: [
    {
      title: 'Expense',
      fields: [
        { key: 'ExpenseLocationId', label: 'Location', type: 'select', optionsKey: 'locations' },
        { key: 'ExpenseType', label: 'Type', type: 'select', optionsKey: 'mainExpenseTypes' },
        { key: 'ExpenseDate', label: 'Date', type: 'date' },
        { key: 'ExpenseAmount', label: 'Amount', type: 'number' },
        { key: 'ExpensePaidAmount', label: 'Paid Amount', type: 'number' },
        { key: 'ExpensePaidCurrency', label: 'Currency', type: 'select', options: CURRENCY },
        { key: 'ExpensePaidCurrencyRate', label: 'USD to LBP Rate', type: 'number' },
        { key: 'ExpenseAutoRenew', label: 'Auto Renew', type: 'checkbox' },
        { key: 'ExpenseRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
  ],
};

// ── Group session (ClassesSessionsIndividual.aspx) ───────────────────────────

const session: RecordFormConfig = {
  title: 'Session',
  listPath: '/sessions',
  slug: 'session',
  idKey: 'SessionId',
  titleKey: 'ClassName',
  lookups: '/api/portal/modules/lookups',
  heroSlide: 2,
  createDefaults: {
    SessionStatus: 'Active',
  },
  sections: [
    {
      title: 'Session',
      fields: [
        { key: 'SessionClassId', label: 'Class', type: 'select', optionsKey: 'classes' },
        { key: 'SessionDate', label: 'Date', type: 'date' },
        { key: 'SessionStatus', label: 'Status', type: 'select', options: [
          'Active', 'Cancelled', 'Make-Up',
        ].map((v) => ({ value: v, label: v })) },
        { key: 'SessionRemarks', label: 'Remarks', type: 'textarea' },
      ],
    },
  ],
};

export const SessionForm = () => <RecordFormPage config={session} />;
export const SemesterForm = () => <RecordFormPage config={semester} />;
export const CoachForm = () => <RecordFormPage config={coach} />;
export const ClassForm = () => <RecordFormPage config={klass} />;
export const StudentForm = () => <RecordFormPage config={student} />;
export const ExpenseForm = () => <RecordFormPage config={expense} />;
export const PackTypeForm = () => <RecordFormPage config={packType} />;
export const UserForm = () => <RecordFormPage config={portalUser} />;
export const TimesheetForm = () => <RecordFormPage config={timesheet} />;
export const CoachAttendanceForm = () => <RecordFormPage config={coachAttendanceForm} />;
export const LocationForm = () => <RecordFormPage config={location} />;
export const MainExpenseForm = () => <RecordFormPage config={mainExpense} />;
