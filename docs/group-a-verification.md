# Group A API requirements and edge-case verification

Verified on a branch based directly on `Group-A`. Scope is existing Group A backend APIs; preferences (57/58) and frontend work remain excluded by the user's instruction. This change does not import development's Group B/C work.

The authoritative source is **CSEN704 - University Scheduling System Requirements (Project) (1).xlsx**, sheet **Functional Requirements**. Requirements 1-5 occupy rows 2-6; 54-58 occupy rows 55-59; 61 is row 62; 89 is row 90. The screenshot was used initially, but this audit uses the workbook's stakeholder and extra-comment columns as well as its action column.

| Requirement | Required behavior and verification |
| --- | --- |
| 1 | All five active roles log in with existing GUC credentials. No sign-up. Correct role/domain rules, normalization, missing or injected inputs, incorrect passwords, inactive accounts, hash-as-password rejection, preserved password whitespace, and bcrypt's 72-byte boundary checked. |
| 2 | All five roles reset passwords using email OTPs. Local SMTP delivery, expiry, single use, invalid codes, retry limit, resend cooldown/replacement, concurrent requests/submissions, deactivation, SMTP failures and unavailable configuration checked. Password changes revoke prior sessions. |
| 3 | All five roles log out. Prior sessions are revoked; other accounts are unaffected; new login works. Invalid, expired and unsupported-algorithm tokens are rejected. |
| 4 | Each role sees only its own applicable profile. Student/advisor fields and workflow status are checked. Client identity tampering cannot select someone else's profile. A missing student profile returns 404 instead of invented academic data. |
| 5 | Users list their own notifications and mark them read. Empty lists, invalid/missing IDs, cross-account requests, repeat reads and concurrent first reads checked. First-read timestamps are set atomically. |
| 54 | Advising Students see their own academic history; Advisors and Coordinators see any advising student's history. Administrator/Normal Student access is rejected. Assigned advisor, major, GPA, completed credits, current courses and remaining-course details checked. Repeated passes count credit once; inactive/unrelated courses are excluded. |
| 55 | The same authorized roles select attended academic years and view transcripts. `/transcript/years` lists available years. Winter, Spring, Summer and both makeup seasons, year isolation, missing years, malformed/repeated query values and orphan term references checked. |
| 56 | Authorized roles download the same transcript as PDF. The attachment uses the actual student number, academic year and Cairo date. A 150-result transcript is parsed to verify all results, and first/last pages are visually reviewed. Course and grade rows stay together across pages. |
| 61 | Only Advisors and Coordinators see advising students' failed/unattended mandatory-course candidates. Approved removals for the selected term are excluded; pending/rejected removals and approvals in another term do not remove candidates. Retakes are deduplicated and successfully completed courses are excluded. Optional `?term=<AcademicTerm ObjectId>` selects context; otherwise the active term is used. Empty responses are arrays. |
| 89 | Only an Advising Student sees their own wallet. Wallet entries exclude gateway/deferred-charge records, distinguish credit/debit, and retain amount/date/request/payment references and per-entry resulting balance. Successful entries affect balance; pending/failed/cancelled entries do not. Money is accumulated in integer cents and returned newest first. |
| 57/58 | Not implemented; excluded by the user. |

## Validation

- `npm run test:group-a`: **97 tests passed, zero failures**, on the Group-A-based branch, using real temporary MongoDB and a local SMTP server.
- `npm run build`: passed.
- Dependency audit: zero vulnerabilities after patching shell-quote.
- `git diff --check`: passed.
- PDF parsing: all 150 results retained across six pages. Visual review of the first and final pages passed.

Additional checks cover malformed JSON, oversized bodies, database-error sanitization, forged JWT role/email claims, uppercase ObjectIds, missing profiles and request ownership.

## API access matrix

| Endpoint | Normal Student | Advising Student | Advisor | Coordinator | Administrator |
| --- | --- | --- | --- | --- | --- |
| Profile / notifications | Own | Own | Own | Own | Own |
| History / transcript / years / PDF | Denied | Own | Any advising student | Any advising student | Denied |
| Failed/unattended candidates | Denied | Denied | Any advising student | Any advising student | Denied |
| Wallet | Denied | Own | Denied | Denied | Denied |

Record URL `studentId` values are MongoDB StudentProfile IDs, not display student numbers. Transcript query years use the exact AcademicTerm academicYear value (for example `2025/2026`).

## Limits of this verification

Tests demonstrate the covered API behavior and database persistence; they do not prove every possible input or deployment condition. Live GUC email delivery requires working SMTP settings and remains unverified against a real mailbox. The course PDF requires frontend, backend and populated database for full project grading; this API-only task cannot certify the complete submission. Group A frontend screens, requirements 57/58, evaluation seed data and unrelated Group B/C suites were not implemented or certified here.
