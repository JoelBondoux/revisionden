import { Link } from 'react-router-dom';
import changelogText from '../../../../../CHANGELOG.md?raw';
import { Card } from '../../components/Card';
import { usePolicyLibrary } from '../legal/PolicyLibraryContext';
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
        <ul className="link-list">
          <li>
            <Link to="/feedback?kind=bug">Report a bug</Link>
          </li>
          <li>
            <Link to="/feedback?kind=idea">Send an idea</Link>
          </li>
        </ul>
      </Card>

      <Card title="Policies">
        <ul className="link-list">
          {policies.map((p) => (
            <li key={p.name}>
              <Link to={`/legal/${p.name}`}>{p.title}</Link>
            </li>
          ))}
          <li>
            <Link to="/legal">All policies</Link>
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
