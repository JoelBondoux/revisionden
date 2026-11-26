import { useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../../components/icons';
import { LinkButton, TextLink } from '../../components/links';
import { categoriesFor, type ResolvedCategory } from './categories';
import {
  lastChecked,
  parentOnlyServices,
  servicesFor,
  type Audience,
  type Contact,
  type HelpTopic,
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
  const quickExit = () => navigate('/map', { replace: true });

  return (
    <div className="help-page">
      <div className="help-exit-bar">
        <button type="button" className="help-exit" onClick={quickExit}>
          Quick exit
        </button>
      </div>
      <h1>Get help</h1>
      <p className="help-danger">
        If you are in danger right now, call <TextLink href="tel:999">999</TextLink>.
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

      <TopicBrowser audience={audience} />

      <p className="help-footnote">
        Every number and link was checked on the service&apos;s own website on{' '}
        {formatDate(lastChecked())}.
      </p>
      <LinkButton
        to={audience === 'parent' ? '/parent' : '/map'}
        variant="quiet"
        icon={<BackIcon />}
      >
        {audience === 'parent' ? 'Back to parent home' : 'Back to the app'}
      </LinkButton>
    </div>
  );
}

/** Lower-case text a search can match: the topic's own words and its services' words. */
function searchText(audience: Audience, topic: HelpTopic): string {
  const services = servicesFor(audience, topic.id)
    .map((s) => [s.service, s.helps_with, s.note ?? ''].join(' '))
    .join(' ');
  return `${topic.title} ${topic.intro} ${services}`.toLowerCase();
}

/**
 * The topics in categories, with a filter box. "Right now" is always first and always open; the
 * other categories are native collapsible sections. The search lives only in this component's
 * state: it is never stored, sent or put in the address.
 */
function TopicBrowser({ audience }: { audience: Audience }) {
  const categories = useMemo(() => categoriesFor(audience), [audience]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(
    () => new Set(categories.filter((c) => c.openByDefault).map((c) => c.id)),
  );
  const term = query.trim().toLowerCase();
  const matches = (t: HelpTopic) => !term || searchText(audience, t).includes(term);
  const shown = categories.map((c) => ({
    ...c,
    // In danger right now stays whatever the search, so it is always first on the page.
    topics: c.topics.filter((t) => t.id === 'emergency' || matches(t)),
  }));
  const matchCount = term
    ? shown.flatMap((c) => c.topics).filter((t) => t.id !== 'emergency' && matches(t)).length
    : 0;
  const searchId = useId();

  return (
    <>
      <div className="help-search" role="search">
        <label htmlFor={searchId}>Find a topic</label>
        <div className="help-search__row">
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="help-search__clear" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </div>
        <p role="status" className="help-search__status">
          {!term
            ? ''
            : matchCount === 0
              ? 'No topics match. Try another word, or clear the search.'
              : `${matchCount} ${matchCount === 1 ? 'topic matches' : 'topics match'}`}
        </p>
      </div>

      {shown.map((c) =>
        c.topics.length === 0 ? null : c.id === 'right-now' ? (
          <section key={c.id} className="help-category" data-testid="help-category">
            <h2 className="help-category__title">{c.title}</h2>
            <TopicList audience={audience} category={c} />
          </section>
        ) : (
          <details
            key={c.id}
            className="help-category"
            data-testid="help-category"
            open={Boolean(term) || open.has(c.id)}
            onToggle={(e) => {
              if (term) return;
              const isOpen = e.currentTarget.open;
              setOpen((prev) => {
                if (prev.has(c.id) === isOpen) return prev;
                const next = new Set(prev);
                if (isOpen) next.add(c.id);
                else next.delete(c.id);
                return next;
              });
            }}
          >
            <summary className="help-category__summary">
              <span className="help-category__title">{c.title}</span>
              <span className="help-category__topics">
                {c.topics.map((t) => t.title).join(' · ')}
              </span>
            </summary>
            <TopicList audience={audience} category={c} />
          </details>
        ),
      )}
    </>
  );
}

function TopicList({ audience, category }: { audience: Audience; category: ResolvedCategory }) {
  return (
    <>
      {category.topics.map((t) => (
        <TopicCard key={t.id} id={t.id} title={t.title} intro={t.intro} urgent={t.urgent}>
          {servicesFor(audience, t.id).map((s) => (
            <ServiceEntry key={s.id} service={s} />
          ))}
        </TopicCard>
      ))}
    </>
  );
}

function WorriedAdults() {
  const headingId = useId();
  return (
    <section className="help-topic help-topic--adults" aria-labelledby={headingId}>
      <h2 id={headingId}>Worried about a child?</h2>
      <ul className="help-services">
        {parentOnlyServices().map((s) => (
          <ServiceEntry key={s.id} service={s} level={3} />
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
      <h3 id={headingId}>{title}</h3>
      <p>{intro}</p>
      <ul className="help-services">{children}</ul>
    </section>
  );
}

function ServiceEntry({ service, level = 4 }: { service: SupportService; level?: 3 | 4 }) {
  const Heading = level === 3 ? 'h3' : 'h4';
  const primary = service.contacts.filter((c) => c.kind === 'phone' || c.kind === 'text');
  const secondary = service.contacts.filter((c) => c.kind !== 'phone' && c.kind !== 'text');
  return (
    <li className="help-service">
      <div className="help-service__summary">
        <Heading className="help-service__name">
          <OrgIcon />
          {service.service}
        </Heading>
        <p>{service.helps_with}</p>
        {service.note && <p className="help-note">{service.note}</p>}
      </div>
      <ul className="help-service__actions">
        {[...primary, ...secondary].map((c, i) => (
          <li key={i}>
            <ContactButton contact={c} service={service.service} />
            {c.hours && <span className="help-meta">{c.hours.text}</span>}
          </li>
        ))}
      </ul>
      {(service.age_range || service.area) && (
        <details className="help-service__more">
          <summary>More about {service.service}</summary>
          {service.age_range && <p className="help-meta">For: {service.age_range.text}.</p>}
          {service.area && <p className="help-meta">Covers: {service.area.text}.</p>}
        </details>
      )}
    </li>
  );
}

/**
 * A neutral icon shown beside every organisation's name (W4). Organisations' logos are
 * trademarks; none is shown until its own guidance or written permission allows it
 * (docs/LOGO_PERMISSIONS.md). Decorative: the name next to it is the text.
 */
function OrgIcon() {
  return (
    <svg
      className="help-org-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One way to contact a service, as a clear button (shared LinkButton): calling and texting are
 * primary; chat, websites, WhatsApp and email are secondary. The wording is unchanged and
 * websites open in a new tab without a referrer.
 */
function ContactButton({ contact: c, service }: { contact: Contact; service: string }) {
  if (c.kind === 'phone') {
    return (
      <LinkButton href={c.href} variant="primary" block className="help-button">
        Call {c.number}
        {c.label && ` (${c.label})`}
      </LinkButton>
    );
  }
  if (c.kind === 'text') {
    return (
      <LinkButton href={c.href} variant="primary" block className="help-button">
        {c.keyword ? `Text ${c.keyword} to ${c.number}` : `Text ${c.number}`}
      </LinkButton>
    );
  }
  if (c.kind === 'email') {
    return (
      <LinkButton href={c.href} variant="secondary" block className="help-button">
        Email {c.address}
      </LinkButton>
    );
  }
  if (c.kind === 'whatsapp') {
    return (
      <LinkButton href={c.href} newTab variant="secondary" block className="help-button">
        WhatsApp {c.number}
      </LinkButton>
    );
  }
  const text = c.label ?? (c.kind === 'web_chat' ? 'Chat online' : `${service} website`);
  return (
    <LinkButton href={c.url} newTab variant="secondary" block className="help-button">
      {text}
    </LinkButton>
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
