import ProgressBar from './ProgressBar';

export default function MasteryMap({ skills }) {
  if (!skills || skills.length === 0) {
    return <p style={{ color: 'var(--gray-500)' }}>No mastery data yet. Start practicing!</p>;
  }

  return (
    <div>
      {skills.map((skill, i) => {
        const pct = Math.round((skill.mastery_probability || 0) * 100);
        const color = pct >= 80 ? 'green' : pct >= 50 ? 'blue' : pct >= 30 ? 'yellow' : 'red';
        const status = pct >= 80 ? '✅ Mastered' : pct >= 50 ? '📈 In Progress' : pct >= 30 ? '🔄 Developing' : '💡 Needs Support';
        const dot = pct >= 80 ? '🟢' : pct >= 50 ? '🔵' : pct >= 30 ? '🟡' : '🔴';

        return (
          <div key={skill.skill_id || i} style={styles.row}>
            <span style={{ fontSize: '1.1rem' }}>{dot}</span>
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{skill.skill_name}</div>
              <div style={styles.meta}>{status} · θ={parseFloat(skill.theta_estimate || 0).toFixed(1)}</div>
            </div>
            <div style={{ width: 160 }}>
              <ProgressBar value={pct} color={color} />
            </div>
            <span style={{ ...styles.pct, color: color === 'green' ? 'var(--success)' : color === 'blue' ? 'var(--info)' : color === 'yellow' ? 'var(--warning)' : 'var(--danger)' }}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 0', borderBottom: '1px solid var(--gray-100)',
  },
  name: { fontWeight: 500, fontSize: '0.92rem' },
  meta: { fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 2 },
  pct: { fontWeight: 700, fontSize: '0.9rem', width: 48, textAlign: 'right' },
};
