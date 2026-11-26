import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';

const linkNames = () =>
  within(screen.getByRole('main'))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));

describe('Me (the /settings page, W9)', () => {
  it('starts with the student’s avatar, nickname and an Edit my avatar button', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Me' })).toBeInTheDocument();
    expect(await screen.findByText('NovaFox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit my avatar' })).toBeInTheDocument();
  });

  it('lists Get help first, then My progress and My rewards, then Look and sound and More', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Me' });
    // Friends league (FL) shows once the API confirms friends exist (dev only for now).
    await screen.findByRole('link', { name: 'Friends league' });
    expect(linkNames()).toEqual([
      '/help',
      '/progress',
      '/rewards',
      '/league',
      '/settings/look-and-sound',
      '/settings/more',
    ]);
  });

  it('shows them as chunky button tiles with short labels and no helper sentences (J15a)', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Me' });
    await screen.findByRole('link', { name: 'Friends league' });
    const main = screen.getByRole('main');
    const names = within(main)
      .getAllByRole('link')
      .map((a) => a.textContent?.trim());
    expect(names).toEqual([
      'Get help',
      'My progress',
      'My rewards',
      'Friends league',
      'Look and sound',
      'More',
    ]);
    for (const name of names) {
      expect(within(main).getByRole('link', { name: name! })).toHaveClass('button-tile');
    }
    expect(within(main).getByRole('link', { name: 'Get help' })).toHaveClass('button-tile--help');
    expect(main.querySelector('.link-tile__description')).toBeNull();
  });

  it('keeps the long settings off the main page', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Me' });
    expect(screen.queryByRole('heading', { name: 'Effect style' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My subjects' })).not.toBeInTheDocument();
  });

  it('for a parent (no student on this device) shows no avatar header but keeps Parent home', async () => {
    renderRoute('/settings', { studentId: null });
    expect(await screen.findByRole('heading', { level: 1, name: 'Me' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit my avatar' })).not.toBeInTheDocument();
    expect(linkNames()).toContain('/parent');
  });
});

describe('Look and sound (W9)', () => {
  it('groups effect style, theme, sound, reading comfort and read aloud', async () => {
    renderRoute('/settings/look-and-sound');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Look and sound' }),
    ).toBeInTheDocument();
    for (const name of ['Effect style', 'Appearance', 'Sound', 'Reading comfort', 'Read aloud']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Back to Me/ })).toHaveAttribute('href', '/settings');
  });
});

describe('More (W9)', () => {
  it('has My subjects, where the student checks boards and tiers', async () => {
    renderRoute('/settings/more');
    expect(await screen.findByRole('heading', { name: 'My subjects' })).toBeInTheDocument();
  });

  it('holds everything else: profile, parents, feedback, policies and about', async () => {
    renderRoute('/settings/more');
    await screen.findByRole('heading', { level: 1, name: 'More' });
    const hrefs = linkNames();
    for (const href of [
      '/family',
      '/parent',
      '/ask-a-parent',
      '/feedback',
      '/feedback/mine',
      '/feedback/family',
      '/legal',
      '/about',
    ]) {
      expect(hrefs).toContain(href);
    }
    for (const name of [
      'Switch profile',
      'Parent home',
      'Ask a parent',
      'Send feedback',
      'My feedback',
      'Family feedback',
      'Policies',
      'About',
    ]) {
      expect(screen.getByRole('link', { name })).toHaveClass('button-tile');
    }
    expect(screen.getByRole('checkbox', { name: 'Show the bug button' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Me/ })).toHaveAttribute('href', '/settings');
  });

  it('links to the friends league (FL: the league lives under Me)', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('link', { name: /Friends league/ })).toHaveAttribute(
      'href',
      '/league',
    );
  });
});
