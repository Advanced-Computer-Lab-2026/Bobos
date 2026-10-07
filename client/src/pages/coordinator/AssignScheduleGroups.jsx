// Requirement 30 - Coordinator: assign or reassign normal students to a
// standard schedule group. The processed schedule is created server-side from
// the assigned group's PUBLISHED template.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import Card from '../../components/Card.jsx';
import Table from '../../components/Table.jsx';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import WeeklyPreview from '../../components/WeeklyPreview.jsx';

const MAJORS = ['CS', 'DMET'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function AssignScheduleGroups() {
  const { user } = useAuth();
  const toast = useToast();
  const canAssign = user?.role === 'coordinator';

  const [terms, setTerms] = useState([]);
  const [termId, setTermId] = useState('');
  const [termsLoading, setTermsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [major, setMajor] = useState('');
  const [semester, setSemester] = useState('');
  const [assigned, setAssigned] = useState('');

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // assign modal
  const [assignTarget, setAssignTarget] = useState(null);
  const [pickedGroup, setPickedGroup] = useState('');
  const [assignError, setAssignError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // unassign confirmation
  const [unassignTarget, setUnassignTarget] = useState(null);
  const [unassignError, setUnassignError] = useState('');
  const [unassigning, setUnassigning] = useState(false);

  /* ------------------------------------------------------------------ terms */
  useEffect(() => {
    let cancelled = false;
    api
      .get('/group-assignments/terms')
      .then((data) => {
        if (cancelled) return;
        const list = data.terms || [];
        setTerms(list);
        const current = list.find((t) => t.isCurrent) || list[0];
        if (current) setTermId(current._id);
      })
      .catch((err) => {
        if (!cancelled) setListError(err.message);
      })
      .finally(() => {
        if (!cancelled) setTermsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------- debounced search */
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  /* --------------------------------------------------------------- students */
  const loadStudents = useCallback(async () => {
    if (!termId) return;
    setStudentsLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ termId });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (major) params.set('major', major);
      if (semester) params.set('semester', semester);
      if (assigned) params.set('assigned', assigned);
      const data = await api.get(`/group-assignments/students?${params.toString()}`);
      setStudents(data.students || []);
    } catch (err) {
      setListError(err.message);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [termId, debouncedSearch, major, semester, assigned]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  /* ----------------------------------------------------------------- groups */
  const loadGroups = useCallback(async () => {
    if (!termId) return;
    setGroupsLoading(true);
    try {
      const data = await api.get(`/group-assignments/groups?termId=${termId}`);
      setGroups(data.groups || []);
    } catch (err) {
      setGroups([]);
      setListError(err.message);
    } finally {
      setGroupsLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  /* ---------------------------------------------------------------- actions */
  const groupsForTarget = useMemo(() => {
    if (!assignTarget) return [];
    return groups.filter(
      (g) => g.major === assignTarget.major && g.semester === assignTarget.currentSemester
    );
  }, [groups, assignTarget]);

  const pickedGroupDetails = useMemo(
    () => groupsForTarget.find((g) => g.studyGroup === pickedGroup) || null,
    [groupsForTarget, pickedGroup]
  );

  function openAssign(student) {
    setAssignTarget(student);
    setPickedGroup(student.assignment ? student.assignment.studyGroup : '');
    setAssignError('');
  }

  function closeAssign() {
    setAssignTarget(null);
    setPickedGroup('');
    setAssignError('');
  }

  async function confirmAssign() {
    if (!assignTarget || !pickedGroup) return;
    setSubmitting(true);
    setAssignError('');
    try {
      const data = await api.post('/group-assignments', {
        studentId: assignTarget._id,
        termId,
        studyGroup: pickedGroup
      });
      toast.push(data.message || 'Assignment saved.', 'success');
      closeAssign();
      await Promise.all([loadStudents(), loadGroups()]);
    } catch (err) {
      // The server's own message explains the exact rule that blocked this:
      // unpublished template, a full slot, a timetable clash...
      setAssignError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmUnassign() {
    if (!unassignTarget) return;
    setUnassigning(true);
    setUnassignError('');
    try {
      const data = await api.del(`/group-assignments/${unassignTarget._id}?termId=${termId}`);
      toast.push(data.message || 'Student unassigned.', 'success');
      setUnassignTarget(null);
      await Promise.all([loadStudents(), loadGroups()]);
    } catch (err) {
      setUnassignError(err.message);
    } finally {
      setUnassigning(false);
    }
  }

  /* ----------------------------------------------------------------- render */
  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <span className="stack">
          <strong>{row.fullName}</strong>
          <small className="muted">{row.studentId} - {row.email}</small>
        </span>
      )
    },
    { key: 'major', header: 'Major', render: (row) => <span className="badge">{row.major}</span> },
    { key: 'currentSemester', header: 'Semester', render: (row) => row.currentSemester },
    {
      key: 'academicStanding',
      header: 'Standing',
      render: (row) => (
        <span className={row.academicStanding === 'Probation' ? 'badge badge--warn' : 'badge badge--ok'}>
          {row.academicStanding === 'Probation' ? 'Probation' : 'Good'}
        </span>
      )
    },
    {
      key: 'isActive',
      header: 'Account',
      render: (row) =>
        row.isActive ? (
          <span className="badge badge--ok">Active</span>
        ) : (
          <span className="badge badge--danger">Inactive</span>
        )
    },
    {
      key: 'assignment',
      header: 'Current group',
      render: (row) =>
        row.assignment ? (
          <span className="stack">
            <span className="badge badge--info">Group {row.assignment.studyGroup}</span>
            <small className="muted">{row.assignment.courseCount} courses</small>
          </span>
        ) : (
          <span className="badge">Unassigned</span>
        )
    },
    {
      key: 'actions',
      header: '',
      className: 'actions',
      render: (row) => (
        <span className="btn-row btn-row--end">
          <Button size="sm" onClick={() => openAssign(row)} disabled={!canAssign}>
            {row.assignment ? 'Reassign' : 'Assign'}
          </Button>
          {row.assignment ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setUnassignTarget(row);
                setUnassignError('');
              }}
              disabled={!canAssign}
            >
              Unassign
            </Button>
          ) : null}
        </span>
      )
    }
  ];

  const selectedTerm = terms.find((t) => t._id === termId);

  return (
    <>
      <div className="page__header">
        <h1>Assign schedule groups</h1>
        <p>
          Requirement 30 - assign or reassign normal students to a standard schedule group. The
          student&apos;s processed schedule is created from the assigned group&apos;s published template.
        </p>
      </div>

      {!canAssign ? (
        <Alert kind="info">
          You are signed in as {user?.role}: this page is read-only for you. Only a Coordinator can
          assign or reassign students.
        </Alert>
      ) : null}

      <Card title="Filters" flat>
        <div className="filter-bar">
          <div className="field">
            <label htmlFor="term">Academic term</label>
            <select id="term" value={termId} onChange={(e) => setTermId(e.target.value)} disabled={termsLoading}>
              {terms.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.season} {term.academicYear}
                  {term.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="search"
              placeholder="Student ID, name or GUC email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="major">Major</label>
            <select id="major" value={major} onChange={(e) => setMajor(e.target.value)}>
              <option value="">All majors</option>
              {MAJORS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="semester">Semester</label>
            <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">All semesters</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="assigned">Assignment</label>
            <select id="assigned" value={assigned} onChange={(e) => setAssigned(e.target.value)}>
              <option value="">All students</option>
              <option value="true">Assigned only</option>
              <option value="false">Unassigned only</option>
            </select>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setMajor('');
              setSemester('');
              setAssigned('');
            }}
          >
            Clear filters
          </Button>
        </div>
      </Card>

      <Card
        title="Normal students"
        subtitle={
          selectedTerm
            ? `${students.length} student(s) - ${selectedTerm.season} ${selectedTerm.academicYear}`
            : undefined
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => { loadStudents(); loadGroups(); }}>
            Refresh
          </Button>
        }
      >
        <Alert kind="error" onDismiss={() => setListError('')}>{listError || null}</Alert>

        {termsLoading || studentsLoading ? (
          <Spinner label="Loading students..." large />
        ) : (
          <Table
            columns={columns}
            rows={students}
            empty={
              <EmptyState
                title="No normal students match these filters"
                message="Clear the filters, or run the seed script if the database is empty."
              />
            }
          />
        )}
      </Card>

      {/* ------------------------------------------------------ assign modal */}
      <Modal
        open={Boolean(assignTarget)}
        wide
        title={
          assignTarget?.assignment
            ? `Reassign ${assignTarget.fullName}`
            : `Assign ${assignTarget?.fullName || ''}`
        }
        description={
          assignTarget
            ? `${assignTarget.studentId} - ${assignTarget.major} semester ${assignTarget.currentSemester}${
                assignTarget.assignment ? ` - currently in group ${assignTarget.assignment.studyGroup}` : ' - currently unassigned'
              }`
            : undefined
        }
        onClose={closeAssign}
        footer={
          <>
            <Button variant="secondary" onClick={closeAssign} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} loading={submitting} disabled={!pickedGroup || !canAssign}>
              {assignTarget?.assignment ? 'Confirm reassignment' : 'Confirm assignment'}
            </Button>
          </>
        }
      >
        <Alert kind="error" onDismiss={() => setAssignError('')}>{assignError || null}</Alert>

        {groupsLoading ? (
          <Spinner label="Loading published groups..." />
        ) : groupsForTarget.length === 0 ? (
          <EmptyState
            title="No published standard schedule group for this cohort"
            message={`There is no published template for ${assignTarget?.major} semester ${assignTarget?.currentSemester} in this term. A Coordinator must create and publish one first (requirements 28/29).`}
          />
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Only PUBLISHED groups are listed - a processed schedule can only be created from a
              published template.
            </p>
            <div className="group-list">
              {groupsForTarget.map((group) => {
                const isPicked = group.studyGroup === pickedGroup;
                const isCurrent = assignTarget?.assignment?.studyGroup === group.studyGroup;
                return (
                  <button
                    type="button"
                    key={group._id}
                    className="group-option"
                    aria-pressed={isPicked}
                    onClick={() => setPickedGroup(group.studyGroup)}
                  >
                    <span className="group-option__head">
                      <strong>
                        Group {group.studyGroup}
                        {isCurrent ? ' - current group' : ''}
                      </strong>
                      <span className="row-gap">
                        <span className="badge badge--info">{group.courseCount} courses</span>
                        <span className="badge">{group.totalCreditHours} credit hours</span>
                        <span className="badge">{group.assignedStudents} assigned</span>
                        <span
                          className={
                            group.minRemainingCapacity === 0 ? 'badge badge--danger' : 'badge badge--ok'
                          }
                        >
                          {group.minRemainingCapacity === 0
                            ? 'A slot is full'
                            : `${group.minRemainingCapacity} seats left`}
                        </span>
                      </span>
                    </span>
                    <span className="group-option__codes">
                      {group.courseCodes.map((code) => (
                        <span className="badge" key={code}>{code}</span>
                      ))}
                    </span>
                    {group.issue ? (
                      <span className="group-option__meta" style={{ color: 'var(--danger)' }}>
                        {group.issue}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {pickedGroupDetails ? (
              <div style={{ marginTop: '1rem' }}>
                <h3>Weekly schedule of group {pickedGroupDetails.studyGroup}</h3>
                <WeeklyPreview slots={pickedGroupDetails.slots} />
              </div>
            ) : (
              <p className="muted" style={{ marginTop: '1rem' }}>
                Select a group to preview its weekly lecture, tutorial and lab slots.
              </p>
            )}
          </>
        )}
      </Modal>

      {/* ---------------------------------------------------- unassign modal */}
      <Modal
        open={Boolean(unassignTarget)}
        title="Remove this student from their group?"
        description={
          unassignTarget
            ? `${unassignTarget.fullName} (${unassignTarget.studentId}) is in group ${unassignTarget.assignment?.studyGroup}.`
            : undefined
        }
        onClose={() => setUnassignTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnassignTarget(null)} disabled={unassigning}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmUnassign} loading={unassigning} disabled={!canAssign}>
              Yes, unassign
            </Button>
          </>
        }
      >
        <Alert kind="error" onDismiss={() => setUnassignError('')}>{unassignError || null}</Alert>
        <p>
          The processed schedule will be deleted and the seats it occupied will be returned to the
          lecture, tutorial and lab slots. You can assign the student to a group again at any time.
        </p>
      </Modal>
    </>
  );
}
