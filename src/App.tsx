import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { StudentDashboard } from "./pages/dashboards/StudentDashboard";
import { ParentDashboard } from "./pages/dashboards/ParentDashboard";
import { LecturerDashboard } from "./pages/dashboards/LecturerDashboard";
import { FinanceDashboard } from "./pages/dashboards/FinanceDashboard";
import { AcademicDashboard } from "./pages/dashboards/AcademicDashboard";
import { ManagementDashboard } from "./pages/dashboards/ManagementDashboard";
import { AdminDashboard } from "./pages/dashboards/AdminDashboard";
import { StudentRegistrationPage } from "./pages/academic/StudentRegistrationPage";
import { StudentsListPage } from "./pages/academic/StudentsListPage";
import { ClassesPage } from "./pages/academic/ClassesPage";
import { ResultsReviewPage } from "./pages/academic/ResultsReviewPage";
import { MarksEntryPage } from "./pages/lecturer/MarksEntryPage";
import { AttendanceMarkingPage } from "./pages/lecturer/AttendanceMarkingPage";
import { InstitutionSetupPage } from "./pages/admin/InstitutionSetupPage";
import { AuditLogPage } from "./pages/admin/AuditLogPage";
import { StudentFeesPage } from "./pages/student/StudentFeesPage";
import { StudentDocumentsPage } from "./pages/student/StudentDocumentsPage";
import { CreateFeePage } from "./pages/finance/CreateFeePage";
import { PaymentVerificationPage } from "./pages/finance/PaymentVerificationPage";
import { AnnouncementsPage } from "./pages/shared/AnnouncementsPage";
import { NotificationsPage } from "./pages/shared/NotificationsPage";
import { TimetablePage } from "./pages/shared/TimetablePage";
import { ReportsPage } from "./pages/shared/ReportsPage";
import { ROLE_DASHBOARD_PATH } from "./config/roles";

const STUDENT_NAV = [
  { label: "Overview", href: "/student" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/fees" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Timetable", href: "/student/timetable" },
  { label: "Documents", href: "/student/documents" },
  { label: "Announcements", href: "/student/announcements" },
];

const LECTURER_NAV = [
  { label: "My classes", href: "/lecturer" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Marks entry", href: "/lecturer/marks" },
  { label: "Materials", href: "/lecturer/materials" },
  { label: "Announcements", href: "/lecturer/announcements" },
];

const ACADEMIC_NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Classes", href: "/academic/classes" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

const FINANCE_NAV = [
  { label: "Overview", href: "/finance" },
  { label: "Create fee", href: "/finance/create-fee" },
  { label: "Payments awaiting verification", href: "/finance/verification" },
  { label: "Reports", href: "/finance/reports" },
];

const MANAGEMENT_NAV = [
  { label: "Institutional KPIs", href: "/management" },
  { label: "Reports", href: "/management/reports" },
  { label: "Announcements", href: "/management/announcements" },
];

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_DASHBOARD_PATH[user.role]} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage navItems={[{ label: "Back to dashboard", href: "/" }]} />
              </ProtectedRoute>
            }
          />

          {/* Student */}
          <Route
            path="/student/fees"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <StudentFeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/documents"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <StudentDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <TimetablePage navItems={STUDENT_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/announcements"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <AnnouncementsPage navItems={STUDENT_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/*"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Parent */}
          <Route
            path="/parent/announcements"
            element={
              <ProtectedRoute allowedRoles={["PARENT"]}>
                <AnnouncementsPage
                  navItems={[
                    { label: "Overview", href: "/parent" },
                    { label: "Linked students", href: "/parent/students" },
                    { label: "Announcements", href: "/parent/announcements" },
                  ]}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/*"
            element={
              <ProtectedRoute allowedRoles={["PARENT"]}>
                <ParentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Lecturer */}
          <Route
            path="/lecturer/marks"
            element={
              <ProtectedRoute allowedRoles={["LECTURER"]}>
                <MarksEntryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/attendance"
            element={
              <ProtectedRoute allowedRoles={["LECTURER"]}>
                <AttendanceMarkingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/announcements"
            element={
              <ProtectedRoute allowedRoles={["LECTURER"]}>
                <AnnouncementsPage navItems={LECTURER_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/*"
            element={
              <ProtectedRoute allowedRoles={["LECTURER"]}>
                <LecturerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Finance */}
          <Route
            path="/finance/create-fee"
            element={
              <ProtectedRoute allowedRoles={["FINANCE", "SUPER_ADMIN"]}>
                <CreateFeePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/verification"
            element={
              <ProtectedRoute allowedRoles={["FINANCE", "SUPER_ADMIN"]}>
                <PaymentVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/reports"
            element={
              <ProtectedRoute allowedRoles={["FINANCE"]}>
                <ReportsPage navItems={FINANCE_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/*"
            element={
              <ProtectedRoute allowedRoles={["FINANCE"]}>
                <FinanceDashboard />
              </ProtectedRoute>
            }
          />

          {/* Academic Admin */}
          <Route
            path="/academic/registration"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN", "SUPER_ADMIN"]}>
                <StudentRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/students"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN", "SUPER_ADMIN"]}>
                <StudentsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/classes"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN", "SUPER_ADMIN"]}>
                <ClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/results"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN", "SUPER_ADMIN"]}>
                <ResultsReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/announcements"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN"]}>
                <AnnouncementsPage navItems={ACADEMIC_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/reports"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN"]}>
                <ReportsPage navItems={ACADEMIC_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/*"
            element={
              <ProtectedRoute allowedRoles={["ACADEMIC_ADMIN"]}>
                <AcademicDashboard />
              </ProtectedRoute>
            }
          />

          {/* Management */}
          <Route
            path="/management/reports"
            element={
              <ProtectedRoute allowedRoles={["MANAGEMENT"]}>
                <ReportsPage navItems={MANAGEMENT_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/management/announcements"
            element={
              <ProtectedRoute allowedRoles={["MANAGEMENT"]}>
                <AnnouncementsPage navItems={MANAGEMENT_NAV} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/management/*"
            element={
              <ProtectedRoute allowedRoles={["MANAGEMENT"]}>
                <ManagementDashboard />
              </ProtectedRoute>
            }
          />

          {/* Super Admin */}
          <Route
            path="/admin/structure"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <InstitutionSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
