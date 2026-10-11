import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EmptyState from './EmptyState.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // TEMPORARY: redirects to the dev-login shim. Point this at /login once
    // requirement 1 (team A1) lands.
    return <Navigate to="/dev-login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length && !roles.includes(user?.role)) {
    return (
      <EmptyState
        title="You do not have access to this page"
        message={`This page is for: ${roles.join(', ')}. You are signed in as ${user?.role}.`}
      />
    );
  }

  return children;
}
