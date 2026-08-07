import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);
const KNOWN_ROLES = new Set(['student', 'teacher', 'admin', 'super_admin']);

export function normalizeRole(role) {
    if (typeof role !== 'string') return '';

    let normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'superadmin') normalized = 'super_admin';
    return KNOWN_ROLES.has(normalized) ? normalized : '';
}

export function normalizeUser(userData) {
    if (!userData || typeof userData !== 'object') {
        return null;
    }

    const normalizedRole = normalizeRole(userData.role);
    if (!normalizedRole) {
        return null;
    }

    return {
        ...userData,
        role: normalizedRole
    };
}

export function getDefaultRouteForRole(role) {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'student') return '/student/dashboard';
    if (normalizedRole === 'teacher') return '/teacher/dashboard';
    if (normalizedRole === 'admin' || normalizedRole === 'super_admin') return '/admin/dashboard';

    return '';
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                const parsed = normalizeUser(JSON.parse(savedUser));
                if (parsed) {
                    setToken(savedToken);
                    setUser(parsed);
                } else {
                    // Corrupt or legacy auth data can trigger redirect loops, so clear it.
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            } catch (e) {
                console.warn('Failed to parse saved user, clearing auth storage', e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }

        setLoading(false);
    }, []);

    const login = useCallback((userData, jwtToken) => {
        const normalizedUser = normalizeUser(userData);

        if (!normalizedUser) {
            throw new Error('Cannot log in without a recognized user role.');
        }

        setUser(normalizedUser);
        setToken(jwtToken);
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }, []);

    const value = useMemo(() => ({
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token && !!normalizeRole(user?.role),
        isAdmin: normalizeRole(user?.role) === 'admin',
        isSuperAdmin: normalizeRole(user?.role) === 'super_admin',
        isTeacher: normalizeRole(user?.role) === 'teacher',
        isStudent: normalizeRole(user?.role) === 'student',
        isAdminOrTeacher: ['admin', 'teacher', 'super_admin'].includes(normalizeRole(user?.role))
    }), [user, token, loading, login, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
