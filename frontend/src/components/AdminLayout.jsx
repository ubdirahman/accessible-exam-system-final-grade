import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import useConfirmDialog from '../hooks/useConfirmDialog';

export default function AdminLayout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [myClass, setMyClass] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('aes-theme') || 'light');
    const { confirmDialog, askConfirm } = useConfirmDialog();

    const fetchClass = useCallback(async () => {
        if (user?.role === 'teacher' && user?.classId) {
            try {
                const res = await api.get('/classes/my');
                if (res.data && res.data.length > 0) {
                    setMyClass(res.data[0]);
                }
            } catch (err) {
                console.error('Error fetching teacher class:', err);
            }
        }
    }, [user]);

    useAutoUpdate(fetchClass, 30000);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('aes-theme', theme);
    }, [theme]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        const confirmed = await askConfirm({
            title: 'Logout Confirmation',
            message: 'Are you sure you want to log out of the system?',
            confirmText: 'Yes, Logout',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (confirmed) {
            logout();
            navigate('/');
        }
    };

    const brandIcon = user?.role === 'teacher'
        ? 'fa-solid fa-chalkboard-user'
        : user?.role === 'super_admin'
            ? 'fa-solid fa-graduation-cap'
            : 'fa-solid fa-shield-halved';

    const roleLabel = user?.role === 'teacher'
        ? 'Teacher'
        : user?.role === 'super_admin'
            ? 'Super Admin'
            : 'Faculty Admin';

    const roleSubtitle = user?.role === 'teacher'
        ? 'Class Instructor'
        : user?.role === 'super_admin'
            ? 'System Administrator'
            : 'Faculty Administrator';

    const userInitial = (user?.name || roleLabel || 'U').trim().charAt(0).toUpperCase();

    const navItems = (() => {
        if (user?.role === 'teacher') {
            return [
                { path: '/teacher/dashboard', label: 'Overview', iconClass: 'fa-solid fa-house' },
                { path: '/teacher/exams', label: 'Exams', iconClass: 'fa-solid fa-clipboard-list' },
            ];
        }
        if (user?.role === 'super_admin') {
            return [
                { path: '/admin/dashboard', label: 'Overview', iconClass: 'fa-solid fa-house' },
                { path: '/admin/faculties', label: 'Faculties', iconClass: 'fa-solid fa-building-columns' },
                { path: '/admin/exams', label: 'Exams', iconClass: 'fa-solid fa-clipboard-list' },
                { path: '/admin/students', label: 'Students', iconClass: 'fa-solid fa-user-graduate' },
                { path: '/admin/teachers', label: 'Teachers', iconClass: 'fa-solid fa-chalkboard-user' },
                { path: '/admin/classes', label: 'Class', iconClass: 'fa-solid fa-school' },
                { path: '/admin/semesters', label: 'Semester', iconClass: 'fa-solid fa-calendar' },
                { path: '/admin/result-exam', label: 'Result Exam', iconClass: 'fa-solid fa-table-list' },
                { path: '/admin/recordings', label: 'Recordings', iconClass: 'fa-solid fa-microphone-lines' },
                { path: '/admin/reports', label: 'Reports', iconClass: 'fa-solid fa-chart-column' },
            ];
        }
        return [
            { path: '/admin/dashboard', label: 'Overview', iconClass: 'fa-solid fa-house' },
            { path: '/admin/exams', label: 'Exams', iconClass: 'fa-solid fa-clipboard-list' },
            { path: '/admin/students', label: 'Students', iconClass: 'fa-solid fa-user-graduate' },
            { path: '/admin/teachers', label: 'Teachers', iconClass: 'fa-solid fa-chalkboard-user' },
            { path: '/admin/classes', label: 'Class', iconClass: 'fa-solid fa-school' },
            { path: '/admin/semesters', label: 'Semester', iconClass: 'fa-solid fa-calendar' },
            { path: '/admin/result-exam', label: 'Result Exam', iconClass: 'fa-solid fa-table-list' },
            { path: '/admin/recordings', label: 'Recordings', iconClass: 'fa-solid fa-microphone-lines' },
            { path: '/admin/reports', label: 'Reports', iconClass: 'fa-solid fa-chart-column' },
        ];
    })();

    return (
        <div className={`page admin-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <aside className="admin-sidebar">
                <div className="navbar-brand sidebar-brand">
                    <span className="brand-mark" aria-hidden="true">
                        <img src="/assets/brand/logada.jpg" alt="Profile Logo" className="brand-logo-img" />
                    </span>
                    <div className="sidebar-title">
                        {user?.name || roleLabel}
                        <span>
                            {roleSubtitle}
                            {user?.role === 'teacher' && (myClass || user?.classId?.name) && (
                                ` - ${myClass?.name || user.classId.name}`
                            )}
                        </span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        const active = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`btn btn-ghost ${active ? 'active' : ''}`}
                            >
                                <i className={`nav-icon ${item.iconClass}`} aria-hidden="true"></i>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
                        <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                        Logout
                    </button>
                </div>
            </aside>

            <button
                type="button"
                className="sidebar-scrim"
                aria-label="Close navigation"
                onClick={() => setSidebarOpen(false)}
            />

            <div className="admin-main">
                <header className="admin-topbar">
                    <div className="topbar-left">
                        <button
                            type="button"
                            className="topbar-icon topbar-menu"
                            aria-label="Toggle navigation"
                            onClick={() => setSidebarOpen((open) => !open)}
                        >
                            <i className="fa-solid fa-bars" aria-hidden="true"></i>
                        </button>
                        <label className="topbar-search">
                            <span className="sr-only">Search anything</span>
                            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                            <input type="search" placeholder="Search anything..." />
                            <i className="fa-solid fa-search" aria-hidden="true"></i>
                        </label>
                    </div>
                    <div className="topbar-actions">
                        <button type="button" className="topbar-icon notification-button" aria-label="Notifications">
                            <i className="fa-regular fa-bell" aria-hidden="true"></i>
                            <span>6</span>
                        </button>
                        <button
                            type="button"
                            className="topbar-icon"
                            aria-label="Toggle theme"
                            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                        >
                            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true"></i>
                        </button>
                        <div className="topbar-user">
                            <div className="topbar-avatar" aria-hidden="true">
                                <img src="/assets/brand/logada.jpg" alt="User Profile" className="topbar-profile-img" />
                            </div>
                            <span>{user?.name || roleLabel}</span>
                            <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                        </div>
                    </div>
                </header>

                <main className="admin-content fade-in">
                    {children}
                </main>

                <footer className="admin-footer">
                    &copy; 2025 Accessible Exam System. All rights reserved.
                </footer>
            </div>
            {confirmDialog}
        </div>
    );
}
