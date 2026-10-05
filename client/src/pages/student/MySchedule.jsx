// Requirement 31 - a student views their own current weekly schedule.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ScheduleView from '../../components/ScheduleView.jsx';

export default function MySchedule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notAvailable, setNotAvailable] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setNotAvailable(false);
    api
      .get('/schedules/me')
      .then(setData)
      .catch((err) => {
        if (err.status === 404) setNotAvailable(true);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <div className="page__header">
        <h1>My schedule</h1>
        <p>Your current weekly schedule: courses, lecture, tutorial and lab times and locations, and your days off.</p>
      </div>

      {loading ? <Spinner label="Loading your schedule..." large /> : null}
      {!loading && error ? (
        <Alert kind="error">
          {error} <Button variant="ghost" size="sm" onClick={load}>Try again</Button>
        </Alert>
      ) : null}
      {!loading && notAvailable ? (
        <EmptyState
          title="Your schedule isn't available yet"
          message="It will appear here once it has been processed (or, for advising students, once your advisor marks it ready for your review)."
          action={<Button variant="secondary" onClick={load}>Check again</Button>}
        />
      ) : null}
      {!loading && data ? <ScheduleView data={data} /> : null}
    </>
  );
}
