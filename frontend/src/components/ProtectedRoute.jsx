import { Navigate } from 'react-router-dom';
import { getDefaultRouteForRole, normalizeRole, useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role, roles }) {
    const { isAuthenticated, user, loading, isAdminOrTeacher } = useAuth();
    const normalizedRole = normalizeRole(user?.role);
    const normalizedRequiredRole = normalizeRole(role);
    const normalizedRequiredRoles = Array.isArray(roles)
        ? roles.map((item) => normalizeRole(item)).filter(Boolean)
        : [];
    const fallbackRoute = getDefaultRouteForRole(normalizedRole) || '/';

    // While auth is loading, show loading state instead of navigating
    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    // If not authenticated after loading completes, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // If authenticated but missing role (edge case), return null
    // Don't call logout here as it causes state updates that trigger infinite loops
    if (!normalizedRole) {
        console.warn('Authenticated user has no role');
        return <Navigate to="/" replace />;
    }

    // Enforce single role requirement
    if (normalizedRequiredRole && normalizedRole !== normalizedRequiredRole) {
        return <Navigate to={fallbackRoute} replace />;
    }

    // Enforce multiple roles requirement (array of roles)
    if (normalizedRequiredRoles.length > 0 && !normalizedRequiredRoles.includes(normalizedRole)) {
        return <Navigate to={fallbackRoute} replace />;
    }

    // Enforce special admin/teacher combo check
    if (roles === 'adminOrTeacher' && !isAdminOrTeacher) {
        return <Navigate to={fallbackRoute} replace />;
    }

    // All checks passed - render protected component
    return children;
}
