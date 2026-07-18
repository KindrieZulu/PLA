import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [regData, setRegData] = useState({ firstName: '', lastName: '', classCode: '' });
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ username, password, ...regData });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div className="card fade-in" style={styles.card}>
        <h1 style={styles.title}>🎓 PLA</h1>
        <p style={styles.subtitle}>Personalised Learning Assistant</p>

        {error && <div style={styles.error}>{error}</div>}

        {!isRegister ? (
          <form onSubmit={handleLogin}>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" autoFocus required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p style={styles.switch}>
              Don't have an account?{' '}
              <button type="button" onClick={() => setIsRegister(true)} style={styles.link}>Register</button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={styles.field}>
                <label style={styles.label}>First Name</label>
                <input className="input" value={regData.firstName} onChange={(e) => setRegData({ ...regData, firstName: e.target.value })} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Last Name</label>
                <input className="input" value={regData.lastName} onChange={(e) => setRegData({ ...regData, lastName: e.target.value })} required />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password (min 8 chars)</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Class Code</label>
              <input className="input" value={regData.classCode} onChange={(e) => setRegData({ ...regData, classCode: e.target.value.toUpperCase() })} placeholder="e.g. FORM1A" required />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
            <p style={styles.switch}>
              Already have an account?{' '}
              <button type="button" onClick={() => setIsRegister(false)} style={styles.link}>Sign In</button>
            </p>
          </form>
        )}

        <div style={styles.hint}>
          <strong>Demo:</strong> Ask your teacher for login credentials<br />
          Class code: <strong>FORM1A</strong>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a2e1a 0%, #14522e 50%, #0a2e1a 100%)', padding: 20,
  },
  card: { width: 420, maxWidth: '100%', padding: '40px 36px', borderRadius: 'var(--radius-xl)' },
  title: { textAlign: 'center', color: 'var(--primary-900)', fontSize: '1.8rem', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: 'var(--gray-500)', marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: 5, color: 'var(--gray-700)' },
  error: { background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', marginBottom: 16, border: '1px solid #fecaca' },
  switch: { textAlign: 'center', marginTop: 16, fontSize: '0.88rem', color: 'var(--gray-500)' },
  link: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' },
  hint: { textAlign: 'center', marginTop: 20, fontSize: '0.82rem', color: 'var(--gray-400)', lineHeight: 1.6 },
};
