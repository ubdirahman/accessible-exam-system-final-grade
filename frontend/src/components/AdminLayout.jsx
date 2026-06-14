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

    // Cusboonaysiin toos ah (Automatic Update) 30-kii ilbiriqsiba mar
    useAutoUpdate(fetchClass, 30000);

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
            ? 'fa-solid fa-compass'
            : 'fa-solid fa-shield-halved';

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
        // faculty admin
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
        <div className="page admin-shell">
            {/* Sidebar on the left */}
            <aside className="admin-sidebar">
                <div className="navbar-brand sidebar-brand">
                    <span className="icon" aria-hidden="true">
                        <i className={brandIcon}></i>
                    </span>
                    <div>
                        <div className="sidebar-title">
                            {user?.role === 'teacher'
                                ? 'Teacher Portal'
                                : user?.role === 'super_admin'
                                    ? 'Super Admin'
                                    : 'Faculty Admin IT'}
                        </div>
                        <div className="sidebar-subtitle">
                            {user?.name || 'User'} 
                            {user?.role === 'teacher' && (myClass || user?.classId?.name) && (
                                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                                    <i className="fa-solid fa-graduation-cap"></i> {myClass?.name || user.classId.name || 'Assigned Class'}
                                </div>
                            )}
                        </div>
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
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content area on the right */}
            <div className="admin-main">
                <main className="fade-in">
                    {children}
                </main>
            </div>
            {confirmDialog}
        </div>
    );
}
