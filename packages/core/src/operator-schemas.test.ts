import { describe, expect, it } from 'vitest';
import {
  OperatorFamilyDetailSchema,
  OperatorFamilySearchQuerySchema,
  OperatorTicketSchema,
} from './operator-schemas';

const family = {
  id: '00000000-0000-4000-8000-000000000001',
  createdAt: '2026-11-01T10:00:00.000Z',
  lastActiveAt: '2026-11-24T10:00:00.000Z',
  deletesAfter: '2027-11-24T10:00:00.000Z',
  parents: [{ email: 'parent@example.com', joinedAt: '2026-11-01T10:00:00.000Z' }],
  plan: null,
  children: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      nickname: 'test_kid',
      yearGroup: 11,
      subjects: ['gcse-maths'],
      linkedDevices: 1,
      lastActiveAt: null,
    },
  ],
  flags: { inactivityWarning: false, openTickets: 0, openContentReports: 0 },
};

describe('operator response shapes (AppDeck bridge)', () => {
  it('accepts a family with minimal fields', () => {
    expect(OperatorFamilyDetailSchema.parse(family)).toEqual(family);
  });

  it('refuses anything extra on a family or child, such as answers or an avatar', () => {
    expect(() => OperatorFamilyDetailSchema.parse({ ...family, answers: [] })).toThrow();
    expect(() =>
      OperatorFamilyDetailSchema.parse({
        ...family,
        children: [{ ...family.children[0], avatarCode: 'x' }],
      }),
    ).toThrow();
  });

  it('never carries the text of a ticket a student sent', () => {
    const ticket = {
      id: '00000000-0000-4000-8000-000000000003',
      familyId: family.id,
      kind: 'bug',
      status: 'new',
      senderRole: 'student',
      text: 'something a child typed',
      device: null,
      createdAt: family.createdAt,
      updatedAt: family.createdAt,
      closedAt: null,
    };
    expect(() => OperatorTicketSchema.parse(ticket)).toThrow();
    expect(OperatorTicketSchema.parse({ ...ticket, text: null }).text).toBeNull();
    expect(OperatorTicketSchema.parse({ ...ticket, senderRole: 'parent' }).text).toBe(
      'something a child typed',
    );
  });

  it('searches by exactly one of email or family id', () => {
    expect(OperatorFamilySearchQuerySchema.parse({ email: ' Parent@Example.com ' })).toEqual({
      email: 'parent@example.com',
    });
    expect(OperatorFamilySearchQuerySchema.parse({ id: family.id })).toEqual({ id: family.id });
    expect(() => OperatorFamilySearchQuerySchema.parse({})).toThrow();
    expect(() =>
      OperatorFamilySearchQuerySchema.parse({ email: 'parent@example.com', id: family.id }),
    ).toThrow();
    expect(() => OperatorFamilySearchQuerySchema.parse({ email: 'parent' })).toThrow();
    expect(() => OperatorFamilySearchQuerySchema.parse({ id: 'not-an-id' })).toThrow();
  });
});
