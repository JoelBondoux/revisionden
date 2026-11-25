import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { resetTargetGradeMocks } from './mocks';

/** The panels load after the dashboard, so give slow CI machines time. */
const LOAD = { timeout: 5000 };

beforeEach(() => resetTargetGradeMocks());

describe('target grades for the parent', () => {
  const openPanel = async () => {
    renderRoute('/parent/stats');
    return screen.findByRole('region', { name: 'Target grades' }, LOAD);
  };

  it('lets a parent pick their target from the subject’s grades and save it', async () => {
    const panel = await openPanel();
    const maths = within(panel).getByLabelText('Maths: your target');
    expect(
      within(maths)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['No target', '9', '8', '7', '6', '5', '4', '3', 'U']);
    await userEvent.selectOptions(maths, '7');
    expect(await within(panel).findByRole('status')).toHaveTextContent('Maths target saved');
    expect(within(panel).getByLabelText('Maths: your target')).toHaveValue('7');
  });

  it('shows the child’s own target next to the parent’s', async () => {
    resetTargetGradeMocks({ parentTarget: '6', studentTarget: '8' });
    const panel = await openPanel();
    expect(within(panel).getByLabelText('Maths: your target')).toHaveValue('6');
    expect(panel).toHaveTextContent('Their own target: 8');
  });

  it('lets a parent clear their target', async () => {
    resetTargetGradeMocks({ parentTarget: '6' });
    const panel = await openPanel();
    await userEvent.selectOptions(within(panel).getByLabelText('Maths: your target'), '');
    expect(await within(panel).findByRole('status')).toHaveTextContent('Maths target cleared');
  });

  it('explains when a subject has no grade scale yet', async () => {
    const panel = await openPanel();
    expect(within(panel).queryByLabelText('Physics: your target')).not.toBeInTheDocument();
    expect(panel).toHaveTextContent('Physics: not available yet');
  });

  it('shows the parent’s target in the subjects table before predicted grades exist', async () => {
    resetTargetGradeMocks({ parentTarget: '7' });
    renderRoute('/parent/stats');
    const table = await screen.findByRole('table', { name: 'Subjects' }, LOAD);
    expect(within(table).getByRole('row', { name: /Maths/ })).toHaveTextContent('Target 7');
  });

  it('updates the subjects table after a save, so Save as PDF shows the new target', async () => {
    const panel = await openPanel();
    await userEvent.selectOptions(within(panel).getByLabelText('Maths: your target'), '7');
    const table = screen.getByRole('table', { name: 'Subjects' });
    expect(await within(table).findByText('Target 7', {}, LOAD)).toBeVisible();
  });

  it('shows a friendly message when the target cannot be saved', async () => {
    server.use(
      http.put('*/v1/students/:id/target-grades/:subjectId', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const panel = await openPanel();
    await userEvent.selectOptions(within(panel).getByLabelText('Maths: your target'), '7');
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('target grades for the student', () => {
  const openCard = async () => {
    renderRoute('/progress');
    return screen.findByRole('region', { name: 'Target grades' }, LOAD);
  };

  it('shows the parent’s target and lets the child set their own', async () => {
    resetTargetGradeMocks({ parentTarget: '7' });
    const card = await openCard();
    expect(card).toHaveTextContent('Your parent’s target: 7');
    await userEvent.selectOptions(within(card).getByLabelText('Maths: my target'), '8');
    expect(await within(card).findByRole('status')).toHaveTextContent('Maths target saved');
    expect(within(card).getByLabelText('Maths: my target')).toHaveValue('8');
  });

  it('keeps the tone encouraging when the two targets differ', async () => {
    resetTargetGradeMocks({ parentTarget: '7', studentTarget: '5' });
    const card = await openCard();
    expect(card).toHaveTextContent('Your parent’s target: 7');
    expect(within(card).getByLabelText('Maths: my target')).toHaveValue('5');
    expect(card.textContent).not.toMatch(/fail|below|behind|wrong|lower/i);
  });

  it('says when no parent target is set yet, and explains subjects without a scale', async () => {
    const card = await openCard();
    expect(card).toHaveTextContent('Your parent hasn’t set one yet');
    expect(card).toHaveTextContent('Physics: not available yet');
  });

  it('shows a friendly message when the child’s target cannot be saved', async () => {
    server.use(
      http.put('*/v1/student/target-grades/:subjectId', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const card = await openCard();
    await userEvent.selectOptions(within(card).getByLabelText('Maths: my target'), '7');
    expect(await within(card).findByRole('alert')).toHaveTextContent('Could not save');
  });
});
