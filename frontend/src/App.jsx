import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout'; // [NEW]
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import AdminExams from './pages/AdminExams'; // [NEW]
import AdminStudents from './pages/AdminStudents'; // [NEW]
import AdminDashboard from './pages/AdminDashboard'; // [NEW]
import ExamCreator from './pages/ExamCreator';
import ReportsPage from './pages/ReportsPage';

function AppRoutes() {
    const { isAuthenticated, user } = useAuth();

    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={
                isAuthenticated
                    ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
                    : <LoginPage />
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
                <ProtectedRoute role="admin">
                    <AdminLayout>
                        <Navigate to="/admin/dashboard" replace />
                    </AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/dashboard" element={
                <ProtectedRoute role="admin">
                    <AdminLayout><AdminDashboard /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/exams" element={
                <ProtectedRoute role="admin">
                    <AdminLayout><AdminExams /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
                <ProtectedRoute role="admin">
                    <AdminLayout><AdminStudents /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/create-exam" element={
                <ProtectedRoute role="admin">
                    <AdminLayout><ExamCreator /></AdminLayout>
                </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
                <ProtectedRoute role="admin">
                    <AdminLayout><ReportsPage /></AdminLayout>
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
