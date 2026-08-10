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
// student form falls back gracefully (dropdown just shows "—" until picked).

export const SemesterForm = () => <RecordFormPage config={semester} />;
export const CoachForm = () => <RecordFormPage config={coach} />;
export const ClassForm = () => <RecordFormPage config={klass} />;
export const StudentForm = () => <RecordFormPage config={student} />;
