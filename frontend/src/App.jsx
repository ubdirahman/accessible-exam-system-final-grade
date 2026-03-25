import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout'; // [NEW]
import AdminSemesters from './pages/AdminSemesters';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import AdminExams from './pages/AdminExams'; // [NEW]
import AdminStudents from './pages/AdminStudents'; // [NEW]
import AdminTeachers from './pages/AdminTeachers';
import AdminDashboard from './pages/AdminDashboard'; // [NEW]
import AdminFaculties from './pages/AdminFaculties';
import AdminClasses from './pages/AdminClasses';
import AdminSubjects from './pages/AdminSubjects';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherExams from './pages/TeacherExams';
import TeacherExamResponses from './pages/TeacherExamResponses';
import ExamCreator from './pages/ExamCreator';
import ReportsPage from './pages/ReportsPage';

function AppRoutes() {
    const { isAuthenticated, user, loading } = useAuth();

    // Don't render routes until auth initialization completes;
    // this prevents transient redirect loops when token exists but user hasn't been validated.
    if (loading) {
        return null; // could show a spinner if desired
    }

    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={
                // if somehow we lost the role information, bounce to login instead of guessing
                isAuthenticated && user?.role
                    ? (
                        <Navigate
                            to={
                                user.role === 'super_admin'
                                    ? '/admin/dashboard'
                                    : user.role === 'admin'
                                        ? '/admin/dashboard'
                                        : user.role === 'teacher'
                                            ? '/teacher/dashboard'
                                            : '/student/dashboard'
                            }
                            replace
                        />
                    ) : <LoginPage />
            } />

            {/* Student routes */}
            <Route path="/student/dashboard" element={
                <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
            } />
            <Route path="/student/exam" element={
                <ProtectedRoute role="student"><ExamPage /></ProtectedRoute>
            } />
            <Route path="/student/result" element={
                <ProtectedRoute role="student"><ResultPage /></ProtectedRoute>
            } />

            {/* Admin routes with Layout */}
            <Route path="/admin" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout>
                        <Navigate to="/admin/dashboard" replace />
                    </AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/dashboard" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminDashboard /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/exams" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminExams /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminStudents /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/teachers" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminTeachers /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/faculties" element={
                <ProtectedRoute roles={['super_admin']}>
                    <AdminLayout><AdminFaculties /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/classes" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminClasses /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/semesters" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminSemesters /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/subjects" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><AdminSubjects /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/create-exam" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><ExamCreator /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><ReportsPage /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/exams/:id/responses" element={
                <ProtectedRoute roles={['admin', 'super_admin']}>
                    <AdminLayout><TeacherExamResponses /></AdminLayout>
                </ProtectedRoute>
            } />

            {/* Teacher routes (reuse layout) */}
            <Route path="/teacher" element={
                <ProtectedRoute role="teacher">
                    <AdminLayout>
                        <Navigate to="/teacher/dashboard" replace />
                    </AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/teacher/dashboard" element={
                <ProtectedRoute role="teacher">
                    <AdminLayout><TeacherDashboard /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/teacher/exams" element={
                <ProtectedRoute role="teacher">
                    <AdminLayout><TeacherExams /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/teacher/create-exam" element={
                <ProtectedRoute role="teacher">
                    <AdminLayout><ExamCreator /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/teacher/exams/:id/responses" element={
                <ProtectedRoute role="teacher">
                    <AdminLayout><TeacherExamResponses /></AdminLayout>
                </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <ExamProvider>
                    <AppRoutes />
                </ExamProvider>
            </AuthProvider>
        </Router>
    );
}
