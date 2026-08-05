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
import { SemesterForm, CoachForm, ClassForm, StudentForm } from './pages/RecordForms';
import { RegistrationForm } from './pages/RegistrationForm';
import { CleanupPage } from './pages/CleanupPage';
import { getStoredToken } from './api/portalApi';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getStoredToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/schedule" element={<GSchedulePage />} />
          <Route path="/pr-schedule" element={<PrSchedulePage />} />
          <Route path="/registrations" element={<RegistrationsPage />} />
          <Route path="/registrations/new" element={<RegistrationForm />} />
          <Route path="/registrations/:id" element={<RegistrationForm />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments-due" element={<PaymentsDuePage />} />
          <Route path="/privates" element={<PrivatePackagesPage />} />
          <Route path="/pr-payments" element={<PrivatePaymentsPage />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
