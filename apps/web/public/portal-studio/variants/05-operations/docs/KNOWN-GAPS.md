# Known gaps and acceptance boundaries

## Source precedence

The original B/C audit reports a concurrent schedule-processing/history defect. The supplied **Group A Sprint 2 integration audit explicitly states that this assertion now passes** after transactional integration. This delivery therefore does not repeat the older processing/history defect as an outstanding current gap. Other B/C gaps are not silently treated as fixed. Neither historical audit run was rerun against MongoDB here.

## R83-OWNERSHIP

The supplied API permits creation by an advisor not assigned to the student. The new UI restricts selection but does not replace a server authorization check.

## R83-CUMULATIVE

Create/eligibility calculations do not account correctly for earlier activated requests. UI per-request limits and a visible warning are not a cumulative server guarantee.

## R87-NOTES-STALE

The supplied API accepts blank notes and can approve stale eligibility. The adapter adds client-side guards only; a direct/concurrent API caller can bypass them.

## R91-WALLET-CONCURRENCY

Wallet deductions for different requests are not atomic across concurrent settlements. An in-flight UI lock prevents repeated local clicks, not cross-tab/request overspending.

## R95-REFUND-HISTORY

The audited reversal path leaves the original request marked paid and omits the reversal from request history.

## R102-REVERSAL

Ineligible reversals, incorrect credits for unpaid deferrals, missing credit/addition revocation, duplicate concurrent credits and wallet double-counting remain. Live reversal is disabled in the adapter.

## GRAD-CREDIT-POLICY

The shared C1 policy can allow 25 credits at GPA 3.70 with stale non-probation standing/reason, despite the required 23-credit allowance. Planner save/submit/accept still depend on that server policy.

## R122-FEED

The pending-work API omits graduation-plan, exit-exam and financial-reversal categories. This submission does not fabricate records or invent a combined feed.

## Cross-team dependencies

The supplied Group A audit also records missing coordinator action notifications (R120) and deadline reminders (R121). Notifications belong to the shared/original application and are not simulated by this folder. Current schedule processing, academic standing and credit allowances remain owned by their existing services.

## Release gates

Do not enable live reversal until paid/refundable eligibility, unpaid-deferral cancellation without credit, exactly-once concurrency, balanced wallet accounting, extra-hour/addition revocation and immutable audit history are verified atomically in the server. Do not treat a disabled button or local in-flight lock as server authorization or transaction safety.

A repaired backend should be exercised by the supplied strict commands (`npm run test:a`, `npm run test:bc`) and the existing integration suite. Regression/TODO mode does not certify unmet requirements. Production React/Vite build, native navigation/storage, real API role boundaries, real receipt PDF content and Google/provider integration remain external acceptance work.

## What the test transport proves

The fixture runs prove UI state retention, control wiring, expected request paths/payloads, visible loading/error/empty behavior, local role gates and responsive layouts for those fixtures. The fixture deliberately does not emulate all backend rules. Download tests return a marker body and verify authenticated blob delivery; they do not validate a generated receipt PDF or a CSV query implementation in the real database.
