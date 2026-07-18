export default function StatCard({ icon, value, label, color = 'green' }) {
  const colorMap = {
    green: 'var(--primary-500)',
    blue:  'var(--info)',
    yellow: 'var(--warning)',
    red:   'var(--danger)',
  };

  return (
    <div style={{ ...styles.card, borderLeftColor: colorMap[color] }}>
      <div style={styles.icon}>{icon}</div>
      <div style={styles.value}>{value}</div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

const styles = {
  card: {
    background: 'white', borderRadius: 'var(--radius-lg)', padding: 20,
    borderLeft: '4px solid', boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border)',
  },
  icon: { fontSize: '1.4rem', marginBottom: 8 },
  value: { fontSize: '2rem', fontWeight: 700, color: 'var(--primary-900)' },
  label: { fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 2 },
};
