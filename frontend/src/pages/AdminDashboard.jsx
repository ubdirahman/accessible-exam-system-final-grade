import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalExams: 0,
        activeExams: 0,
        totalStudents: 0,
        totalAttempts: 0,
        chartData: []
    });
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState("");

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [examsRes, studentsRes] = await Promise.all([
                api.get('/exams'),
                api.get('/exams/students')
            ]);

            const exams = examsRes.data;
            const students = studentsRes.data;

            const totalAttempts = exams.reduce((sum, e) => sum + (e.examCodes?.filter(c => c.used).length || 0), 0);

            // Prepare Chart Data (Top 5 exams by participation)
            const chartData = exams
                .map(e => ({
                    name: e.title.length > 15 ? e.title.substring(0, 12) + '...' : e.title,
                    fullName: e.title,
                    count: e.examCodes?.filter(c => c.used).length || 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            setStats({
                totalExams: exams.length,
                activeExams: exams.filter(e => e.active).length,
                totalStudents: students.length,
                totalAttempts,
                chartData
            });

            // Generate Analysis
            generateAnalysis(exams, totalAttempts, students.length);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateAnalysis = (exams, attempts, studentCount) => {
        const activePercent = exams.length > 0 ? Math.round((exams.filter(e => e.active).length / exams.length) * 100) : 0;
        const avgAttempts = studentCount > 0 ? (attempts / studentCount).toFixed(1) : 0;

        let text = `Currently, ${activePercent}% of your exams are active. `;
        if (attempts > 0) {
            text += `Students are averaging ${avgAttempts} exam attempts each. `;
        }
        if (exams.length > 5 && attempts < 10) {
            text += `System activity is low relative to the number of exams; consider promoting active sessions. `;
        } else if (attempts > studentCount * 2) {
            text += `High engagement detected! Students are actively participating in multiple exams. `;
        } else {
            text += `Engagement levels are stable across the registered student base. `;
        }

        setAnalysis(text);
    };

    if (loading) return <div className="spinner"></div>;

    const maxChartVal = Math.max(...stats.chartData.map(d => d.count), 5);

    return (
        <div className="fade-in">
            <h1 className="mb-md" style={{ fontWeight: 800 }}>System Overview</h1>

            {/* Top Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.totalExams}</div>
                    <div className="stat-label">Total Exams</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.activeExams}</div>
                    <div className="stat-label">Active Exams</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.totalStudents}</div>
                    <div className="stat-label">Registered Students</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.totalAttempts}</div>
                    <div className="stat-label">Total participations</div>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', marginTop: 32 }}>
                {/* Visual Chart (Custom SVG Bar Chart) */}
                <div className="card">
                    <h3 className="mb-md">📊 Exam Participation (Top 5)</h3>
                    <div style={{ height: 250, padding: '20px 10px', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
                        {stats.chartData.length > 0 ? stats.chartData.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: '100%',
                                    height: `${(d.count / maxChartVal) * 180}px`,
                                    background: 'var(--accent-gradient)',
                                    borderRadius: '4px 4px 0 0',
                                    position: 'relative',
                                    transition: 'height 0.5s ease-out'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        top: -25,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontWeight: 700,
                                        fontSize: 12
                                    }}>{d.count}</span>
                                </div>
                                <span style={{ fontSize: 10, textAlign: 'center', height: 30, overflow: 'hidden' }} title={d.fullName}>
                                    {d.name}
                                </span>
                            </div>
                        )) : (
                            <div className="text-muted text-center" style={{ width: '100%', paddingBottom: 100 }}>No data yet</div>
                        )}
                    </div>
                </div>

                {/* Analysis Card */}
                <div className="card">
                    <h3 className="mb-md">🧠 System Analysis</h3>
                    <div className="badge badge-info" style={{ marginBottom: 16 }}>Live Insights</div>
                    <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                        {analysis}
                    </p>
                    <div className="flex gap-sm mt-lg">
                        <div style={{ flex: 1, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Health</div>
                            <div style={{ fontSize: 14 }}>Optimum</div>
                        </div>
                        <div style={{ flex: 1, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>Security</div>
                            <div style={{ fontSize: 14 }}>Active</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
