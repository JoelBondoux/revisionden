import { Card } from '../components/Card';

interface ComingSoonProps {
  title: string;
  description: string;
}

/** Placeholder for pages that later workstreams will fill in. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <>
      <h1>{title}</h1>
      <Card>
        <p>{description}</p>
        <p className="secondary-text">Coming soon.</p>
      </Card>
    </>
  );
}
