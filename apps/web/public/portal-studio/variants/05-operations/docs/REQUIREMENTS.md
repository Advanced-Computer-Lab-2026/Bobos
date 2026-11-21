# Requirement traceability

The actions, stakeholders and rules below are transcribed from the supplied workbook, not reconstructed from general knowledge. `Adapter present` is not a production acceptance verdict. Browser tests use an isolated API transport; the original backend and provider were not exercised here. The supplied audit findings remain source findings, not newly reproduced API tests.

## R83 — Advisor

**Workbook action:** request extra credit hours for an advising student and specify the courses and requested hours.

**Workbook rules:** Probation students cannot receive extra hours. Other students may not exceed 34 total hours. A student not graduating within one year may add at most three hours above the standard allowance. A student graduating within one year may add hours up to the 34-hour maximum. Repeated-course hours cost EGP 1,000 each; new-course hours cost EGP 800 each.

**Page keys:** `extra-hours-request`.

**Adapter:** New assigned-student form uses authenticated advisor identity and active catalogue. Select courses, graduation flag and submit actual course IDs; per-request checks and server-returned authoritative pricing.

**Coverage:** partial: adapter present; documented server gap remains.

**R83-OWNERSHIP:** The supplied API permits creation by an advisor not assigned to the student. The new UI restricts selection but does not replace a server authorization check.

**R83-CUMULATIVE:** Create/eligibility calculations do not account correctly for earlier activated requests. UI per-request limits and a visible warning are not a cumulative server guarantee.

## R84 — Coordinator

**Workbook action:** view all extra-hours requests and their details.

**Workbook rules:** Each request shows the student, requesting Advisor, requested courses and hours, eligibility checks, itemized cost, Coordinator decision, settlement status and submission date.

**Page keys:** `extra-hours`, `extra-hours-detail`.

**Adapter:** Coordinator queue and fresh individual-request GET, student/advisor/term/eligibility/cost/decision/settlement/history.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R85 — Coordinator

**Workbook action:** search extra-hours requests using a student ID.

**Page keys:** `extra-hours`.

**Adapter:** Coordinator student-ID search forwarded to the list endpoint.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R86 — Coordinator

**Workbook action:** filter extra-hours requests by requesting Advisor, Coordinator decision, settlement option and settlement status.

**Page keys:** `extra-hours`.

**Adapter:** Advisor, decision, settlement option and settlement status filters forwarded together.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R87 — Coordinator

**Workbook action:** approve or reject an extra-hours request and provide a response note.

**Workbook rules:** Approval confirms the eligibility rules and itemized cost, then makes the request available for the student to settle. Approval alone does not activate the extra hours or add the courses to the usable schedule.

**Page keys:** `extra-hours-detail`.

**Adapter:** Noted approve/reject action. Whitespace-only notes and current probation approval blocked in UI. Approval is explicitly not activation.

**Coverage:** partial: adapter present; documented server gap remains.

**R87-NOTES-STALE:** The supplied API accepts blank notes and can approve stale eligibility. The adapter adds client-side guards only; a direct/concurrent API caller can bypass them.

## R88 — Advising Student

**Workbook action:** view a Coordinator-approved extra-hours request with its courses, credit hours, price per hour, subtotals and total cost.

**Page keys:** `my-extra-hours`, `extra-hours-detail`.

**Adapter:** Approved request displays each course, hours, rate, repeated-course flag, subtotal and total.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R89 — Advising Student

**Workbook action:** view my wallet balance and wallet transaction history.

**Workbook rules:** The history shows refund credits and payment debits with the amount, date, related request or payment, and resulting balance.

**Page keys:** `wallet`.

**Adapter:** Own wallet endpoint renders balance and credit/debit ledger with linked request/reference, time, status and resulting balance.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R90 — Advising Student

**Workbook action:** choose to pay an approved extra-hours request now or add its amount to my next university installment.

**Workbook rules:** The request remains Awaiting Payment Choice until one option is confirmed.

**Page keys:** `my-extra-hours`, `settlement`.

**Adapter:** Settlement choices are separate from confirmation; only approved awaiting-choice/failed/cancelled requests may proceed.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R91 — Advising Student

**Workbook action:** choose my wallet or a third-party payment gateway and pay the approved extra-hours amount now.

**Workbook rules:** Wallet payment requires a sufficient balance; split payments are not required. The gateway is a sandbox, and the platform must not store card numbers, CVVs or gateway passwords. Apply the approved hours and courses only after successful payment.

**Page keys:** `settlement`, `payment-gateway`.

**Adapter:** Sufficient-wallet guard, no split, explicit sandbox outcome form and successful-response-only confirmation.

**Coverage:** partial: adapter present; documented server gap remains.

**R91-WALLET-CONCURRENCY:** Wallet deductions for different requests are not atomic across concurrent settlements. An in-flight UI lock prevents repeated local clicks, not cross-tab/request overspending.

## R92 — Advising Student

**Workbook action:** confirm that the approved extra-hours amount will be added to my next university installment.

**Workbook rules:** Confirmation creates an outstanding deferred charge linked to the next installment and immediately activates the approved hours and courses. The amount must not also be charged to the wallet or gateway.

**Page keys:** `settlement`.

**Adapter:** Deferral sends option=deferred only; confirmation says outstanding amount due, not money collected.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R93 — Advising Student

**Workbook action:** retry a failed or cancelled third-party gateway payment.

**Page keys:** `payment-gateway`.

**Adapter:** Failure/cancellation stay in the gateway screen and preserve retry or return-to-options.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R94 — Advising Student

**Workbook action:** view and download a payment receipt or deferred-payment confirmation.

**Workbook rules:** A paid receipt includes the payment method and transaction reference. A deferred-payment confirmation includes the related installment, amount due and confirmation date and must not be labelled as a paid receipt.

**Page keys:** `payment-history`, `payment-confirmation`.

**Adapter:** Distinct paid and deferred confirmation views; downloads invoke the existing authenticated blob endpoint.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R95 — Advising Student / Advisor / Coordinator

**Workbook action:** view the status and decision history of an extra-hours request.

**Workbook rules:** The history shows the Coordinator decision and whether the request is Awaiting Payment Choice, Paid, Deferred to Next Installment, Failed, Cancelled or Refunded.

**Page keys:** `extra-hours`, `my-extra-hours`, `extra-hours-detail`.

**Adapter:** Role-specific request list and detail render the returned decision and settlement history without inventing missing refund events.

**Coverage:** partial: adapter present; documented server gap remains.

**R95-REFUND-HISTORY:** The audited reversal path leaves the original request marked paid and omits the reversal from request history.

## R96 — Advisor

**Workbook action:** withdraw an extra-hours request before Coordinator approval.

**Workbook rules:** An approved, rejected, paid or deferred request cannot be withdrawn. Approved requests use the cancellation or refund flow.

**Page keys:** `extra-hours`, `extra-hours-detail`.

**Adapter:** Pending-only advisor withdrawal with reversible confirmation; resolved requests have no withdraw action.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R97 — Advising Student

**Workbook action:** view my extra-hours payment and deferred-charge history including each record's settlement option and status.

**Page keys:** `payment-history`.

**Adapter:** Own financial history lists settlement option/status, supports local literal search and eligible confirmation links.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R98 — Coordinator / Administrator

**Workbook action:** view a list of extra-hours financial records.

**Workbook rules:** Each record shows the student, request, amount, settlement option, transaction or deferred-charge reference, relevant date and status.

**Page keys:** `financial-records`.

**Adapter:** Existing paginated staff ledger retained, with request/reference/settlement columns.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R99 — Coordinator / Administrator

**Workbook action:** search extra-hours financial records using a student ID, request ID, transaction reference or deferred-charge reference.

**Page keys:** `financial-records`.

**Adapter:** Debounced search is forwarded to the actual finance endpoint.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R100 — Coordinator / Administrator

**Workbook action:** filter extra-hours financial records by date, settlement option and status.

**Page keys:** `financial-records`.

**Adapter:** Date, settlement option, payment status, type and term are forwarded to list and export.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R101 — Coordinator / Administrator

**Workbook action:** view and select an extra-hours financial record from the displayed search or filter results to open its details.

**Page keys:** `financial-records`, `financial-record-detail`.

**Adapter:** Selected-record GET displays identity, settlement, original metadata and audit fields.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R102 — Coordinator / Administrator

**Workbook action:** refund a paid extra-hours charge or cancel an unpaid deferred charge for an eligible cancelled request.

**Workbook rules:** A paid amount is refunded to the student's wallet and cannot be refunded twice. An unpaid deferred charge is removed from the next installment without crediting the wallet. In both cases, revoke the related extra hours and unapplied schedule additions and retain the reversal history.

**Page keys:** `financial-reversal`.

**Adapter:** Eligibility/reversal review distinguishes paid refund from unpaid deferred cancellation. Execution is intentionally unavailable; no unsafe financial POST is sent.

**Coverage:** blocked: unsafe supplied reversal API.

**R102-REVERSAL:** Ineligible reversals, incorrect credits for unpaid deferrals, missing credit/addition revocation, duplicate concurrent credits and wallet double-counting remain. Live reversal is disabled in the adapter.

## R103 — Advisor

**Workbook action:** create a graduation plan and assign every remaining course to the next Winter, Spring or Summer term.

**Workbook rules:** Every remaining course must be assigned. Course offering seasons and prerequisite order must be respected. Each term must remain within the student's standard or separately approved credit-hour limit. An approved exit exam may replace the single failed course covered by that approval.

**Page keys:** `graduation-plans`, `graduation-plan`.

**Adapter:** Original planner API and remaining-course/season/prerequisite/credit/approved-exam controls retained with ten table arrangements.

**Coverage:** partial: adapter present; documented server gap remains.

**GRAD-CREDIT-POLICY:** The shared C1 policy can allow 25 credits at GPA 3.70 with stale non-probation standing/reason, despite the required 23-credit allowance. Planner save/submit/accept still depend on that server policy.

## R104 — Advisor

**Workbook action:** update a graduation plan that I created while it is still a draft.

**Workbook rules:** A submitted plan cannot be updated.

**Page keys:** `graduation-plans`, `graduation-plan`.

**Adapter:** Creator draft endpoint and optimistic version payload retained; submitted plans switch to read-only presentation.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R105 — Advisor

**Workbook action:** delete a graduation plan that I created while it is still a draft.

**Workbook rules:** A submitted plan cannot be deleted.

**Page keys:** `graduation-plans`, `graduation-plan`.

**Adapter:** Draft-only versioned delete with explicit confirm/cancel retained.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R106 — Advisor

**Workbook action:** save an unfinished graduation plan as a private draft.

**Workbook rules:** A draft is visible only to the Advisor who created it. It is not visible to the Coordinator, student or other Advisors until submitted.

**Page keys:** `graduation-plans`, `graduation-plan`.

**Adapter:** Incomplete draft save uses the original private advisor/student endpoint; no preview sharing is introduced.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R107 — Advisor

**Workbook action:** submit a finalized graduation plan.

**Workbook rules:** Submission is allowed only when every remaining course is assigned to the next Winter, Spring or Summer term, or when the only unassigned failed course has an approved exit-exam request. The submitted plan becomes read-only while awaiting the Coordinator's decision.

**Page keys:** `graduation-plans`, `graduation-plan`.

**Adapter:** Save then versioned submit; server validation issues remain visible and submitted content is read-only.

**Coverage:** partial: adapter present; documented server gap remains.

**GRAD-CREDIT-POLICY:** The shared C1 policy can allow 25 credits at GPA 3.70 with stale non-probation standing/reason, despite the required 23-credit allowance. Planner save/submit/accept still depend on that server policy.

## R108 — Advisor

**Workbook action:** request an exit exam for an advising student who has exactly one remaining failed course that cannot be repeated before graduation.

**Workbook rules:** The request identifies the course and explains why it cannot be placed in the next Winter, Spring or Summer term, such as the course not being offered or no valid placement remaining.

**Page keys:** `exit-exam-request`.

**Adapter:** Uses the server-supplied eligible course; no free-form replacement course ID. Required reason and existing request status shown.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R109 — Coordinator

**Workbook action:** approve or reject an exit-exam request and provide a response note.

**Workbook rules:** Approval allows the course to be represented by an exit exam in the graduation plan. Rejection requires the Advisor to place the course in a valid term before submitting the plan.

**Page keys:** `exit-exam-review`, `exit-exam-detail`.

**Adapter:** Coordinator decision with required substantive note; original request/decision endpoint retained.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R110 — Advisor / Coordinator

**Workbook action:** view submitted graduation plans and their statuses.

**Workbook rules:** An Advisor sees plans they submitted. A Coordinator sees all submitted plans. Private drafts remain visible only to their creating Advisor.

**Page keys:** `graduation-review`.

**Adapter:** Original server-scoped submitted-plan queue; no private drafts copied into coordinator/student views.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R111 — Coordinator

**Workbook action:** filter submitted graduation plans by status, Advisor and submission date.

**Workbook rules:** Private drafts are excluded because they are visible only to their creating Advisor.

**Page keys:** `graduation-review`.

**Adapter:** Status, advisor and inclusive-bound date inputs retained in the submitted-plan queue.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R112 — Coordinator

**Workbook action:** search submitted graduation plans using a student ID or Advisor's name or GUC email.

**Page keys:** `graduation-review`.

**Adapter:** Student/advisor search forwarded to original graduation list endpoint.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R113 — Coordinator

**Workbook action:** accept or reject a submitted graduation plan and provide a response note.

**Workbook rules:** Acceptance confirms that the student can complete the remaining graduation requirements within one year. Rejection returns the plan to its creating Advisor as a private draft that can be corrected and resubmitted.

**Page keys:** `graduation-plan-review`.

**Adapter:** Accept/return decision includes submittedAt freshness token and note; return is described as a private draft.

**Coverage:** partial: adapter present; documented server gap remains.

**GRAD-CREDIT-POLICY:** The shared C1 policy can allow 25 credits at GPA 3.70 with stale non-probation standing/reason, despite the required 23-credit allowance. Planner save/submit/accept still depend on that server policy.

## R114 — Advising Student

**Workbook action:** view my accepted graduation plan.

**Workbook rules:** The plan becomes visible to the student only after Coordinator acceptance.

**Page keys:** `my-graduation`.

**Adapter:** Student uses /api/graduation/me and renders only the accepted plans returned there.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R115 — Advising Student

**Workbook action:** view the status and Coordinator response for an exit-exam request submitted for me.

**Page keys:** `my-exit-exams`.

**Adapter:** Student exit-exam response table shows returned course/status/date/coordinator note.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R122 — Coordinator

**Workbook action:** view a pending-work dashboard showing every student's workflow status, blocking step and requests awaiting action, grouped by student type, request type and Advisor.

**Workbook rules:** Statuses are system-derived from completed actions and cannot be manually overwritten by an Advisor. The dashboard includes open and completed normal-student group swaps and advising-student draft, review, change-request, approval, settlement and processing states.

**Page keys:** `pending-work`.

**Adapter:** Read-only server-derived status/blocker/request feed, local search/type filter, grouping by table columns and original workflow handoffs. Missing categories are disclosed.

**Coverage:** partial: adapter present; documented server gap remains.

**R122-FEED:** The pending-work API omits graduation-plan, exit-exam and financial-reversal categories. This submission does not fabricate records or invent a combined feed.

## R123 — Coordinator / Administrator

**Workbook action:** view the automatically recorded history of schedule processing and reopening actions.

**Workbook rules:** The system records entries automatically. From a selected student's advising details, show that student's history; from the global history page, show all advising students. Each entry shows the student ID, action, schedule version, staff member's full name, GUC email and role, date and time, and reopening reason when applicable.

**Page keys:** `schedule-activity`.

**Adapter:** Global and selected-student history routes retained; action/version/actor snapshots/time/reason displayed. No manual activity creation.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R124 — Coordinator / Administrator

**Workbook action:** filter the schedule activity history by action type and date range.

**Page keys:** `schedule-activity`.

**Adapter:** Action and date-range filters preserved; native date bounds and server error feedback remain.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R125 — Coordinator / Administrator

**Workbook action:** search the schedule activity history using a student ID or staff member's name or GUC email.

**Page keys:** `schedule-activity`.

**Adapter:** Literal search forwarded to the original history route.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R126 — Coordinator / Administrator

**Workbook action:** export the displayed schedule activity history.

**Page keys:** `schedule-activity`.

**Adapter:** CSV export sends all current filters without current-page restriction.

**Coverage:** API-backed adapter present; live backend not re-certified.

## R127 — Coordinator / Administrator

**Workbook action:** export filtered extra-hours financial records.

**Page keys:** `financial-records`.

**Adapter:** CSV export sends search/date/option/status/type/term to the original full filtered export endpoint.

**Coverage:** API-backed adapter present; live backend not re-certified.

## Non-functional requirements

The workbook assigns 60 points to UX, 20 to UI and 20 to smooth prior-feature flow. These are evaluation criteria, not self-awarded scores.

| Source criterion | Implementation evidence | Remaining check |
| --- | --- | --- |
| Information Architecture | Existing Portal entries and role-specific local sections; no new top-level shell or gallery | Stakeholder usability review |
| Feedback and Responsiveness | Loading/error/empty states, mutation locks and success only after API response | Real network latency and backend failures |
| Navigation is Reversible | Existing sidebar, close/back controls, cancel withdrawal/deletion, settlement back-to-options | Native browser origin regression |
| Learnability | Existing button vocabulary, term treatment and primary action names | User testing |
| Visibility | Explicit decision vs settlement; paid vs outstanding; read-only submitted state | Production record completeness |
| Efficiency | Search/filter/export, grouping/comparison, retained draft values across designs | Large datasets and actual pagination |
| Design for errors | Required notes, date bounds, insufficient-wallet guard, unsafe reversal unavailable | Server authorization/concurrency fixes |
| Satisfaction | Reference-scale art, optional finite replay, reduced motion and muted inherited surfaces | Stakeholder judgement, not test score |
| UI elements / professional appearance | Scoped styles, inherited typography/theme, same-viewport Overview evidence | Accessibility and visual review with final neighboring submissions |
| Smooth app flow | Original shared shell/auth/calendar/API files unchanged; scoped integration tests | Full original API suite and real account/provider tests |
