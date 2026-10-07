// Requirement 31 - a student views their own current weekly schedule.
// Requirement 49 - download (PDF) or print it once it is processed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, download } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
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

  // Requirement 49 - only a PROCESSED schedule can be downloaded or printed.
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const inFlight = useRef(false);
  const canExport = Boolean(data && data.schedule && data.schedule.status === 'processed');

  const handleDownload = useCallback(async () => {
    if (inFlight.current) return; // no double submit
    inFlight.current = true;
    setDownloading(true);
    setDownloadError('');
    try {
      const { blob, fileName } = await download('/schedules/me/download', { fallbackName: 'my-schedule.pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.push(`Downloaded ${fileName}`);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      inFlight.current = false;
      setDownloading(false);
    }
  }, [toast]);

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
      {!loading && data ? (
        <>
          <div className="schedule-actions no-print">
            <Button onClick={handleDownload} loading={downloading} disabled={!canExport}>
              {downloading ? 'Preparing PDF...' : 'Download PDF'}
            </Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={!canExport || downloading}>
              Print
            </Button>
            {!canExport ? <span className="muted">Available once your schedule is processed.</span> : null}
          </div>
          {downloadError ? (
            <div className="no-print">
              <Alert kind="error" onDismiss={() => setDownloadError('')}>{downloadError}</Alert>
            </div>
          ) : null}
          <div className="print-only print-heading">
            <h1>Weekly Schedule</h1>
            <p>
              {data.student.fullName} ({data.student.studentId}) - {data.term.season} {data.term.academicYear} - Group{' '}
              {data.schedule.studyGroup}
            </p>
          </div>
          <ScheduleView data={data} />
        </>
      ) : null}
    </>
  );
}
