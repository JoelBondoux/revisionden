import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JoinPage } from './JoinPage';
import { ParentsApiError, type ParentsApi } from './parentsApi';

function renderJoin(api: Partial<ParentsApi>, path = '/join?code=ABCD2345EFGH') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join" element={<JoinPage api={api as ParentsApi} />} />
        <Route path="/parent" element={<h1>Parent home</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Join a family', () => {
  it('fills in the code from the link and joins as the second parent', async () => {
    const join = vi.fn(async () => ({ familyId: 'f', position: 2 }));
    renderJoin({ join });
    expect(screen.getByRole('textbox', { name: 'Invite code' })).toHaveValue('ABCD2345EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Join the family' }));
    expect(join).toHaveBeenCalledWith('ABCD2345EFGH');
    expect(await screen.findByRole('heading', { name: 'Parent home' })).toBeInTheDocument();
  });

  it('says why a code did not work', async () => {
    const join = vi.fn(async () => {
      throw new ParentsApiError(
        'invite_not_found',
        'That code is not valid or has expired. Ask for a new one.',
        404,
      );
    });
    renderJoin({ join });
    await userEvent.click(screen.getByRole('button', { name: 'Join the family' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid or has expired');
  });

  it('asks a signed-out parent to sign in first and come back here', async () => {
    const join = vi.fn(async () => {
      throw new ParentsApiError('unauthorized', 'Sign in to continue', 401);
    });
    renderJoin({ join });
    await userEvent.click(screen.getByRole('button', { name: 'Join the family' }));
    expect(
      await screen.findByText('Sign in with your own Google or Microsoft account first.'),
    ).toBeInTheDocument();
  });
});
