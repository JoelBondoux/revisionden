import { TextLink } from '../components/links';
import { buildInfo, type BuildInfo } from '../features/about/buildInfo';
import { GetHelpLink } from '../features/help';

interface VersionFooterProps {
  version?: string;
  environment?: BuildInfo['environment'];
  /** Short commit of this build; shown outside the live app so testers can tell builds apart. */
  commit?: string;
  /** Show the small heart "Get help" link (student screens). */
  showHelp?: boolean;
}

/** Small footer with the app version (G5); the About page has the full build details. */
export function VersionFooter({
  version = buildInfo.version,
  environment = buildInfo.environment,
  commit = buildInfo.commit,
  showHelp = false,
}: VersionFooterProps) {
  const label = `RevisionDen version ${version}`;
  const knownCommit = commit && commit !== 'unknown' ? `, ${commit}` : '';
  return (
    <footer className="version-footer">
      <TextLink to="/about">{label}</TextLink>
      {environment === 'Live' ? null : (
        <>
          {' '}
          <span className="version-footer-item">{`(${environment}${knownCommit})`}</span>
        </>
      )}
      {showHelp && (
        <>
          {' '}
          {/* The dot travels with the link (no-break space, nowrap), so a wrapped line never ends
              in a stray "·". */}
          <span className="version-footer-item">
            {'·\u00a0'}
            <GetHelpLink />
          </span>
        </>
      )}
    </footer>
  );
}
