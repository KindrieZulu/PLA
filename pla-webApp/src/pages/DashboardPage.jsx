import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import StatCard from '../components/StatCard';
import ProgressBar from '../components/ProgressBar';

export default function DashboardPage() {
  const { user } = useAuth();
  const [mastery, setMastery] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mastery').then(res => setMastery(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>;

  const total = mastery.length;
  const mastered = mastery.filter(m => m.mastery_probability >= 0.8).length;
  const inProgress = mastery.filter(m => m.mastery_probability >= 0.5 && m.mastery_probability < 0.8).length;
  const avg = total ? Math.round(mastery.reduce((a, m) => a + parseFloat(m.mastery_probability), 0) / total * 100) : 0;
  const weakest = [...mastery].sort((a, b) => a.mastery_probability - b.mastery_probability).slice(0, 3);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={styles.header}>
        <h1 style={styles.title}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.firstName}! 👋</h1>
        <p style={styles.subtitle}>Here's your learning progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="🎯" value={mastered} label="Skills Mastered" color="green" />
        <StatCard icon="📈" value={inProgress} label="In Progress" color="blue" />
        <StatCard icon="🧠" value={`${avg}%`} label="Avg Mastery" color="yellow" />
        <StatCard icon="🔥" value={total} label="Skills Tracked" color="red" />
      </div>

      <div className="grid grid-2">
        {/* Continue learning */}
        <div className="card">
          <h3 style={styles.cardTitle}>🎯 Continue Learning</h3>
          {weakest.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              {weakest.map(s => (
                <div key={s.skill_id} style={styles.skillRow}>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{s.skill_name}</span>
                  <div style={{ width: 120 }}><ProgressBar value={s.mastery_probability * 100} color={s.mastery_probability >= 0.5 ? 'blue' : 'red'} /></div>
                </div>
              ))}
              <Link to="/practice" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Start Practice →</Link>
            </div>
          ) : (
            <p style={{ color: 'var(--gray-500)', marginTop: 12 }}>No data yet. Start a practice session!</p>
          )}
        </div>

        {/* Mastery chart */}
        <div className="card">
          <h3 style={styles.cardTitle}>📊 Mastery Overview</h3>
          <div style={styles.chart}>
            {mastery.slice(0, 6).map((s, i) => {
              const pct = Math.round(s.mastery_probability * 100);
              const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--info)' : pct >= 30 ? 'var(--warning)' : 'var(--danger)';
              return (
                <div key={i} style={styles.barWrapper}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{pct}%</span>
                  <div style={{ ...styles.bar, height: `${Math.max(pct, 5)}%`, background: color }} />
                  <span style={styles.barLabel}>{s.skill_name?.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={styles.cardTitle}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <Link to="/practice" className="btn btn-primary">✏️ Start Practice</Link>
          <Link to="/mastery" className="btn btn-secondary">🧠 View Mastery Map</Link>
          <Link to="/materials" className="btn btn-secondary">📚 Study Materials</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { marginBottom: 24 },
  title: { fontSize: '1.7rem', color: 'var(--primary-900)' },
  subtitle: { color: 'var(--gray-500)', marginTop: 4 },
  cardTitle: { fontSize: '1rem', color: 'var(--gray-800)', marginBottom: 12 },
  skillRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, padding: '12px 0' },
  barWrapper: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: '6px 6px 0 0', minHeight: 4 },
  barLabel: { fontSize: '0.7rem', color: 'var(--gray-500)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 },
};
