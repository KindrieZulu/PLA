import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?';

  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <span style={{ fontSize: '1.3rem' }}>🎓</span>
        <span>PLA</span>
      </div>

      <div style={styles.links}>
        <NavLink to="/dashboard" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}>
          📊 Dashboard
        </NavLink>
        <NavLink to="/practice" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}>
          ✏️ Practice
        </NavLink>
        <NavLink to="/mastery" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}>
          🧠 Mastery
        </NavLink>
        <NavLink to="/materials" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}>
          📚 Materials
        </NavLink>
        {user?.role === 'teacher' && (
          <NavLink to="/teacher" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}>
            👩‍🏫 Teacher
          </NavLink>
        )}
      </div>

      <div style={styles.user}>
        <div style={styles.avatar}>{initials}</div>
        <span style={styles.userName}>{user?.firstName} {user?.lastName}</span>
        <button onClick={handleLogout} style={styles.logout}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    height: 60, background: '#0a2e1a', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  logo: { color: 'white', fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  links: { display: 'flex', gap: 4 },
  link: {
    color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
    padding: '8px 14px', borderRadius: 8, fontSize: '0.88rem', transition: 'all 0.2s',
  },
  linkActive: { background: 'rgba(255,255,255,0.15)', color: 'white' },
  user: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: '#10b981',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: '0.8rem',
  },
  userName: { color: 'white', fontSize: '0.88rem' },
  logout: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer', fontSize: '0.82rem', padding: '4px 8px',
  },
};
