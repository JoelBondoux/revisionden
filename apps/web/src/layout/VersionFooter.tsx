import { TextLink } from '../components/links';
import { buildInfo, type BuildInfo } from '../features/about/buildInfo';

interface VersionFooterProps {
  version?: string;
  environment?: BuildInfo['environment'];
  /** Short commit of this build; shown outside the live app so testers can tell builds apart. */
  commit?: string;
}

/** Small footer with the app version (G5); the About page has the full build details. */
export function VersionFooter({
  version = buildInfo.version,
  environment = buildInfo.environment,
  commit = buildInfo.commit,
}: VersionFooterProps) {
  const label = `RevisionDen version ${version}`;
  const knownCommit = commit && commit !== 'unknown' ? `, ${commit}` : '';
  return (
    // Pieces sit in a wrapping flex row with a gap between them and no text separator, so a
    // wrapped line never starts or ends with a stray "·" (G7, G8). Each piece may wrap
    // inside itself too, so nothing overflows a narrow screen or large text (G9).
    <footer className="version-footer">
      <span className="version-footer-item">
        <TextLink to="/about">{label}</TextLink>
      </span>
      {environment === 'Live' ? null : (
        <>
          {' '}
          <span className="version-footer-item">{`(${environment}${knownCommit})`}</span>
        </>
      )}
    </footer>
  );
}
