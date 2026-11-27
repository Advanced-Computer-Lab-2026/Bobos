/** Production route/permission contract. No fixture records or caller-supplied URLs. */
export const FRONT_DESK_ROUTES = Object.freeze(['overview', 'login', 'forgot', 'reset', 'profile', 'notifications']);
export const ROLES = Object.freeze(['normalStudent', 'advisingStudent', 'advisor', 'coordinator', 'administrator']);
const student = ['normalStudent', 'advisingStudent'];
const advising = ['advisingStudent'];
const staff = ['advisor', 'coordinator'];
const coordinator = ['coordinator'];
const rules = {
  advisorAssigned: { roles: ['advisor', ...advising], model: 'AdvisorAssignment', screen: role => role === 'advisor' ? 'advising' : 'my-advisor' },
  advisorRemoved: { roles: advising, model: 'AdvisorAssignment', screen: 'my-advisor' },
  slotChangeSubmitted: { roles: staff, model: 'SlotChangeRequest', screen: 'slot-changes' },
  slotChangeWithdrawn: { roles: staff, model: 'SlotChangeRequest', screen: 'slot-changes' },
  slotChangeDecision: { roles: advising, model: 'SlotChangeRequest', screen: 'slot-changes' },
  scheduleReadyForReview: { roles: advising, model: 'StudentSchedule', screen: 'my-schedule' },
  scheduleProcessed: { roles: student, model: 'StudentSchedule', screen: 'my-schedule' },
  scheduleReopened: { roles: advising, model: 'StudentSchedule', screen: 'my-schedule' },
  scheduleSwapOpened: { roles: ['normalStudent'], model: ['StudentSchedule', 'WholeScheduleSwapRequest', 'AcademicTerm'], screen: 'schedule-swap' },
  scheduleSwapCompleted: { roles: ['normalStudent'], model: ['StudentSchedule', 'WholeScheduleSwapRequest'], screen: 'my-schedule' },
  extraHoursDecision: { roles: advising, model: 'ExtraHoursRequest', screen: 'extra-hours' },
  extraHoursRequested: { roles: coordinator, model: 'ExtraHoursRequest', screen: 'extra-hours' },
  paymentUpdated: { roles: advising, model: ['ExtraHoursRequest', 'FinancialTransaction', 'Payment'], screen: 'extra-hours' },
  deferredChargeUpdated: { roles: advising, model: ['ExtraHoursRequest', 'FinancialTransaction', 'DeferredCharge'], screen: 'extra-hours' },
  refundIssued: { roles: advising, model: ['ExtraHoursRequest', 'FinancialTransaction'], screen: 'extra-hours' },
  graduationPlanSubmitted: { roles: coordinator, model: 'GraduationPlan', screen: 'graduation-review' },
  graduationPlanDecision: { roles: advising, model: 'GraduationPlan', screen: 'my-graduation' },
  exitExamDecision: { roles: advising, model: 'ExitExamRequest', screen: 'my-graduation' },
  exitExamRequested: { roles: coordinator, model: 'ExitExamRequest', screen: 'graduation-review' },
  mandatoryCourseRemovalRequested: { roles: coordinator, model: 'MandatoryCourseRemovalRequest', screen: 'mandatory-removals' },
  financialReversalRequested: { roles: coordinator, model: ['FinancialReversalRequest', 'ExtraHoursRequest'], screen: 'financial-records' },
  advisingDeadlineReminder: { roles: staff, model: ['StudentSchedule', 'AcademicTerm'], screen: 'student-schedules' },
};
export function inApp(item) { return Array.isArray(item?.channels) && item.channels.includes('inApp'); }
export function emailOnly(item) { return Array.isArray(item?.channels) && item.channels.includes('email') && !inApp(item); }
export function unread(item) { return inApp(item) && !(item.isRead || item.readAt); }
export function passwordIssue(value) {
  if (typeof value !== 'string' || value.length < 8) return 'Use at least 8 characters.';
  if (new TextEncoder().encode(value).length > 72) return 'Use no more than 72 UTF-8 bytes.';
  return '';
}
export function relatedDestination(item, role) {
  const rule = rules[item?.type];
  if (!rule?.roles.includes(role)) return null;
  const models = Array.isArray(rule.model) ? rule.model : [rule.model];
  // Old server payloads omit these fields. Workspace navigation remains safe;
  // unknown/mismatched metadata never becomes an endpoint or a deep link.
  const validModel = !item.relatedModel || models.includes(item.relatedModel);
  if (!validModel) return null;
  const recordId = typeof item.relatedId === 'string' && /^[a-f\d]{24}$/i.test(item.relatedId) ? item.relatedId : null;
  return { screen: typeof rule.screen === 'function' ? rule.screen(role) : rule.screen,
    model: item.relatedModel || null, recordId, label: 'Open related workspace' };
}
/** Only GET endpoints verified in the supplied API. Authorization stays on the server. */
export function relatedRequest(item, role) {
  const to = relatedDestination(item, role);
  if (!to?.recordId || !to.model) return null;
  const id = encodeURIComponent(to.recordId);
  if (to.model === 'ExtraHoursRequest') return { path: `/api/extra-hours/${id}`, select: data => data };
  if (to.model === 'SlotChangeRequest') return role === 'advisingStudent'
    ? { path: '/api/slot-changes/me', select: data => data?.requests?.find(row => row._id === to.recordId) }
    : { path: `/api/slot-changes/${id}`, select: data => data?.request };
  if (to.model === 'FinancialTransaction' && role === 'advisingStudent') return {
    path: '/api/extra-hours/mine/financial-history', select: data => Array.isArray(data) ? data.find(row => row._id === to.recordId) : null,
  };
  if (['GraduationPlan', 'ExitExamRequest'].includes(to.model) && role === 'advisingStudent') return {
    path: '/api/graduation/me', select: data => (to.model === 'GraduationPlan' ? data?.plans : data?.exams)?.find(row => row._id === to.recordId),
  };
  if (to.model === 'ExitExamRequest' && role === 'coordinator') return {
    path: '/api/graduation/exit-exams', select: data => data?.requests?.find(row => row._id === to.recordId),
  };
  return null; // No invented graduation-plan-by-ID, reversal or reminder API.
}
export const humanize = value => String(value ?? 'Not provided').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
export function recordFields(record) {
  if (!record || typeof record !== 'object') return [];
  const value = item => typeof item === 'string' || typeof item === 'number' ? String(item) : null;
  return [
    ['Reference', value(record._id)], ['Status', value(record.status || record.decisionStatus)],
    ['Student ID', value(record.student?.studentId)], ['Course', value(record.course?.code)],
    ['Term', value(record.term?.code)], ['Component', value(record.componentType)],
    ['Requested hours', value(record.requestedHours || record.totalExtraHours)],
    ['Settlement', value(record.settlementStatus)], ['Amount', record.amount != null ? `${record.amount} ${record.currency || ''}`.trim() : null],
    ['Response', value(record.responseNote)], ['Current slot', value(record.currentSlotLabel)], ['Replacement slot', value(record.replacementSlotLabel)],
  ].filter(([, field]) => field !== null);
}
