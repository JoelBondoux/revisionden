import { z } from 'zod';

/** Crockford-style letters and digits: no I, L, O or U, so a code is easy to read aloud. */
export const ERROR_REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const REF_LENGTH = 6;

/**
 * A short reference code (for example `RD-7K2M9Q`) shown with "Something went wrong" and logged
 * with the error, so the owner can find it. `random` returns a number in [0, 1).
 */
export function makeErrorRef(random: () => number): string {
  let code = '';
  for (let i = 0; i < REF_LENGTH; i += 1) {
    const index = Math.min(
      ERROR_REF_ALPHABET.length - 1,
      Math.floor(random() * ERROR_REF_ALPHABET.length),
    );
    code += ERROR_REF_ALPHABET[index];
  }
  return `RD-${code}`;
}

export const ErrorRefSchema = z
  .string()
  .regex(new RegExp(`^RD-[${ERROR_REF_ALPHABET}]{${REF_LENGTH}}$`), 'Not a reference code');

/** A path segment that looks like an id (has a digit, a capital letter or an underscore). */
const ID_LIKE = /[0-9A-Z_]/;
const API_VERSION = /^v\d+$/;

/** Drops the query string and replaces id-like segments with `:id`, so a path holds no ids. */
export function maskIdsInPath(path: string): string {
  const [bare = ''] = path.split(/[?#]/);
  return bare
    .split('/')
    .map((segment) => (ID_LIKE.test(segment) && !API_VERSION.test(segment) ? ':id' : segment))
    .join('/');
}

/**
 * Sent by the web app to `POST /v1/client-errors` when it shows "Something went wrong" for an
 * error the API did not give a reference for (for example a response in an unexpected shape).
 * Strict and free of text fields, so it cannot carry personal data.
 */
export const ClientErrorReportSchema = z
  .object({
    ref: ErrorRefSchema,
    kind: z.enum(['http', 'schema']),
    status: z.number().int().min(0).max(599).optional(),
    /** The request path with ids masked (`maskIdsInPath`); no query string. */
    path: z.string().regex(/^\/[a-z0-9/:._-]{0,120}$/, 'Not an id-free path'),
  })
  .strict();
export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
