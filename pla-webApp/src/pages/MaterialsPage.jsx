import { useState, useEffect } from 'react';
import api from '../api/api';

const MOCK_MATERIALS = [
  { id: 1, title: 'Place Value Guide', type: 'article', module: 'Whole Numbers', icon: '📖', difficulty: 'easy', desc: 'Learn about place value from ones to millions.' },
  { id: 2, title: 'Fraction Operations', type: 'interactive', module: 'Fractions', icon: '🎮', difficulty: 'medium', desc: 'Practice adding, subtracting, multiplying fractions.' },
  { id: 3, title: 'Introduction to Algebra', type: 'video', module: 'Algebra', icon: '🎬', difficulty: 'medium', desc: 'Understanding variables and expressions.' },
  { id: 4, title: 'BODMAS Rules', type: 'worksheet', module: 'Whole Numbers', icon: '📝', difficulty: 'hard', desc: 'Order of operations practice problems.' },
  { id: 5, title: 'Decimal Operations', type: 'article', module: 'Fractions', icon: '📖', difficulty: 'medium', desc: 'Working with decimal numbers.' },
  { id: 6, title: 'Solving Equations', type: 'interactive', module: 'Algebra', icon: '🎮', difficulty: 'hard', desc: 'Step-by-step equation solving.' },
];

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/materials')
      .then(res => setMaterials(res.data?.length ? res.data : MOCK_MATERIALS))
      .catch(() => setMaterials(MOCK_MATERIALS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={styles.header}>
        <h1 style={styles.title}>📚 Learning Materials</h1>
        <p style={styles.subtitle}>Curated resources for ZIMSEC Form 1 Mathematics</p>
      </div>

      <div className="grid grid-3">
        {materials.map(mat => (
          <div key={mat.id || mat.material_id} className="card" style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>{mat.icon || '📖'}</div>
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{mat.title}</h3>
            <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
              <span className={`badge ${mat.difficulty === 'easy' ? 'badge-success' : mat.difficulty === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
                {mat.difficulty}
              </span>
              <span className="badge badge-info">{mat.type}</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>{mat.desc || mat.description}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: 8 }}>📂 {mat.module}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  header: { marginBottom: 24 },
  title: { fontSize: '1.7rem', color: 'var(--primary-900)' },
  subtitle: { color: 'var(--gray-500)', marginTop: 4 },
};
