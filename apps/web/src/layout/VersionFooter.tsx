import { Link } from 'react-router-dom';
import { buildInfo, type BuildInfo } from '../features/about/buildInfo';

interface VersionFooterProps {
  version?: string;
  environment?: BuildInfo['environment'];
}

/** Small footer with the app version (G5); the About page has the full build details. */
export function VersionFooter({
  version = buildInfo.version,
  environment = buildInfo.environment,
}: VersionFooterProps) {
  const label = `RevisionDen version ${version}`;
  return (
    <footer className="version-footer">
      <Link to="/about">{label}</Link>
      {environment === 'Live' ? null : ` (${environment})`}
    </footer>
  );
}
