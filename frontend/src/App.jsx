import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import AdminDashboard from './pages/AdminDashboard';
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

            {/* Admin routes */}
            <Route path="/admin/dashboard" element={
                <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/create-exam" element={
                <ProtectedRoute role="admin"><ExamCreator /></ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
                <ProtectedRoute role="admin"><ReportsPage /></ProtectedRoute>
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
