# C3: Slot change requests (40–48)

Use the local MongoDB replica set from the README. In **Student schedules**, an advisor or coordinator can send a valid advising draft for student review. The advising deadline for the active term must still be in the future for the student to submit a request.

1. As an advising student, open **Slot change requests** and select one assigned meeting. Enter an optional preference and submit. **My requests** shows the status and any staff response. Only pending requests can be withdrawn.
2. As the student's assigned advisor or as a coordinator, open **Slot change requests**. Search by student ID, student name or course code, and combine the status, advisor, course and submission date filters as needed.
3. Open a request. Compare the original meeting with other published slots of the same component, their remaining seats and any timetable conflicts. Choose the exact replacement and approve, or reject the request. Either decision can include a response note.
4. Return to the student account to see the decision and, after approval, the changed timetable. It remains **Ready for student review**.

The advising draft editor reserves seats when staff save the schedule. Those reservations carry over when it is sent for review. Approval rechecks the live timetable and capacity, then records the decision and transfers the reservation in the same transaction. Older review schedules did not hold reservations; their first successful approval reserves the resulting timetable. This flow uses the existing `SlotChangeRequest`, `StudentSchedule` and `CourseOffering` collections.

Schedule processing is requirement 81. Its implementation should check for pending requests within the same transaction that changes the schedule status, preserve existing review reservations, and take seats for legacy schedules only when they have not already been reserved.

Run `npm run test:group-c` for the API checks, including the concurrent approvals test for the last seat. To use an already installed local MongoDB binary with the test harness, set `MONGOMS_SYSTEM_BINARY` to its path.
