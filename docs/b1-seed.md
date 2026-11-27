# Assessment accounts and workflows

Run from the repository root:

```sh
npm run seed:evaluation --workspace @bobos/api
npm run seed:b1 --workspace @bobos/api
```

Set `MONGODB_URI` explicitly to your disposable local assessment MongoDB database before running either command. The evaluation seed is needed only when that database has no active term or curriculum. B1 uses the active term and preserves other accounts and data. It refuses production and remote MongoDB hosts.

B1 creates these records once and preserves subsequent decisions, passwords and schedule history. Keep the same active term when using these accounts.

## Sign in

The initial password is the same as the assessment password displayed in the setup terminal.

| Account | Purpose |
| --- | --- |
| `b1.coordinator@guc.edu.eg` | Pending work, all student/request groups, global history and CSV export |
| `b1.admin@guc.edu.eg` | Directory, student history and global history; Pending work is intentionally coordinator-only |
| `b1.advisor@guc.edu.eg` / `b1.advisor2@guc.edu.eg` | Two distinct assigned-advisor groups |
| `b1.student1@student.guc.edu.eg` | Processed schedule with lecture, tutorial and lab for Google Calendar |
| `b1.normal1@student.guc.edu.eg` through `b1.normal3@student.guc.edu.eg` | Normal students: assigned schedule, open swap, completed swap |

## Scenarios

| Student ID | Login before `@student.guc.edu.eg` | Expected scenario |
| --- | --- | --- |
| 91-00001 | b1.student1 | Processed calendar-ready schedule; 60 processing history events |
| 91-00002 | b1.student2 | Reopened draft, latest reason and version; 60 reopening events |
| 91-00003 | b1.student3 | Pending lecture-slot change |
| 91-00004 | b1.student4 | Pending mandatory-course removal |
| 91-00005 | b1.student5 | Extra-hours request awaiting coordinator approval |
| 91-00006 | b1.student6 | Approved extra hours with no payment choice; visible in requests/counts |
| 91-00007 | b1.student7 | Deferred extra-hours settlement |
| 91-00008 | b1.student8 | Submitted graduation plan containing only a future term; visible for review |
| 91-00009 | b1.student9 | Pending exit-exam request |
| 91-00010 | b1.student10 | Pending financial reversal linked to a 3,200 EGP gateway payment |
| 91-00011 | b1.student11 | No schedule yet |
| 92-00001 | b1.normal1 | Assigned normal-student schedule |
| 92-00002 | b1.normal2 | Open whole-schedule swap |
| 92-00003 | b1.normal3 | Completed whole-schedule swap |

The records use the existing `CSEN704` Advanced Computer Lab course and reconcile its reserved seats against the schedules.

## Manual checks

1. Coordinator → Pending work: find the 14 B1 students, both advisor groups and all seven request categories. In particular check students 6 and 8 above.
2. Schedule activity → search `91-`: exactly 120 seed records, 50 per page by default (50/50/20). Filter Processed or Reopened: 60 each. Export with the same search: 120 CSV data rows.
3. Search `B1 Former Staff Name`: 12 historical actor snapshots. Search `b1.coordinator@guc.edu.eg` or `b1.advisor@guc.edu.eg` to test actor-email matches.
4. The history covers ten UTC dates ending on the first seed run date. Combine From/Through and action filters and compare the filtered export. Existing non-B1 records remain available outside the `91-` search.
5. Directory → open student 91-00001 or 91-00002 → student schedule history: verify that only the selected student's history is shown.
6. Sign in as `b1.student1@student.guc.edu.eg` → Calendar sync → Sign in with Google. Choose the Google account authorized for this assessment and approve calendar access. Sync the processed timetable and inspect its lecture/tutorial/lab events.

Automated read-only API verification checked all 14 students, seven request categories, the two repaired edge cases, 120 events, third-page size, 120-row export, staff snapshots and the unconnected Google status. The initial Google OAuth settings were configured; Google consent remains a real external step.
