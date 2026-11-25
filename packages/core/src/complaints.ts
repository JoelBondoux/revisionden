/**
 * Formal complaints (workstream O4, `docs/legal/complaints-policy.md`): we acknowledge within 2
 * working days and aim to resolve within 14 days. Working days skip weekends and England and
 * Wales bank holidays; days are UK days (Europe/London).
 */
import { z } from 'zod';

export const COMPLAINT_ACKNOWLEDGE_WORKING_DAYS = 2;
export const COMPLAINT_RESOLVE_DAYS = 14;
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

/** When a complaint that arrived at `receivedAt` must be acknowledged, and should be resolved. */
export function complaintDueDates(receivedAt: Date): {
  acknowledgeDueAt: Date;
  resolveDueAt: Date;
} {
  const received = ukDate(receivedAt);
  let day = received;
  for (let left = COMPLAINT_ACKNOWLEDGE_WORKING_DAYS; left > 0;) {
    day = addDays(day, 1);
    if (isWorkingDay(day)) left -= 1;
  }
  return {
    acknowledgeDueAt: ukEndOfDay(day),
    resolveDueAt: ukEndOfDay(addDays(received, COMPLAINT_RESOLVE_DAYS)),
  };
}

export const ComplaintCreateSchema = z
  .object({
    summary: z.string().trim().min(3).max(COMPLAINT_SUMMARY_MAX),
    aboutPersonalData: z.boolean(),
  })
  .strict();

export const ComplaintMessageBodySchema = z
  .object({ text: z.string().trim().min(1).max(5000) })
  .strict();
