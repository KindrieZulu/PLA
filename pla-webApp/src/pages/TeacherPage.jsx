import { useState, useEffect } from 'react';
import api from '../api/api';
import StatCard from '../components/StatCard';
import ProgressBar from '../components/ProgressBar';

export default function TeacherPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/students')
      .then(res => setStudents(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={styles.header}>
        <h1 style={styles.title}>👩‍🏫 Teacher Dashboard</h1>
        <p style={styles.subtitle}>Class overview and student tracking</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="👥" value={students.length} label="Students" color="blue" />
        <StatCard icon="📊" value="—" label="Avg Mastery" color="green" />
        <StatCard icon="⚠️" value="—" label="Need Support" color="yellow" />
        <StatCard icon="🌟" value="—" label="Ahead" color="green" />
      </div>

      <div className="card">
        <h3 style={styles.cardTitle}>📋 Student Overview</h3>
        {students.length > 0 ? (
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Student</th><th>Username</th><th>Grade</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.student_id}>
                  <td style={{ fontWeight: 500 }}>{s.first_name} {s.last_name}</td>
                  <td>{s.username}</td>
                  <td>{s.grade_level}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-secondary btn-sm">View Profile</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--gray-500)', marginTop: 12 }}>No students enrolled yet.</p>
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={styles.cardTitle}>⚡ Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm">📋 Assign Diagnostic Test</button>
            <button className="btn btn-secondary btn-sm">📊 Generate Class Report</button>
            <button className="btn btn-secondary btn-sm">📚 Manage Content</button>
          </div>
        </div>
        <div className="card">
          <h3 style={styles.cardTitle}>📊 Class Performance</h3>
          <p style={{ color: 'var(--gray-500)', marginTop: 12 }}>Performance charts will appear here once students start practicing.</p>
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
};
