import { createPolicyLibrary } from './library';

// The same Markdown files as docs/legal in the repository, imported at build (docs/LEGAL.md).
const files = import.meta.glob('../../../../../docs/legal/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The policies as built into this app, with placeholders filled from the build variables. */
export const defaultPolicyLibrary = createPolicyLibrary(files, {
  VITE_OPERATOR_NAME: import.meta.env.VITE_OPERATOR_NAME,
  VITE_CONTACT_EMAIL: import.meta.env.VITE_CONTACT_EMAIL,
  VITE_POSTAL_ADDRESS: import.meta.env.VITE_POSTAL_ADDRESS,
  VITE_POLICY_EFFECTIVE_DATE: import.meta.env.VITE_POLICY_EFFECTIVE_DATE,
  VITE_SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
});
