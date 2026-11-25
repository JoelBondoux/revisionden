/**
 * Formal complaints (workstream O4, `docs/legal/complaints-policy.md`): we acknowledge within 2
 * working days and aim to resolve within 14 days. Working days skip weekends and England and
 * Wales bank holidays; days are UK days (Europe/London).
 */
import { z } from 'zod';

export const COMPLAINT_ACKNOWLEDGE_WORKING_DAYS = 2;
export const COMPLAINT_RESOLVE_DAYS = 14;
/** Owner, 2026-11-25: a complaint not resolved within 5 working days of acknowledgement can be escalated. */
export const COMPLAINT_ESCALATE_AFTER_WORKING_DAYS = 5;
/** Longest complaint summary (matches AppDeck's limit). */
export const COMPLAINT_SUMMARY_MAX = 500;

/**
 * England and Wales bank holidays, from the official list at https://www.gov.uk/bank-holidays.json
 * (fetched 2026-11-25). Extend it before the end of 2028; after the last date only weekends
 * are skipped.
 */
export const ENGLAND_WALES_BANK_HOLIDAYS = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-06',
  '2026-05-04',
  '2026-05-25',
  '2026-08-31',
  '2026-12-25',
  '2026-12-28',
  '2027-01-01',
  '2027-03-26',
  '2027-03-29',
  '2027-05-03',
  '2027-05-31',
  '2027-08-30',
  '2027-12-27',
  '2027-12-28',
  '2028-01-03',
  '2028-04-14',
  '2028-04-17',
  '2028-05-01',
  '2028-05-29',
  '2028-08-28',
  '2028-12-25',
  '2028-12-26',
] as const;

const HOLIDAYS = new Set<string>(ENGLAND_WALES_BANK_HOLIDAYS);
const DAY_MS = 24 * 60 * 60 * 1000;

/** The UK calendar date (YYYY-MM-DD) of an instant. */
function ukDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The last millisecond of a UK calendar date, as an instant. */
function ukEndOfDay(date: string): Date {
  const utcEnd = new Date(`${date}T23:59:59.999Z`);
  // In summer (BST) the UK day ends an hour earlier in UTC.
  const hourInUk = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(`${date}T12:00:00Z`)),
  );
  return new Date(utcEnd.getTime() - (hourInUk - 12) * 60 * 60 * 1000);
}

const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

function isWorkingDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(date);
}

/** The UK date `days` working days after the UK day of `at`. */
function workingDaysAfter(at: Date, days: number): string {
  let day = ukDate(at);
  for (let left = days; left > 0;) {
    day = addDays(day, 1);
    if (isWorkingDay(day)) left -= 1;
  }
  return day;
}

/** When we aim to acknowledge a complaint that arrived at `receivedAt`, and to resolve it. */
export function complaintDueDates(receivedAt: Date): {
  acknowledgeDueAt: Date;
  resolveDueAt: Date;
} {
  return {
    acknowledgeDueAt: ukEndOfDay(workingDaysAfter(receivedAt, COMPLAINT_ACKNOWLEDGE_WORKING_DAYS)),
    resolveDueAt: ukEndOfDay(addDays(ukDate(receivedAt), COMPLAINT_RESOLVE_DAYS)),
  };
}

/** After this time an acknowledged complaint that is not resolved can be escalated. */
export function complaintEscalationFrom(acknowledgedAt: Date): Date {
  return ukEndOfDay(workingDaysAfter(acknowledgedAt, COMPLAINT_ESCALATE_AFTER_WORKING_DAYS));
}

/**
 * What a student can ask a parent to raise (owner, 2026-11-25: only parents complain). The
 * parent sees the topic and the student's optional note; neither ever reaches AppDeck.
 */
export const COMPLAINT_REQUEST_TOPICS = {
  marking: 'A mark or a question seemed wrong',
  unfair: 'Something felt unfair',
  app_problem: 'Something in the app is not working',
  my_data: 'How my information is used',
  something_else: 'Something else',
} as const;
export type ComplaintRequestTopic = keyof typeof COMPLAINT_REQUEST_TOPICS;

/**
 * The summary a parent starts with when they raise a child's request. Only the topic: a nickname
 * would be refused as personal details, and the child's note stays in the family.
 */
export function complaintSummaryFromRequest(topic: ComplaintRequestTopic): string {
  return `Raised for my child: ${COMPLAINT_REQUEST_TOPICS[topic]}.`;
}

export const ComplaintRequestCreateSchema = z
  .object({
    topic: z.enum(
      Object.keys(COMPLAINT_REQUEST_TOPICS) as [ComplaintRequestTopic, ...ComplaintRequestTopic[]],
    ),
    note: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

export const ComplaintCreateSchema = z
  .object({
    summary: z.string().trim().min(3).max(COMPLAINT_SUMMARY_MAX),
    aboutPersonalData: z.boolean(),
    /** Started from a child's "ask a parent" request, which is then removed. */
    fromRequestId: z.string().uuid().optional(),
  })
  .strict();

export const ComplaintMessageBodySchema = z
  .object({ text: z.string().trim().min(1).max(5000) })
  .strict();
