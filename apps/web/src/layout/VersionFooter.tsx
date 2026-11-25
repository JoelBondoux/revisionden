import { TextLink } from '../components/links';
import { buildInfo, type BuildInfo } from '../features/about/buildInfo';
import { GetHelpLink } from '../features/help';

interface VersionFooterProps {
  version?: string;
  environment?: BuildInfo['environment'];
  /** Show the small heart "Get help" link (student screens). */
  showHelp?: boolean;
}

/** Small footer with the app version (G5); the About page has the full build details. */
export function VersionFooter({
  version = buildInfo.version,
  environment = buildInfo.environment,
  showHelp = false,
}: VersionFooterProps) {
  const label = `RevisionDen version ${version}`;
  return (
    <footer className="version-footer">
      <TextLink to="/about">{label}</TextLink>
      {environment === 'Live' ? null : ` (${environment})`}
      {showHelp && (
        <>
          {' · '}
          <GetHelpLink />
        </>
      )}
    </footer>
  );
}
