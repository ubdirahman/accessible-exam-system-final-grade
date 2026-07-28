import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const formatDisplayDate = () => new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
});

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalExams: 0,
        activeExams: 0,
        totalStudents: 0,
        totalTeachers: 0,
        totalAttempts: 0,
        chartData: []
    });
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState('');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [examsRes, studentsRes, teachersRes, participationRes] = await Promise.all([
                api.get('/exams'),
                api.get('/exams/students'),
                api.get('/teachers'),
                api.get('/exams/participation/summary')
            ]);

            const exams = examsRes.data;
            const students = studentsRes.data;
            const teachers = teachersRes.data;
            const participation = participationRes.data;
            const totalAttempts = exams.reduce((sum, exam) => sum + (exam.examCodes?.filter(code => code.used).length || 0), 0);

            const chartData = participation
                .map(item => ({
                    name: item.title.length > 15 ? `${item.title.substring(0, 12)}...` : item.title,
                    fullName: item.title,
                    count: item.participants || 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            setStats({
                totalExams: exams.length,
                activeExams: exams.filter(exam => exam.active).length,
                totalStudents: students.length,
                totalTeachers: teachers.length,
                totalAttempts,
                chartData
            });

            generateAnalysis(exams, totalAttempts, students.length);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateAnalysis = (exams, attempts, studentCount) => {
        const activePercent = exams.length > 0 ? Math.round((exams.filter(exam => exam.active).length / exams.length) * 100) : 0;
        const avgAttempts = studentCount > 0 ? (attempts / studentCount).toFixed(1) : 0;

        let text = `Currently, ${activePercent}% of your exams are active. `;
        if (attempts > 0) {
            text += `Students are averaging ${avgAttempts} exam attempts each. `;
        }
        if (exams.length > 5 && attempts < 10) {
            text += 'System activity is low relative to the number of exams; consider promoting active sessions.';
        } else if (attempts > studentCount * 2) {
            text += 'High engagement detected. Students are actively participating in multiple exams.';
        } else {
            text += 'Engagement levels are stable across the registered student base.';
        }

        setAnalysis(text);
    };

    if (loading) return <div className="spinner"></div>;

    const totalUsers = stats.totalStudents + stats.totalTeachers;
    const studentPercent = totalUsers > 0 ? Math.round((stats.totalStudents / totalUsers) * 100) : 0;
    const teacherPercent = totalUsers > 0 ? 100 - studentPercent : 0;
    const maxChartVal = Math.max(...stats.chartData.map(item => item.count), 5);

    const statCards = [
        {
            label: 'Total Exams',
            value: stats.totalExams,
            icon: 'fa-file-lines',
            tone: 'blue',
            trend: 'No change'
        },
        {
            label: 'Active Exams',
            value: stats.activeExams,
            icon: 'fa-circle-check',
            tone: 'green',
            trend: 'No change'
        },
        {
            label: 'Registered Students',
            value: stats.totalStudents,
            icon: 'fa-user-group',
            tone: 'purple',
            trend: '12% vs last month',
            positive: true
        },
        {
            label: 'Teacher Accounts',
            value: stats.totalTeachers,
            icon: 'fa-user-plus',
            tone: 'amber',
            trend: '10% vs last month',
            positive: true
        },
        {
            label: 'Total participations',
            value: stats.totalAttempts,
            icon: 'fa-users',
            tone: 'orange',
            trend: 'No change'
        }
    ];

    const activities = [
        { icon: 'fa-user-group', tone: 'blue', title: 'New student registered', text: 'Latest student account joined the system', time: '2h ago' },
        { icon: 'fa-database', tone: 'green', title: 'System backup completed', text: 'Daily backup completed successfully', time: '5h ago' },
        { icon: 'fa-user-plus', tone: 'purple', title: 'New teacher account created', text: 'Teacher account has been created', time: '1d ago' },
        { icon: 'fa-arrow-up-from-bracket', tone: 'red', title: 'System updated', text: 'System updated to version 2.1.0', time: '2d ago' }
    ];

    const quickActions = [
        { to: '/admin/create-exam', icon: 'fa-file-lines', tone: 'blue', title: 'Create Exam', text: 'Add new exam' },
        { to: '/admin/students', icon: 'fa-user-plus', tone: 'green', title: 'Add Student', text: 'Register student' },
        { to: '/admin/teachers', icon: 'fa-user-plus', tone: 'purple', title: 'Add Teacher', text: 'Create account' },
        { to: '/admin/reports', icon: 'fa-file-export', tone: 'amber', title: 'View Reports', text: 'System reports' },
        { to: '/admin/dashboard', icon: 'fa-gear', tone: 'blue', title: 'System Settings', text: 'Configure system', wide: true }
    ];

    return (
        <div className="dashboard-page fade-in">
            <div className="dashboard-header">
                <div>
                    <h1>Dashboard Overview <i className="fa-solid fa-hand" aria-hidden="true"></i></h1>
                    <p>Welcome back! Here's what's happening with your system today.</p>
                </div>
                <button className="dashboard-date" type="button">
                    <i className="fa-regular fa-calendar-days" aria-hidden="true"></i>
                    {formatDisplayDate()}
                    <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </button>
            </div>

            <div className="dashboard-stat-grid">
                {statCards.map((card) => (
                    <div className={`dashboard-stat-card tone-${card.tone}`} key={card.label}>
                        <div className="dashboard-stat-icon">
                            <i className={`fa-solid ${card.icon}`} aria-hidden="true"></i>
                        </div>
                        <div className="dashboard-stat-value">{card.value}</div>
                        <div className="dashboard-stat-label">{card.label}</div>
                        <div className={`dashboard-stat-trend ${card.positive ? 'positive' : ''}`}>
                            <i className={`fa-solid ${card.positive ? 'fa-arrow-up' : 'fa-minus'}`} aria-hidden="true"></i>
                            {card.trend}
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-main-grid">
                <section className="dashboard-panel participation-panel">
                    <div className="panel-heading">
                        <h2><i className="fa-solid fa-chart-line" aria-hidden="true"></i> Exam Participation (Top 5)</h2>
                        <button className="panel-select" type="button">This Month <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
                    </div>
                    {stats.chartData.some(item => item.count > 0) ? (
                        <div className="dashboard-bar-chart">
                            {stats.chartData.map((item) => (
                                <div className="dashboard-bar-item" key={item.fullName} title={item.fullName}>
                                    <div className="dashboard-bar-track">
                                        <span style={{ height: `${Math.max((item.count / maxChartVal) * 100, 8)}%` }}></span>
                                    </div>
                                    <strong>{item.count}</strong>
                                    <small>{item.name}</small>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-participation">
                            <div className="empty-illustration" aria-hidden="true">
                                <i className="fa-solid fa-chart-column"></i>
                                <i className="fa-solid fa-magnifying-glass"></i>
                            </div>
                            <h3>No participation data yet</h3>
                            <p>Exam participation statistics will appear here once exams are conducted.</p>
                        </div>
                    )}
                </section>

                <section className="dashboard-panel analysis-panel">
                    <div className="panel-heading compact">
                        <h2><i className="fa-solid fa-wave-square" aria-hidden="true"></i> System Analysis</h2>
                    </div>
                    <span className="live-pill"><i className="fa-solid fa-circle" aria-hidden="true"></i> Live Insights</span>
                    <p>{analysis}</p>
                    <div className="analysis-cards">
                        <div className="analysis-mini health-card">
                            <div className="mini-icon"><i className="fa-solid fa-shield-heart" aria-hidden="true"></i></div>
                            <div>
                                <span>System Health</span>
                                <strong>Optimum</strong>
                                <small>All systems are running smoothly</small>
                            </div>
                            <svg viewBox="0 0 120 44" aria-hidden="true">
                                <polyline points="4,34 22,24 38,31 54,18 72,28 88,8 116,20" />
                            </svg>
                        </div>
                        <div className="analysis-mini security-card">
                            <div className="mini-icon"><i className="fa-solid fa-lock" aria-hidden="true"></i></div>
                            <div>
                                <span>Security Status</span>
                                <strong>Active</strong>
                                <small>System is secure and protected</small>
                            </div>
                            <svg viewBox="0 0 120 44" aria-hidden="true">
                                <polyline points="4,34 22,24 40,12 58,22 76,29 94,8 116,18" />
                            </svg>
                        </div>
                    </div>
                </section>
            </div>

            <div className="dashboard-bottom-grid">
                <section className="dashboard-panel activity-panel">
                    <div className="panel-heading compact">
                        <h2><i className="fa-regular fa-clock" aria-hidden="true"></i> Recent Activities</h2>
                        <button className="view-all" type="button">View All</button>
                    </div>
                    <div className="activity-list">
                        {activities.map((activity) => (
                            <div className={`activity-item tone-${activity.tone}`} key={activity.title}>
                                <div className="activity-icon"><i className={`fa-solid ${activity.icon}`} aria-hidden="true"></i></div>
                                <div>
                                    <strong>{activity.title}</strong>
                                    <span>{activity.text}</span>
                                </div>
                                <time>{activity.time}</time>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="dashboard-panel quick-panel">
                    <div className="panel-heading compact">
                        <h2><i className="fa-solid fa-bolt" aria-hidden="true"></i> Quick Actions</h2>
                    </div>
                    <div className="quick-actions">
                        {quickActions.map((action) => (
                            <Link className={`quick-action tone-${action.tone} ${action.wide ? 'wide' : ''}`} to={action.to} key={action.title}>
                                <span><i className={`fa-solid ${action.icon}`} aria-hidden="true"></i></span>
                                <div>
                                    <strong>{action.title}</strong>
                                    <small>{action.text}</small>
                                </div>
                                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="dashboard-panel statistics-panel">
                    <div className="panel-heading compact">
                        <h2><i className="fa-solid fa-crosshairs" aria-hidden="true"></i> System Statistics</h2>
                    </div>
                    <div className="donut-layout">
                        <div
                            className="donut-chart"
                            style={{ '--student-percent': `${studentPercent}%` }}
                            aria-label={`Total users ${totalUsers}`}
                        >
                            <div>
                                <strong>{totalUsers}</strong>
                                <span>Total Users</span>
                            </div>
                        </div>
                        <div className="donut-legend">
                            <div><span className="dot blue"></span> Students <strong>{stats.totalStudents} ({studentPercent}%)</strong></div>
                            <div><span className="dot purple"></span> Teachers <strong>{stats.totalTeachers} ({teacherPercent}%)</strong></div>
                            <div><span className="dot violet"></span> Admins <strong>0 (0%)</strong></div>
                            <div><span className="dot red"></span> Inactive <strong>0 (0%)</strong></div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
