import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { resetTargetGradeMocks } from './mocks';

beforeEach(() => resetTargetGradeMocks());

describe('target grades for the parent', () => {
  const openPanel = async () => {
    renderRoute('/parent/stats');
    return screen.findByRole('region', { name: 'Target grades' });
  };

  it('lets a parent pick a target from the subject’s grades and save it', async () => {
    const panel = await openPanel();
    const maths = within(panel).getByLabelText('Maths target grade');
    expect(
      within(maths)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['No target', '9', '8', '7', '6', '5', '4', '3', 'U']);
    await userEvent.selectOptions(maths, '7');
    expect(await within(panel).findByRole('status')).toHaveTextContent('Maths target saved');
    expect(within(panel).getByLabelText('Maths target grade')).toHaveValue('7');
  });

  it('lets a parent clear a target', async () => {
    resetTargetGradeMocks({ mathsTarget: '6' });
    const panel = await openPanel();
    const maths = within(panel).getByLabelText('Maths target grade');
    expect(maths).toHaveValue('6');
    await userEvent.selectOptions(maths, '');
    expect(await within(panel).findByRole('status')).toHaveTextContent('Maths target cleared');
  });

  it('explains when a subject has no grade scale yet', async () => {
    const panel = await openPanel();
    expect(within(panel).queryByLabelText('Physics target grade')).not.toBeInTheDocument();
    expect(panel).toHaveTextContent('Physics: not available yet');
  });

  it('shows the target in the subjects table before predicted grades exist', async () => {
    resetTargetGradeMocks({ mathsTarget: '7' });
    renderRoute('/parent/stats');
    const table = await screen.findByRole('table', { name: 'Subjects' });
    expect(within(table).getByRole('row', { name: /Maths/ })).toHaveTextContent('Target 7');
  });

  it('shows a friendly message when the target cannot be saved', async () => {
    server.use(
      http.put('*/v1/students/:id/target-grades/:subjectId', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const panel = await openPanel();
    await userEvent.selectOptions(within(panel).getByLabelText('Maths target grade'), '7');
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('target grades for the student', () => {
  it('shows the targets a parent set, without a way to change them', async () => {
    resetTargetGradeMocks({ mathsTarget: '7' });
    renderRoute('/progress');
    const card = await screen.findByRole('region', { name: 'Target grades' });
    expect(card).toHaveTextContent('Maths: 7');
    expect(within(card).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('says when no targets are set yet', async () => {
    renderRoute('/progress');
    const card = await screen.findByRole('region', { name: 'Target grades' });
    expect(card).toHaveTextContent('No target grades yet');
  });
});
