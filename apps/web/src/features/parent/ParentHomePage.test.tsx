import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { family } from '../../mocks/data';
import { renderRoute } from '../../test/render';

const open = async () => {
  const view = renderRoute('/parent');
  await screen.findByRole('heading', { level: 1, name: 'Parent home' });
  return view;
};

describe('Parent home', () => {
  it('links to the stats dashboard, family feedback, settings and policies', async () => {
    await open();
    expect(screen.getByRole('link', { name: 'Stats dashboard' })).toHaveAttribute(
      'href',
      '/parent/stats',
    );
    expect(screen.getByRole('link', { name: 'Family feedback' })).toHaveAttribute(
      'href',
      '/feedback/family',
    );
    expect(screen.getByRole('link', { name: 'Add or manage children' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    expect(screen.getByRole('link', { name: 'App settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Policies' })).toHaveAttribute('href', '/legal');
    expect(screen.getByRole('link', { name: "Download your family's data" })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it("links to the chosen child's rewards and reminder times, with a student switcher", async () => {
    await open();
    const child = await screen.findByRole('region', { name: 'demo_fox' });
    expect(within(child).getByRole('link', { name: 'Rewards you set' })).toHaveAttribute(
      'href',
      '/family/00000000-0000-4000-8000-0000000000a1/rewards',
    );
    expect(within(child).getByRole('link', { name: 'Reminder times' })).toHaveAttribute(
      'href',
      '/parent/reminders/00000000-0000-4000-8000-0000000000a1',
    );
    await userEvent.selectOptions(screen.getByLabelText('Student'), 'demo_owl');
    const owl = await screen.findByRole('region', { name: 'demo_owl' });
    expect(within(owl).getByRole('link', { name: 'Rewards you set' })).toHaveAttribute(
      'href',
      '/family/00000000-0000-4000-8000-0000000000a2/rewards',
    );
  });

  it('preselects the child named in ?student= (from "Who\'s revising?")', async () => {
    renderRoute('/parent?student=00000000-0000-4000-8000-0000000000a2');
    expect(await screen.findByRole('region', { name: 'demo_owl' })).toBeInTheDocument();
    expect(screen.getByLabelText('Student')).toHaveValue('00000000-0000-4000-8000-0000000000a2');
  });

  it('offers reward news for this device', async () => {
    await open();
    expect(screen.getByRole('heading', { name: 'Reward news' })).toBeInTheDocument();
  });

  it('asks to add a child when there are none yet', async () => {
    server.use(http.get('*/v1/students', () => HttpResponse.json({ students: [] })));
    await open();
    expect(await screen.findByText(/No children yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stats dashboard' })).toBeInTheDocument();
  });
});

describe('Ways in to the parent home', () => {
  it('is linked from Settings', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('link', { name: 'Parent home' })).toHaveAttribute(
      'href',
      '/parent',
    );
  });

  it('is linked from the profile picker parents land on after signing in', async () => {
    renderRoute('/family');
    expect(await screen.findByRole('link', { name: 'Parent home' })).toHaveAttribute(
      'href',
      '/parent',
    );
  });
});

describe('Reminder times page', () => {
  it("shows the child's reminder settings form", async () => {
    server.use(
      http.get('*/v1/students/:id/reminder-settings', () =>
        HttpResponse.json({
          enabled: true,
          streakReminders: true,
          sessionReminders: true,
          quietStart: '21:00',
          quietEnd: '07:30',
          weekdayQuietStart: '08:30',
          weekdayQuietEnd: '15:30',
          sessionReminderTime: '16:30',
          streakReminderTime: '19:00',
          timeZone: 'Europe/London',
          maxPerDay: 2,
        }),
      ),
    );
    renderRoute('/parent/reminders/00000000-0000-4000-8000-0000000000a1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reminder times' }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Send reminders')).toBeChecked();
    expect(screen.getByRole('link', { name: 'Back to parent home' })).toHaveAttribute(
      'href',
      '/parent',
    );
  });
});

describe('Parent home: two parents', () => {
  it('shows the parents panel and the family activity log', async () => {
    await open();
    expect(
      await screen.findByRole('button', { name: 'Invite a second parent' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No changes yet.')).toBeInTheDocument();
  });

  it('shows a removed parent the notice', async () => {
    server.use(
      http.get('*/v1/removal-notice', () =>
        HttpResponse.json({ removed: true, removedAt: '2026-11-24T10:00:00.000Z' }),
      ),
    );
    await open();
    expect(
      await screen.findByText(/The other parent removed you from the family/),
    ).toBeInTheDocument();
  });

  it("lists each child's linked devices", async () => {
    renderRoute('/parent');
    expect(await screen.findByRole('heading', { name: 'Linked devices' })).toBeInTheDocument();
  });

  it('shows the things left to check when a board or tier is Not sure', async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json({
          children: [
            {
              ...family.children[0]!,
              enrolments: [{ ...family.children[0]!.enrolments[0]!, board: 'not_sure' }],
              toCheckLater: 1,
            },
          ],
        }),
      ),
    );
    renderRoute('/parent');
    expect(await screen.findByRole('heading', { name: 'Things to check: 1' })).toBeInTheDocument();
  });
});
