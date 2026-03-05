import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                // make sure we have a valid role property (previous versions omitted it)
                if (parsed && typeof parsed.role === 'string' && parsed.role.length > 0) {
                    setToken(savedToken);
                    setUser(parsed);
                } else {
                    // corrupt or legacy user object; clear everything to avoid redirect loops
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

    const login = (userData, jwtToken) => {
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        // require both token and a recognized role to be considered authenticated
        isAuthenticated: !!token && !!user?.role,
        isAdmin: user?.role === 'admin',
        isSuperAdmin: user?.role === 'super_admin',
        isTeacher: user?.role === 'teacher',
        isStudent: user?.role === 'student',
        isAdminOrTeacher: user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'super_admin'
    };

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
