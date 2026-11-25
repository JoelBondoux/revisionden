import { describe, expect, it } from 'vitest';
import {
  COMPLAINT_ACKNOWLEDGE_WORKING_DAYS,
  COMPLAINT_RESOLVE_DAYS,
  ENGLAND_WALES_BANK_HOLIDAYS,
  complaintDueDates,
} from './complaints';

describe('complaint deadlines', () => {
  it('acknowledges within 2 working days and aims to resolve within 14 days', () => {
    expect(COMPLAINT_ACKNOWLEDGE_WORKING_DAYS).toBe(2);
    expect(COMPLAINT_RESOLVE_DAYS).toBe(14);
  });

  it('counts working days from the UK day it arrived, due at the end of that UK day', () => {
    // Wednesday 25 November 2026 (GMT).
    expect(complaintDueDates(new Date('2026-11-25T10:00:00Z'))).toEqual({
      acknowledgeDueAt: new Date('2026-11-27T23:59:59.999Z'),
      resolveDueAt: new Date('2026-12-09T23:59:59.999Z'),
    });
  });

  it('skips weekends', () => {
    // Friday 27 November 2026: Monday and Tuesday are the 2 working days.
    expect(complaintDueDates(new Date('2026-11-27T16:00:00Z')).acknowledgeDueAt).toEqual(
      new Date('2026-12-01T23:59:59.999Z'),
    );
  });

  it('skips England and Wales bank holidays', () => {
    // Thursday 24 December 2026: 25 and 28 December are bank holidays.
    expect(complaintDueDates(new Date('2026-12-24T09:00:00Z')).acknowledgeDueAt).toEqual(
      new Date('2026-12-30T23:59:59.999Z'),
    );
  });

  it('uses UK time in summer, so the day ends at 22:59:59 UTC', () => {
    // Wednesday 10 June 2026 (BST).
    expect(complaintDueDates(new Date('2026-06-10T12:00:00Z')).acknowledgeDueAt).toEqual(
      new Date('2026-06-12T22:59:59.999Z'),
    );
    // Arriving at 23:30 UK time on Tuesday 9 June still counts as Tuesday.
    expect(complaintDueDates(new Date('2026-06-09T22:30:00Z')).acknowledgeDueAt).toEqual(
      new Date('2026-06-11T22:59:59.999Z'),
    );
  });

  it('holds the official bank holiday list through 2028, in order (gov.uk)', () => {
    expect(ENGLAND_WALES_BANK_HOLIDAYS[0]).toBe('2026-01-01');
    expect(ENGLAND_WALES_BANK_HOLIDAYS.at(-1)).toBe('2028-12-26');
    expect([...ENGLAND_WALES_BANK_HOLIDAYS].sort()).toEqual([...ENGLAND_WALES_BANK_HOLIDAYS]);
  });
});

describe('complaint escalation and requests from a student', () => {
  it('can be escalated 5 working days after it was acknowledged, if not resolved by then', async () => {
    const { COMPLAINT_ESCALATE_AFTER_WORKING_DAYS, complaintEscalationFrom } =
      await import('./complaints');
    expect(COMPLAINT_ESCALATE_AFTER_WORKING_DAYS).toBe(5);
    // Acknowledged Wednesday 25 November 2026: the 5th working day is Wednesday 2 December.
    expect(complaintEscalationFrom(new Date('2026-11-25T15:00:00Z')).toISOString()).toBe(
      '2026-12-02T23:59:59.999Z',
    );
    // Acknowledged Thursday 24 December 2026: 25 and 28 December and 1 January are bank holidays.
    expect(complaintEscalationFrom(new Date('2026-12-24T09:00:00Z')).toISOString()).toBe(
      '2027-01-05T23:59:59.999Z',
    );
  });

  it('offers a student a few gentle topics to ask a parent about, never free choice of wording', async () => {
    const { COMPLAINT_REQUEST_TOPICS, ComplaintRequestCreateSchema } = await import('./complaints');
    expect(Object.keys(COMPLAINT_REQUEST_TOPICS)).toEqual([
      'marking',
      'unfair',
      'app_problem',
      'my_data',
      'something_else',
    ]);
    expect(ComplaintRequestCreateSchema.parse({ topic: 'marking' })).toEqual({ topic: 'marking' });
    expect(() => ComplaintRequestCreateSchema.parse({ topic: 'teacher' })).toThrow();
    expect(() =>
      ComplaintRequestCreateSchema.parse({ topic: 'unfair', note: 'x'.repeat(301) }),
    ).toThrow();
  });
});
