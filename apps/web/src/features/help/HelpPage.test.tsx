import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test/render';
import { helpTopics, lastChecked, parentOnlyServices, servicesFor, supportData } from './data';

describe('Get help data', () => {
  it('gives every topic at least one service for students', () => {
    for (const topic of helpTopics('student')) {
      expect(servicesFor('student', topic.id).length).toBeGreaterThan(0);
    }
  });

  it('keeps the NSPCC adult helpline for parents only', () => {
    const studentIds = supportData.services
      .filter((s) => s.audiences.includes('student'))
      .map((s) => s.id);
    expect(studentIds).not.toContain('nspcc-helpline');
    expect(parentOnlyServices().map((s) => s.id)).toEqual([
      'nspcc-helpline',
      'coram-kidscape-parent-advice-line',
      'anti-bullying-alliance',
    ]);
  });

  it('reports the oldest check date', () => {
    expect(lastChecked()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Get help page', () => {
  it('starts with how to call 999 in an emergency', () => {
    renderRoute('/help');
    expect(screen.getByRole('heading', { level: 1, name: 'Get help' })).toBeInTheDocument();
    const danger = screen.getByText(/If you are in danger right now, call/);
    expect(danger).toHaveTextContent('If you are in danger right now, call 999.');
    expect(within(danger).getByRole('link', { name: '999' })).toHaveAttribute('href', 'tel:999');
  });

  it('says the page is private', () => {
    renderRoute('/help');
    expect(screen.getByText(/This page is private/)).toBeInTheDocument();
  });

  it('shows each topic as its own card', () => {
    renderRoute('/help');
    for (const topic of helpTopics('student')) {
      expect(screen.getByRole('region', { name: topic.title })).toBeInTheDocument();
    }
  });

  it('has tap-to-call and tap-to-text links', () => {
    renderRoute('/help');
    const childline = screen.getAllByRole('link', { name: /Call 0800 1111/ });
    expect(childline[0]).toHaveAttribute('href', 'tel:08001111');
    const shout = screen.getAllByRole('link', { name: /Text SHOUT to 85258/ });
    expect(shout[0]).toHaveAttribute('href', 'sms:85258?&body=SHOUT');
  });

  it('opens websites in a new tab without telling them where you came from', () => {
    renderRoute('/help');
    const web = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('https://'));
    expect(web.length).toBeGreaterThan(0);
    for (const a of web) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noreferrer');
    }
  });

  it('does not show the adult helpline to students', () => {
    renderRoute('/help');
    expect(screen.queryByText('NSPCC Helpline')).not.toBeInTheDocument();
  });

  it('adds the NSPCC helpline for worried adults on the parent version', () => {
    renderRoute('/parent/help', { studentId: null });
    const adults = screen.getByRole('region', { name: 'Worried about a child?' });
    expect(within(adults).getByRole('link', { name: /0808 800 5000/ })).toHaveAttribute(
      'href',
      'tel:08088005000',
    );
  });

  it('adds the Coram Kidscape Parent Advice Line and WhatsApp for parents', () => {
    renderRoute('/parent/help', { studentId: null });
    const adults = screen.getByRole('region', { name: 'Worried about a child?' });
    expect(within(adults).getByRole('link', { name: 'Call 0300 102 4481' })).toHaveAttribute(
      'href',
      'tel:03001024481',
    );
    expect(within(adults).getByRole('link', { name: /WhatsApp 0300 102 4481/ })).toHaveAttribute(
      'href',
      'https://wa.me/443001024481',
    );
    expect(
      within(adults).getByRole('link', { name: 'Email pal@coramkidscape.org.uk' }),
    ).toHaveAttribute('href', 'mailto:pal@coramkidscape.org.uk');
  });

  it('points students with bullying to Childline and Coram Kidscape, not the parent-only lines', () => {
    renderRoute('/help');
    const bullying = screen.getByRole('region', { name: 'Bullying, online or in person' });
    expect(within(bullying).getByText('Childline')).toBeInTheDocument();
    expect(within(bullying).getByText('Coram Kidscape')).toBeInTheDocument();
    expect(screen.queryByText('Anti-Bullying Alliance')).not.toBeInTheDocument();
    expect(screen.queryByText(/0300 102 4481/)).not.toBeInTheDocument();
  });

  it('shows Kooth under feeling low with a note that it is only free in some areas', () => {
    renderRoute('/help');
    const low = screen.getByRole('region', { name: 'Feeling low, worried or anxious' });
    expect(within(low).getByText('Kooth (Soluna by Kooth)')).toBeInTheDocument();
    expect(
      within(low).getByText(
        "Free in some parts of the UK. Check if it's available where you live.",
      ),
    ).toBeInTheDocument();
  });

  it('works when signed out', () => {
    renderRoute('/help', { studentId: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Get help' })).toBeInTheDocument();
  });

  it('Quick exit replaces this page in history and opens the topic map', async () => {
    const { router } = renderRoute('/help');
    await userEvent.click(screen.getByRole('button', { name: 'Quick exit' }));
    expect(router.state.location.pathname).toBe('/map');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('makes no network requests at all, signed in or out', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const first = renderRoute('/help');
    first.unmount();
    renderRoute('/parent/help', { studentId: null });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    open.mockRestore();
  });

  it('loads nothing from other sites (no images, frames or scripts)', () => {
    const { container } = renderRoute('/help');
    expect(container.querySelectorAll('img, iframe, script, link, video, audio')).toHaveLength(0);
  });
});

describe('ways to reach Get help', () => {
  it('Settings links to it, first on the page and only once', () => {
    renderRoute('/settings');
    const main = screen.getByRole('main');
    const links = within(main).getAllByRole('link', { name: /^Get help/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/help');
  });

  it('the student footer has no Get help link any more (it lives on Settings)', () => {
    renderRoute('/map');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByRole('link', { name: 'Get help' })).toBeNull();
  });

  it('the signed-out header links to it', () => {
    renderRoute('/about', { studentId: null });
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Get help' })).toHaveAttribute('href', '/help');
  });

  it('parent home links to the parent version', () => {
    renderRoute('/parent', { studentId: null });
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute('href', '/parent/help');
  });
});

describe('organisation icons', () => {
  it('shows a neutral icon beside every organisation until a logo is permitted', () => {
    const { container } = renderRoute('/parent/help', { studentId: null });
    const services = container.querySelectorAll('.help-service');
    expect(services.length).toBeGreaterThan(0);
    for (const s of services) {
      const icon = s.querySelector('.help-org-icon');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(s.querySelector('img')).toBeNull();
    }
  });
});
