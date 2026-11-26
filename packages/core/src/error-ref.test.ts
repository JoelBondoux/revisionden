import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  ClientErrorReportSchema,
  ErrorReportSchema,
  ErrorReportSummarySchema,
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
  it('accepts a passkey failure with the browser error name only', () => {
    const report = { ref: 'RD-7K2M9Q', kind: 'passkey', path: '/link', code: 'NotAllowedError' };
    expect(ClientErrorReportSchema.parse(report)).toEqual(report);
    expect(
      ClientErrorReportSchema.safeParse({ ...report, code: 'The user said no, Sam' }).success,
    ).toBe(false);
  });

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
      ClientErrorReportSchema.safeParse({
        ...base,
        path: '/v1/students/3f2b1c9e-1111-4a2b-9c3d-123456789abc/map',
      }).success,
    ).toBe(false);
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

describe('error reports (Send error report button)', () => {
  const report = {
    ref: 'RD-VDMW5E',
    screen: '/map',
    apiPath: '/v1/student/map',
    status: 404,
    build: '00.01.002-48657ff',
    browser: 'Safari',
    online: true,
    at: '2026-11-25T08:00:00.000Z',
  };

  it('accepts the code, screen, failing API call, build, browser, online and time', () => {
    expect(ErrorReportSchema.parse(report)).toEqual(report);
    const minimal = { ...report, apiPath: undefined, status: undefined };
    delete minimal.apiPath;
    delete minimal.status;
    expect(ErrorReportSchema.parse(minimal)).toEqual(minimal);
  });

  it('refuses ids, free text and anything extra, so a report stays anonymous', () => {
    expect(
      ErrorReportSchema.safeParse({ ...report, screen: '/family/Sam_1/rewards' }).success,
    ).toBe(false);
    expect(
      ErrorReportSchema.safeParse({ ...report, browser: 'Chrome 131 on Sam’s iPad' }).success,
    ).toBe(false);
    expect(ErrorReportSchema.safeParse({ ...report, nickname: 'sam' }).success).toBe(false);
    expect(ErrorReportSchema.safeParse({ ...report, build: 'sam@example.com' }).success).toBe(
      false,
    );
  });

  it('describes the grouped summary the operator reads', () => {
    const summary = {
      since: '2026-11-24T00:00:00.000Z',
      total: 2,
      groups: [
        {
          screen: '/map',
          apiPath: '/v1/student/map',
          status: 404,
          count: 2,
          refs: ['RD-VDMW5E', 'RD-7K2M9Q'],
          builds: ['00.01.002-48657ff'],
          firstSeen: '2026-11-25T08:00:00.000Z',
          lastSeen: '2026-11-25T08:05:00.000Z',
        },
      ],
    };
    expect(ErrorReportSummarySchema.parse(summary)).toEqual(summary);
  });
});
