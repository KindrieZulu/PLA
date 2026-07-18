import { useState, useEffect } from 'react';
import api from '../api/api';
import MasteryMap from '../components/MasteryMap';

export default function MasteryPage() {
  const [mastery, setMastery] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mastery').then(res => setMastery(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>;

  const total = mastery.length;
  const mastered = mastery.filter(m => m.mastery_probability >= 0.8).length;
  const avg = total ? (mastery.reduce((a, m) => a + parseFloat(m.mastery_probability), 0) / total) : 0;
  const avgTheta = total ? (mastery.reduce((a, m) => a + parseFloat(m.theta_estimate || 0), 0) / total) : 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={styles.header}>
        <h1 style={styles.title}>🧠 Mastery Map</h1>
        <p style={styles.subtitle}>Your skill mastery powered by Bayesian Knowledge Tracing</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={styles.cardTitle}>📊 All Skills</h3>
        <MasteryMap skills={mastery} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={styles.cardTitle}>📈 BKT Model Parameters</h3>
          <div style={{ marginTop: 12 }}>
            {[
              ['P(L₀) — Initial Knowledge', '0.30'],
              ['P(T) — Learning Rate', '0.10'],
              ['P(G) — Guess Probability', '0.20'],
              ['P(S) — Slip Probability', '0.10'],
            ].map(([label, val]) => (
              <div key={label} style={styles.paramRow}>
                <span>{label}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={styles.cardTitle}>🎯 IRT Ability Estimate</h3>
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary-900)' }}>θ = {avgTheta.toFixed(2)}</div>
            <div style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginTop: 4 }}>
              {avgTheta > 0.5 ? 'Above average ability' : avgTheta > -0.5 ? 'Average ability' : 'Developing ability'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
            <span>-3 (Beginner)</span><span>0 (Average)</span><span>+3 (Expert)</span>
          </div>
          <div className="progress-bar" style={{ height: 10, marginTop: 4 }}>
            <div className="progress-fill blue" style={{ width: `${Math.min(100, Math.max(0, (avgTheta + 3) / 6 * 100))}%` }} />
          </div>
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
  paramRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', fontSize: '0.9rem' },
};
