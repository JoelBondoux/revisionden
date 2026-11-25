import changelogText from '../../../../../CHANGELOG.md?raw';
import { Card } from '../../components/Card';
import { BugIcon, DocumentIcon, IdeaIcon, ShieldIcon } from '../../components/icons';
import { LinkTile, TextLink } from '../../components/links';
import { usePolicyLibrary } from '../legal/PolicyLibraryContext';
import { SUPPORT_EMAIL } from '../legal/supportEmail';
import { buildInfo, type BuildInfo } from './buildInfo';
import { parseWhatsNew } from './whatsNew';
import './about.css';

interface AboutPageProps {
  info?: BuildInfo;
  changelog?: string;
}

/** Version facts, the plain-English changelog, policies, licences and feedback links. */
export function AboutPage({ info = buildInfo, changelog = changelogText }: AboutPageProps) {
  const versions = parseWhatsNew(changelog);
  const policies = usePolicyLibrary().available();

  return (
    <div className="stack about">
      <h1>About RevisionDen</h1>

      <Card title="This version">
        <dl className="about__facts">
          <dt>Version</dt>
          <dd>{info.version}</dd>
          <dt>Environment</dt>
          <dd>{info.environment}</dd>
          <dt>Built on</dt>
          <dd>{info.buildDate}</dd>
          <dt>Commit</dt>
          <dd>
            <code>{info.commit}</code>
          </dd>
        </dl>
      </Card>

      <Card title="What's new">
        {versions.length === 0 ? (
          <p className="secondary-text">Nothing to show yet.</p>
        ) : (
          versions.map((v) => (
            <div key={v.version} className="about__version">
              <h3>
                {v.version === 'Unreleased'
                  ? 'Latest changes (not released yet)'
                  : `Version ${v.version}${v.date ? ` · ${v.date}` : ''}`}
              </h3>
              <ul>
                {v.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>

      <Card title="Tell us what you think">
        <p>
          Need help? Email <TextLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</TextLink>
        </p>
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/feedback?kind=bug"
              icon={<BugIcon />}
              title="Report a bug"
              description="Something broken or wrong"
            />
          </li>
          <li>
            <LinkTile
              to="/feedback?kind=idea"
              icon={<IdeaIcon />}
              title="Send an idea"
              description="Something you'd like us to add"
            />
          </li>
        </ul>
      </Card>

      <Card title="Policies">
        <ul className="link-tiles">
          {policies.map((p) => (
            <li key={p.name}>
              <LinkTile to={`/legal/${p.name}`} icon={<DocumentIcon />} title={p.title} />
            </li>
          ))}
          <li>
            <LinkTile to="/legal" icon={<ShieldIcon />} title="All policies" />
          </li>
        </ul>
      </Card>

      <Card title="Open-source licences">
        <p className="secondary-text">RevisionDen is built with these open-source packages.</p>
        <ul className="about__licences">
          {info.licences.map((l) => (
            <li key={l.name}>
              {l.name} {l.version} <span className="secondary-text">({l.licence})</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
