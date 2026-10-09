import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Welcome to Bobos"
        message="The GUC schedule management system. Sign in to continue."
        action={<Link className="btn" to="/dev-login">Sign in</Link>}
      />
    );
  }

  return (
    <>
      <div className="page__header">
        <h1>Welcome, {user.fullName}</h1>
        <p>You are signed in as a {user.role}. Pick a task below.</p>
      </div>

      {/* requirement 31 */}
      {user.role === 'student' ? (
        <Card title="My schedule" subtitle="Requirement 31 - your weekly calendar, rooms and days off.">
          <Link className="btn" to="/schedule">View my schedule</Link>
        </Card>
      ) : null}
      {/* requirement 32 */}
      {user.role === 'student' ? (
        <Card title="My courses" subtitle="Requirement 32 - your registered courses and credit hours.">
          <Link className="btn" to="/courses">View my courses</Link>
        </Card>
      ) : null}
      {/* requirement 34 */}
      {user.role === 'student' ? (
        <Card title="Swap schedule" subtitle="Requirement 34 - groups whose subjects exactly match yours, with their full weekly schedules.">
          <Link className="btn" to="/swap">View eligible groups</Link>
        </Card>
      ) : null}
      {['advisor', 'coordinator', 'administrator'].includes(user.role) ? (
        <Card title="Student schedules" subtitle="Requirement 31 - view a student's current weekly schedule.">
          <Link className="btn" to="/schedules">Open student schedules</Link>
        </Card>
      ) : null}

      {user.role === 'coordinator' || user.role === 'administrator' ? (
        <Card
          title="Standard schedule groups"
          subtitle="Requirement 30 - assign or reassign normal students to a standard schedule group."
        >
          <p className="muted">
            A student&apos;s processed schedule is created from the assigned group&apos;s published template.
          </p>
          <Link className="btn" to="/coordinator/assign-groups">
            Open assign schedule groups
          </Link>
        </Card>
      ) : user.role === 'student' || user.role === 'advisor' ? null : (
        <Card title="Nothing for your role yet">
          <p className="muted">
            Your role&apos;s screens are being built by the rest of the team. Requirement 30 (group
            assignment) is available to Coordinators.
          </p>
        </Card>
      )}
    </>
  );
}
