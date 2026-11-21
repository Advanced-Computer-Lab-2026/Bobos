# Source-backed workflow boundaries

The basis is the supplied functional/nonfunctional workbook, PAGE-BRIEFS, authentication documentation, actual controller/UI sources and the Group A and B/C audits. `source-checksums.json` identifies them. Audit claims below are attributed to those documents; their database suites were not rerun for this design delivery.

## Authentication and profile

The supplied authentication documentation states that all five roles use existing active GUC accounts. Forgot password returns a generic response for unknown/inactive accounts; it does not expose the OTP. Codes have a 10-minute lifetime and a 60-second request cooldown; five wrong attempts invalidate them. Reset uses at least eight characters and no more than 72 UTF-8 bytes and invalidates existing sessions. Production logout invalidates all devices in that backend. The optional AuthPage patch preserves these actual handlers and adds help, show/hide fields, busy locking and byte-aware client feedback. It does not replace the server rules.

The profile remains read-only. No edit API or inferred private record is invented. Studio values are illustrative and labeled by the preview environment; the actual React Profile page continues to use its current source.

## Notifications

R117 is recorded Verified in the supplied Group A audit for swaps, review/process/reopen, extra-hours and financial/decision events, including A3 decisions. R118 is recorded Verified for two completed consecutive probation semesters, eligible recipients, retry/deduplication and startup scheduling; actual mailbox delivery still requires SMTP. R119 is recorded Verified for assignment and assigned-student slot submission/withdrawal events.

R120 is explicitly Partial: only extra-hours requests alert Coordinators. Graduation-plan submission, exit-exam request, mandatory-course removal and financial-reversal action senders are absent. Their preview details display an audit notice. R121 is Missing: no reminder sender, timer or inbox synchronization exists, despite the enum. The reminder layout is not a delivered reminder.

The API companion fetches only `/api/notifications` for the signed-in account. Read operations call the existing individual PATCH endpoint; Mark all iterates it and reports partial failure. It never marks email-only records read. Optional serializer fields `relatedModel` and `relatedId` are added only after the existing recipient guard. A narrow allowlist maps permitted records to verified GET routes or existing workspaces. Missing metadata does not become a fabricated deep link.

## Separate workflows not claimed as completed

R31 weekly schedules, R49 processed-schedule export, R116 calendar integration and R122 pending work retain their native destinations. The overview binder is not external calendar integration. The supplied B/C audit reports R122 graduation/exit/reversal category gaps; this package preserves access, not those absent categories.

Other audited extra-hours, refund, removal, schedule validation and graduation dependencies remain outside this delivery. No payment details are collected, no decision is fabricated, and no missing business rule is silently patched. This is UI integration with a narrow optional API presentation adapter, not a claim that the combined academic system is production-complete.
