/**
 * Privacy guard: lists columns whose names suggest they hold a student's real name, date of
 * birth, email, photo or school name. Run against a migrated database (tests use PGlite), so it
 * also catches columns added by hand-written SQL.
 */

export interface QueryClient {
  query<T>(sql: string): Promise<{ rows: T[] }>;
}

export interface ForbiddenColumn {
  table: string;
  column: string;
}

const FORBIDDEN = [
  /(^|_)name$/, // name, first_name, full_name, school_name, real_name ...
  /(^|_)(first|last|given|family|middle|sur)name/,
  /surname/,
  /birth/,
  /(^|_)dob($|_)/,
  /e_?mail/,
  /photo|picture|image|selfie/,
  /school/,
  /(^|_)(address|phone|postcode|location)($|_)/,
];

/**
 * Columns allowed despite matching: the parent's Better Auth records. `email` and
 * `email_verified` are the parent's sign-in email; `name` and `image` are required by Better Auth
 * and always stored blank; `ip_address` is required too but IP tracking is switched off, so it
 * stays empty. `operator_audit_log.operator_email`, `operator_notes.author_email` and
 * `feedback_replies.author_email` are the work email of the owner's support staff (from AppDeck),
 * never a family's. Nothing about a student may ever be added here.
 */
const ALLOWED = new Set([
  'auth_users.name',
  'auth_users.email',
  'auth_users.email_verified',
  'auth_users.image',
  'auth_sessions.ip_address',
  'operator_audit_log.operator_email',
  'operator_notes.author_email',
  'feedback_replies.author_email',
]);

export async function findForbiddenColumns(client: QueryClient): Promise<ForbiddenColumn[]> {
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' order by table_name, ordinal_position`,
  );
  return rows
    .filter((r) => !ALLOWED.has(`${r.table_name}.${r.column_name}`))
    .filter((r) => FORBIDDEN.some((re) => re.test(r.column_name.toLowerCase())))
    .map((r) => ({ table: r.table_name, column: r.column_name }));
}
