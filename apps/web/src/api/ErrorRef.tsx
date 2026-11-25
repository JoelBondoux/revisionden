/** The short reference code shown with "Something went wrong", for the family to report. */
export function ErrorRef({ code }: { code: string | undefined }) {
  if (!code) return null;
  return (
    <p className="secondary-text error-ref">
      If it keeps happening, send us this code: <code>{code}</code>
    </p>
  );
}

/** The reference code of any error, when it has one. */
export function refOf(error: unknown): string | undefined {
  const ref = (error as { ref?: unknown } | null)?.ref;
  return typeof ref === 'string' ? ref : undefined;
}
