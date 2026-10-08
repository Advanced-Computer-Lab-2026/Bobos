// TEMPORARY DEV LOGIN — delete this page once requirement 1 (login) is
// implemented by team A1, and point ProtectedRoute at the real /login route.
// It lists the seeded accounts and mints a token through POST /api/dev/token,
// with no password check.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import Alert from '../components/Alert.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function DevLogin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/dev/users')
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users || []);
        const coordinator = (data.users || []).find((u) => u.role === 'coordinator');
        setSelected(coordinator ? coordinator.email : (data.users || [])[0]?.email || '');
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn(event) {
    event.preventDefault();
    if (!selected) return;
    setSigningIn(true);
    setError('');
    try {
      const data = await api.post('/dev/token', { email: selected });
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="dev-banner" style={{ marginBottom: '1rem', borderRadius: 6 }}>
        TEMPORARY development sign-in - requirement 1 (login) is not implemented yet
      </div>

      <Card
        title="Bobos - development sign-in"
        subtitle="Pick a seeded account. No password is required; this page disappears once the real login lands."
      >
        <Alert kind="error" onDismiss={() => setError('')}>{error || null}</Alert>

        {loading ? (
          <Spinner label="Loading seeded accounts..." large />
        ) : users.length === 0 ? (
          <EmptyState
            title="No accounts found"
            message="Run `npm run seed` in the server folder, then reload this page."
          />
        ) : (
          <form onSubmit={handleSignIn}>
            <div className="field">
              <label htmlFor="dev-user">Account</label>
              <select
                id="dev-user"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                style={{ minWidth: '100%' }}
              >
                {users.map((user) => (
                  <option key={user._id} value={user.email}>
                    {user.fullName} - {user.role}
                    {user.student ? ` (${user.student.studentType}, ${user.student.studentId})` : ''} - {user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <Button type="submit" loading={signingIn}>Sign in</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
