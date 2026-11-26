import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test/render';
import { HELP_CATEGORIES, categoriesFor } from './categories';
import { helpTopics, servicesFor, supportData } from './data';

describe('Get help categories', () => {
  it('puts every topic in exactly one category', () => {
    const placed = HELP_CATEGORIES.flatMap((c) => c.topics);
    expect([...placed].sort()).toEqual(supportData.topics.map((t) => t.id).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('always starts with "In danger right now"', () => {
    expect(HELP_CATEGORIES[0]!.id).toBe('right-now');
    expect(HELP_CATEGORIES[0]!.topics[0]).toBe('emergency');
    expect(categoriesFor('student')[0]!.topics[0]!.id).toBe('emergency');
  });
});

describe('Get help page layout', () => {
  it('shows "In danger right now" first, always open', () => {
    renderRoute('/help');
    const groups = screen.getAllByTestId('help-category');
    expect(groups[0]).toHaveTextContent('Right now');
    expect(within(groups[0]!).getByRole('heading', { name: 'In danger right now' })).toBeVisible();
    expect(groups[0]!.tagName).not.toBe('DETAILS');
  });

  it('groups the other topics into collapsible categories', async () => {
    renderRoute('/help');
    const home = screen.getByText('Home, school and friends').closest('details')!;
    expect(home).not.toHaveAttribute('open');
    await userEvent.click(within(home).getByText('Home, school and friends'));
    expect(home).toHaveAttribute('open');
    const feelings = screen.getByText('Feelings and mental health').closest('details')!;
    expect(feelings).toHaveAttribute('open');
  });

  it('keeps every verified service on the page', () => {
    const { container } = renderRoute('/help');
    const shown = new Set(
      [...container.querySelectorAll('.help-service h3, .help-service h4')].map(
        (h) => h.textContent,
      ),
    );
    for (const t of helpTopics('student'))
      for (const s of servicesFor('student', t.id)) expect(shown).toContain(s.service);
  });

  it('filters topics and services by a word, and shows how many match', async () => {
    renderRoute('/help');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a topic' }), 'bully');
    expect(screen.getByRole('status')).toHaveTextContent('1 topic matches');
    const bullying = screen.getByRole('region', { name: 'Bullying, online or in person' });
    expect(bullying.closest('details')).toHaveAttribute('open');
    expect(
      screen.queryByRole('region', { name: 'Feeling low, worried or anxious' }),
    ).not.toBeInTheDocument();
    // In danger right now stays first, whatever the search.
    expect(screen.getByRole('region', { name: 'In danger right now' })).toBeInTheDocument();
  });

  it('says so when nothing matches, and clearing shows everything again', async () => {
    renderRoute('/help');
    const box = screen.getByRole('searchbox', { name: 'Find a topic' });
    await userEvent.type(box, 'zzzz');
    expect(screen.getByRole('status')).toHaveTextContent('No topics match');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(box).toHaveValue('');
    expect(
      screen.getByRole('region', { name: 'Feeling low, worried or anxious' }),
    ).toBeInTheDocument();
  });

  it('searching records nothing: no requests, no storage, no change to the address', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { router } = renderRoute('/help');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a topic' }), 'exam');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe('');
    expect(router.state.location.hash).toBe('');
    fetchSpy.mockRestore();
    setItem.mockRestore();
  });

  it('keeps Quick exit in a bar fixed to the top of the screen', () => {
    renderRoute('/help');
    const exit = screen.getByRole('button', { name: 'Quick exit' });
    expect(exit.closest('.help-exit-bar')).not.toBeNull();
  });
});

describe('finding Get help from the student screens (owner, 2026-11-26: Settings only)', () => {
  it('student screens have no Get help chip in the header and no heart link in the footer', async () => {
    for (const path of ['/map', '/cards', '/plan', '/progress']) {
      const { container, unmount } = renderRoute(path);
      await screen.findByRole('navigation', { name: 'Main' });
      const header = container.querySelector<HTMLElement>('.sound-header')!;
      expect(within(header).queryByRole('link', { name: 'Get help' })).toBeNull();
      expect(
        within(screen.getByRole('contentinfo')).queryByRole('link', { name: 'Get help' }),
      ).toBeNull();
      unmount();
    }
  });

  it('the main nav reaches Settings, where Get help is the first thing', async () => {
    renderRoute('/map');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await userEvent.click(
      within(nav).getByRole('link', { name: 'Me, settings and personalisation' }),
    );
    const main = screen.getByRole('main');
    await within(main).findByRole('heading', { level: 1, name: 'Settings' });
    const header = main.querySelector('.sound-header')!;
    const pageLinks = within(main)
      .getAllByRole('link')
      .filter((a) => !header.contains(a));
    expect(pageLinks[0]).toHaveAccessibleName(expect.stringMatching(/^Get help/));
    expect(pageLinks[0]).toHaveAttribute('href', '/help');
    // Progress moved off the main nav onto Me too (owner, 2026-11-26), right after Get help.
    expect(pageLinks[1]).toHaveAccessibleName(expect.stringMatching(/^My progress/));
    expect(pageLinks[1]).toHaveAttribute('href', '/progress');
  });
});

describe('service cards', () => {
  it('shows call and text actions as primary buttons, keeping tel: and sms: links', () => {
    renderRoute('/help');
    const call = screen.getAllByRole('link', { name: 'Call 0800 1111' })[0]!;
    expect(call).toHaveAttribute('href', 'tel:08001111');
    expect(call).toHaveClass('btn', 'btn--primary');
    const text = screen.getAllByRole('link', { name: 'Text SHOUT to 85258' })[0]!;
    expect(text).toHaveAttribute('href', 'sms:85258?&body=SHOUT');
    expect(text).toHaveClass('btn', 'btn--primary');
  });

  it('shows chat and website actions as secondary buttons that open in a new tab', () => {
    renderRoute('/help');
    const chat = screen.getAllByRole('link', { name: /1-2-1 counsellor chat/ })[0]!;
    expect(chat).toHaveClass('btn', 'btn--secondary');
    expect(chat).toHaveAttribute('target', '_blank');
    const site = screen.getAllByRole('link', { name: /Childline website/ })[0]!;
    expect(site).toHaveClass('btn', 'btn--secondary');
  });

  it('has no plain text links among the service actions', () => {
    const { container } = renderRoute('/help');
    for (const a of container.querySelectorAll('.help-service a')) expect(a).toHaveClass('btn');
  });

  it('keeps age and area details behind "More about <service>"', async () => {
    renderRoute('/help');
    const more = screen.getAllByText('More about Childline')[0]!;
    const details = more.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText('For: Under 19.')).toBeInTheDocument();
    await userEvent.click(more);
    expect(details).toHaveAttribute('open');
  });

  it('keeps each service compact: name, one-line description and its buttons', () => {
    const { container } = renderRoute('/help');
    const card = container.querySelector('.help-service')!;
    expect(card.querySelector('.help-service__summary')).not.toBeNull();
    expect(card.querySelector('.help-service__actions')).not.toBeNull();
  });
});
