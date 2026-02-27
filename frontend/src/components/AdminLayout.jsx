import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navItems = [
        { path: '/admin/dashboard', label: '🏠 Overview', icon: '🏠' },
        { path: '/admin/exams', label: '📝 Exams', icon: '📝' },
        { path: '/admin/students', label: '🎓 Students', icon: '🎓' },
        { path: '/admin/reports', label: '📊 Reports', icon: '📊' },
    ];

    return (
        <div className="page" style={{ paddingTop: 0 }}>
            {/* Sidebar / Top Nav for Admin */}
            <div className="navbar">
                <div className="navbar-brand">
                    <span className="icon">🛡️</span>
                    Exam Admin
                </div>
                <div className="navbar-actions">
                    <span className="badge badge-info hide-mobile">👤 {user?.name}</span>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            <div className="app-container">
                {/* Admin Sub-navigation Tabs */}
                <div className="section-tabs mt-md">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`section-tab ${location.pathname === item.path ? 'active' : ''}`}
                            style={{ textDecoration: 'none' }}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                <main className="fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
}
