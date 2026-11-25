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

describe('finding Get help from the student screens', () => {
  it('the topic map has a clear Get help tile', async () => {
    const { container } = renderRoute('/map');
    await screen.findByRole('heading', { name: 'Topic map' });
    const tile = container.querySelector<HTMLElement>('.get-help-tile')!;
    const link = within(tile).getByRole('link', { name: 'Get help' });
    expect(link).toHaveAttribute('href', '/help');
    expect(link).toHaveAccessibleDescription(
      'Private support if something is worrying you. Nobody is told you looked.',
    );
  });

  it('the student header has a Get help link on every screen', () => {
    const { container } = renderRoute('/cards');
    const header = container.querySelector<HTMLElement>('.sound-header')!;
    expect(within(header).getByRole('link', { name: 'Get help' })).toHaveAttribute('href', '/help');
  });
});
