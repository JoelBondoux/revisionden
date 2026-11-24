import { ButtonLink } from '../components/Button';

export function NotFoundPage() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p>Pip sniffed everywhere but couldn&apos;t find this page.</p>
      <ButtonLink to="/">Back to the start</ButtonLink>
    </div>
  );
}
