import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ToastProvider } from './Toast.jsx';
import Button from './Button.jsx';

export default function Layout() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/dev-login', { replace: true });
  }

  return (
    <ToastProvider>
      {/* TEMPORARY banner - remove with the dev-login shim (requirement 1). */}
      <div className="dev-banner">
        Development build - sign-in uses the temporary dev shim until requirement 1 (login) is implemented.
      </div>
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          Bobos <span>Schedules</span>
        </Link>
        <nav className="app-header__nav">
          <NavLink to="/" end>Home</NavLink>
          {user?.role === 'coordinator' || user?.role === 'administrator' ? (
            <NavLink to="/coordinator/assign-groups">Assign schedule groups</NavLink>
          ) : null}
          {/* requirement 31 */}
          {user?.role === 'student' ? <NavLink to="/schedule">My schedule</NavLink> : null}
          {/* requirement 32 */}
          {user?.role === 'student' ? <NavLink to="/courses">My courses</NavLink> : null}
          {['advisor', 'coordinator', 'administrator'].includes(user?.role) ? (
            <NavLink to="/schedules">Student schedules</NavLink>
          ) : null}
        </nav>
        <div className="app-header__spacer" />
        {isAuthenticated ? (
          <>
            <div className="app-header__user">
              <strong>{user?.fullName}</strong>
              <small>{user?.role}</small>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <Link className="btn btn--sm" to="/dev-login">Sign in</Link>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
    </ToastProvider>
  );
}
