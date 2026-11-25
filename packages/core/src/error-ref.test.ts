import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  ClientErrorReportSchema,
  ERROR_REF_ALPHABET,
  ErrorRefSchema,
  makeErrorRef,
  maskIdsInPath,
} from './index';

describe('error reference codes', () => {
  it('makes a short code like RD-7K2M9Q from injected randomness', () => {
    const ref = makeErrorRef(() => 0);
    expect(ref).toBe('RD-000000');
    expect(ErrorRefSchema.parse(makeErrorRef(Math.random))).toMatch(/^RD-[0-9A-Z]{6}$/);
  });

  it('uses only letters and digits that are easy to read aloud (no I, L, O or U)', () => {
    expect(ERROR_REF_ALPHABET).not.toMatch(/[ILOU]/);
    const ref = makeErrorRef(() => 0.9999);
    expect(ref).toBe(`RD-${ERROR_REF_ALPHABET.at(-1)!.repeat(6)}`);
  });

  it('rejects anything that is not a reference code', () => {
    expect(ErrorRefSchema.safeParse('RD-ABC').success).toBe(false);
    expect(ErrorRefSchema.safeParse('hello@example.com').success).toBe(false);
  });

  it('lets an API error body carry a reference code', () => {
    const body = {
      error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' },
    };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
  });
});

describe('client error reports', () => {
  it('accepts a reference, kind, status and an id-free path', () => {
    const report = { ref: 'RD-7K2M9Q', kind: 'schema', status: 200, path: '/v1/students/:id/map' };
    expect(ClientErrorReportSchema.parse(report)).toEqual(report);
  });

  it('refuses free text, query strings and extra fields, so no personal data can be sent', () => {
    const base = { ref: 'RD-7K2M9Q', kind: 'http', status: 404 };
    expect(ClientErrorReportSchema.safeParse({ ...base, path: '/v1/x?nickname=sam' }).success).toBe(
      false,
    );
    expect(ClientErrorReportSchema.safeParse({ ...base, path: '/v1/a b' }).success).toBe(false);
    expect(
      ClientErrorReportSchema.safeParse({ ...base, path: '/v1/x', message: 'hi' }).success,
    ).toBe(false);
  });

  it('replaces ids in a path with :id', () => {
    expect(maskIdsInPath('/v1/students/3f2b1c9e-1111-4a2b-9c3d-123456789abc/map')).toBe(
      '/v1/students/:id/map',
    );
    expect(maskIdsInPath('/v1/student/flashcards/12345/review')).toBe(
      '/v1/student/flashcards/:id/review',
    );
    expect(maskIdsInPath('/v1/student/learn/lesson?topicId=n1')).toBe('/v1/student/learn/lesson');
    expect(maskIdsInPath('/v1/students/Sam_99/rewards')).toBe('/v1/students/:id/rewards');
  });
});
