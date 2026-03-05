import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role, roles }) {
    const { isAuthenticated, user, loading, isAdminOrTeacher, logout } = useAuth();

    // during initial auth check we don't render anything busy state
    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    // side‑effect: if we somehow end up authenticated without a role clear the session
    // and let the subsequent render perform the navigation. doing this in a useEffect
    // prevents a state update during render which caused the "maximum update depth"
    // warning (logout() triggers state change and triggered ProtectedRoute again).
    useEffect(() => {
        if (isAuthenticated && !user?.role) {
            console.warn('Authenticated user has no role, clearing session');
            logout && logout();
        }
    }, [isAuthenticated, user?.role, logout]);

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // after the effect runs the auth state will be reset; short‑circuit until that
    // happens so we don't try to evaluate additional role checks on a bogus user.
    if (!user?.role) {
        return null;
    }

    // single role value (legacy) or multiple roles
    if (role && user?.role !== role) {
        return <Navigate to="/" replace />;
    }
    if (roles && !roles.includes(user?.role)) {
        return <Navigate to="/" replace />;
    }

    // special shorthand for admin/teacher combos
    if (roles === 'adminOrTeacher' && !isAdminOrTeacher) {
        return <Navigate to="/" replace />;
    }

    return children;
}
