import { useId, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  helpTopics,
  lastChecked,
  parentOnlyServices,
  servicesFor,
  type Audience,
  type Contact,
  type SupportService,
} from './data';
import './help.css';

/**
 * Get help (docs/PRODUCT_RULES.md): UK support services by topic. Private by design: this page
 * makes no requests, records nothing and tells nobody it was opened. Links only reach a service
 * when the reader taps one, and websites are opened without a referrer.
 */
export function HelpPage({ audience }: { audience: Audience }) {
  const navigate = useNavigate();
  const topics = helpTopics(audience);
  const quickExit = () => navigate('/map', { replace: true });

  return (
    <div className="help-page">
      <div className="help-page__bar">
        <button type="button" className="help-exit" onClick={quickExit}>
          Quick exit
        </button>
      </div>
      <h1>Get help</h1>
      <p className="help-danger">
        If you are in danger right now, call <a href="tel:999">999</a>.
      </p>
      <p>
        {audience === 'parent'
          ? 'Services for young people, and for adults who are worried about a child.'
          : "You don't have to deal with things on your own. These services are here to listen and help."}
      </p>
      <p className="help-private">
        This page is private. Nobody is told that you opened it or tapped a number, not your parents
        and not us.
      </p>

      {audience === 'parent' && <WorriedAdults />}

      <nav aria-label="Topics" className="help-topics-nav">
        <ul>
          {topics.map((t) => (
            <li key={t.id}>
              <a href={`#help-${t.id}`}>{t.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {topics.map((t) => (
        <TopicCard key={t.id} id={t.id} title={t.title} intro={t.intro} urgent={t.urgent}>
          {servicesFor(audience, t.id).map((s) => (
            <ServiceEntry key={s.id} service={s} />
          ))}
        </TopicCard>
      ))}

      <p className="help-footnote">
        Every number and link was checked on the service&apos;s own website on{' '}
        {formatDate(lastChecked())}.
      </p>
      <Link to={audience === 'parent' ? '/parent' : '/map'}>
        {audience === 'parent' ? 'Back to parent home' : 'Back to the app'}
      </Link>
    </div>
  );
}

function WorriedAdults() {
  const headingId = useId();
  return (
    <section className="help-topic help-topic--adults" aria-labelledby={headingId}>
      <h2 id={headingId}>Worried about a child?</h2>
      <ul className="help-services">
        {parentOnlyServices().map((s) => (
          <ServiceEntry key={s.id} service={s} />
        ))}
      </ul>
    </section>
  );
}

function TopicCard({
  id,
  title,
  intro,
  urgent,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  urgent: boolean;
  children: ReactNode;
}) {
  const headingId = `help-${id}-title`;
  return (
    <section
      id={`help-${id}`}
      className={`help-topic${urgent ? ' help-topic--urgent' : ''}`}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>{title}</h2>
      <p>{intro}</p>
      <ul className="help-services">{children}</ul>
    </section>
  );
}

function ServiceEntry({ service }: { service: SupportService }) {
  return (
    <li className="help-service">
      <h3>{service.service}</h3>
      <p>{service.helps_with}</p>
      {service.note && <p className="help-note">{service.note}</p>}
      {(service.age_range || service.area) && (
        <p className="help-meta">
          {service.age_range && <>For: {service.age_range.text}. </>}
          {service.area && <>Covers: {service.area.text}.</>}
        </p>
      )}
      <ul className="help-contacts">
        {service.contacts.map((c, i) => (
          <li key={i}>
            <ContactLink contact={c} service={service.service} />
            {c.hours && <span className="help-meta"> {c.hours.text}</span>}
          </li>
        ))}
      </ul>
    </li>
  );
}

function ContactLink({ contact: c, service }: { contact: Contact; service: string }) {
  if (c.kind === 'phone') {
    return (
      <a className="help-action" href={c.href}>
        Call {c.number}
        {c.label && ` (${c.label})`}
      </a>
    );
  }
  if (c.kind === 'text') {
    return (
      <a className="help-action" href={c.href}>
        {c.keyword ? `Text ${c.keyword} to ${c.number}` : `Text ${c.number}`}
      </a>
    );
  }
  if (c.kind === 'email') {
    return (
      <a className="help-action" href={c.href}>
        Email {c.address}
      </a>
    );
  }
  if (c.kind === 'whatsapp') {
    return (
      <a className="help-action help-action--web" href={c.href} target="_blank" rel="noreferrer">
        WhatsApp {c.number}
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  }
  const text = c.label ?? (c.kind === 'web_chat' ? 'Chat online' : `${service} website`);
  return (
    <a className="help-action help-action--web" href={c.url} target="_blank" rel="noreferrer">
      {text}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
