import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { Shell } from './components/Shell';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { GSchedulePage } from './pages/GSchedulePage';
import { PrSchedulePage } from './pages/PrSchedulePage';
import {
  RegistrationsPage, PaymentsPage, PaymentsDuePage, PrivatePackagesPage,
  PrivatePaymentsPage, ExtraPaymentsPage, MembershipPaymentsPage,
  ExtraClassesPage, MembershipsPage, CoachesPage, ClassesPage,
  SemestersPage, SessionsPage,
} from './pages/ModulePages';
import {
  SemesterForm, CoachForm, ClassForm, StudentForm,
  ExpenseForm, PackTypeForm, UserForm, TimesheetForm, CoachAttendanceForm,
} from './pages/RecordForms';
import { RegistrationForm } from './pages/RegistrationForm';
import { PrivatePackageForm } from './pages/PrivatePackageForm';
import { PaymentForm } from './pages/PaymentForm';
import { PrivatePaymentForm } from './pages/PrivatePaymentForm';
import { CleanupPage } from './pages/CleanupPage';
import { NewsAdminPage } from './pages/NewsAdminPage';
import { ChangeRequestsPage } from './pages/ChangeRequestsPage';
import { CompPortfolioPage } from './pages/CompPortfolioPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { CompSwimmersPage } from './pages/CompSwimmersPage';
import { LocationsAdminPage } from './pages/LocationsAdminPage';
import { SessionChangesManualPage } from './pages/SessionChangesManualPage';
import { SessionChangesApprovePage } from './pages/SessionChangesApprovePage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { NotificationsListPage } from './pages/NotificationsListPage';
import {
  ExpensesListPage, PackTypesPage, TimesheetsPage, AddonsListPage,
  CoachAttendancePage, UsersAdminPage,
} from './pages/LegacyModulePages';
import { PaymentDeliveriesPage, PrivateDeliveriesPage } from './pages/DeliveriesPage';
import { BulkWhatsAppPage } from './pages/BulkWhatsAppPage';
import { SettingsAdminPage } from './pages/SettingsAdminPage';
import { PayrollSheetPage } from './pages/PayrollSheetPage';
import { AddonFormPage } from './pages/AddonFormPage';
import { getStoredToken } from './api/portalApi';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getStoredToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  // BASE_URL tracks vite's `base`, so routing follows the deploy path
  // (/V27_WEB/ in production, / in dev) with no second setting to keep in sync.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/students/:id/portfolio" element={<CompPortfolioPage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/comp-swimmers" element={<CompSwimmersPage />} />
          <Route path="/locations" element={<LocationsAdminPage />} />
          <Route path="/session-changes/manual" element={<SessionChangesManualPage />} />
          <Route path="/session-changes/approve" element={<SessionChangesApprovePage />} />
          <Route path="/schedule" element={<GSchedulePage />} />
          <Route path="/pr-schedule" element={<PrSchedulePage />} />
          <Route path="/registrations" element={<RegistrationsPage />} />
          <Route path="/registrations/new" element={<RegistrationForm />} />
          <Route path="/registrations/:id" element={<RegistrationForm />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/new" element={<PaymentForm />} />
          <Route path="/payments/:id" element={<PaymentForm />} />
          <Route path="/payments-due" element={<PaymentsDuePage />} />
          <Route path="/privates" element={<PrivatePackagesPage />} />
          <Route path="/privates/new" element={<PrivatePackageForm />} />
          <Route path="/privates/:id" element={<PrivatePackageForm />} />
          <Route path="/pr-payments" element={<PrivatePaymentsPage />} />
          <Route path="/pr-payments/new" element={<PrivatePaymentForm />} />
          <Route path="/pr-payments/:id" element={<PrivatePaymentForm />} />
          <Route path="/ex-payments" element={<ExtraPaymentsPage />} />
          <Route path="/m-payments" element={<MembershipPaymentsPage />} />
          <Route path="/extra-classes" element={<ExtraClassesPage />} />
          <Route path="/members" element={<MembershipsPage />} />
          <Route path="/coaches" element={<CoachesPage />} />
          <Route path="/coaches/:id" element={<CoachForm />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/:id" element={<ClassForm />} />
          <Route path="/semesters" element={<SemestersPage />} />
          <Route path="/semesters/:id" element={<SemesterForm />} />
          <Route path="/cleanup" element={<CleanupPage />} />
          <Route path="/news" element={<NewsAdminPage />} />
          <Route path="/change-requests" element={<ChangeRequestsPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/notifications-list" element={<NotificationsListPage />} />
          <Route path="/expenses" element={<ExpensesListPage />} />
          <Route path="/expenses/:id" element={<ExpenseForm />} />
          <Route path="/payment-delivery" element={<PaymentDeliveriesPage />} />
          <Route path="/pr-payment-delivery" element={<PrivateDeliveriesPage />} />
          <Route path="/bulk-whatsapp" element={<BulkWhatsAppPage />} />
          <Route path="/pack-types" element={<PackTypesPage />} />
          <Route path="/pack-types/:id" element={<PackTypeForm />} />
          <Route path="/settings" element={<SettingsAdminPage />} />
          <Route path="/users" element={<UsersAdminPage />} />
          <Route path="/users/:id" element={<UserForm />} />
          <Route path="/payroll/timesheets" element={<TimesheetsPage />} />
          <Route path="/payroll/timesheets/:id" element={<TimesheetForm />} />
          <Route path="/payroll/sheet/:timesheetId" element={<PayrollSheetPage />} />
          <Route path="/payroll/addons" element={<AddonsListPage />} />
          <Route path="/payroll/addons/:id" element={<AddonFormPage />} />
          <Route path="/payroll/coach-attendance" element={<CoachAttendancePage />} />
          <Route path="/payroll/coach-attendance/:id" element={<CoachAttendanceForm />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
