import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ParentsPanel } from './ParentsPanel';
import { FamilyLog } from './FamilyLog';
import { RemovalNotice } from './RemovalNotice';
import {
  ParentsApiError,
  type FamilyEvents,
  type FamilyParents,
  type ParentsApi,
} from './parentsApi';

const ONE: FamilyParents = {
  parents: [{ position: 1, label: 'Parent 1', you: true, joinedAt: '2026-11-01T10:00:00.000Z' }],
  canInvite: true,
  deletionRequest: null,
};
const TWO: FamilyParents = {
  parents: [
    { position: 1, label: 'Parent 1', you: true, joinedAt: '2026-11-01T10:00:00.000Z' },
    { position: 2, label: 'Parent 2', you: false, joinedAt: '2026-11-20T10:00:00.000Z' },
  ],
  canInvite: false,
  deletionRequest: null,
};

function fakeApi(over: Partial<ParentsApi> = {}): ParentsApi {
  return {
    parents: vi.fn(async () => ONE),
    invite: vi.fn(async () => ({
      code: 'ABCD2345EFGH',
      link: 'https://dev.revisionden.test/join?code=ABCD2345EFGH',
      expiresAt: '2026-12-01T10:00:00.000Z',
    })),
    join: vi.fn(async () => ({ familyId: 'f', position: 2 })),
    removeParent: vi.fn(async () => undefined),
    requestDeletion: vi.fn(async () => ({ deleted: false, waitingFor: 'Parent 2' })),
    cancelDeletion: vi.fn(async () => undefined),
    events: vi.fn(async (): Promise<FamilyEvents> => ({ events: [], newFromOtherParent: 0 })),
    markSeen: vi.fn(async () => undefined),
    removalNotice: vi.fn(async () => ({ removed: false })),
    seenRemovalNotice: vi.fn(async () => undefined),
    ...over,
  };
}

const renderPanel = (api: ParentsApi, onDeleted = vi.fn()) =>
  render(
    <MemoryRouter>
      <ParentsPanel api={api} onDeleted={onDeleted} />
    </MemoryRouter>,
  );

describe('Parents panel', () => {
  it('invites a second parent with a code and a link valid for 7 days', async () => {
    const api = fakeApi();
    renderPanel(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Invite a second parent' }));
    expect(await screen.findByText('ABCD2345EFGH')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invite link' })).toHaveValue(
      'https://dev.revisionden.test/join?code=ABCD2345EFGH',
    );
    expect(screen.getByText(/works once, until 1 December 2026/)).toBeInTheDocument();
  });

  it('says when the invite limit is reached', async () => {
    const api = fakeApi({
      invite: vi.fn(async () => {
        throw new ParentsApiError(
          'invite_limit',
          'You can make 5 invites a day. Try again tomorrow.',
          429,
        );
      }),
    });
    renderPanel(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Invite a second parent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('5 invites a day');
  });

  it('lists both parents by number and removes the other parent after a check', async () => {
    const api = fakeApi({ parents: vi.fn(async () => TWO) });
    renderPanel(api);
    const list = await screen.findByRole('list', { name: 'Parents' });
    expect(within(list).getByText('Parent 1 (you)')).toBeInTheDocument();
    expect(within(list).getByText('Parent 2')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Invite a second parent' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Parent 2' }));
    expect(api.removeParent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove Parent 2' }));
    expect(api.removeParent).toHaveBeenCalledWith(2);
  });

  it('asks the other parent to confirm deleting the family', async () => {
    const api = fakeApi({ parents: vi.fn(async () => TWO) });
    renderPanel(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete the family account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
    expect(api.requestDeletion).toHaveBeenCalled();
    expect(await screen.findByText(/Waiting for Parent 2 to confirm/)).toBeInTheDocument();
  });

  it('lets a parent confirm or cancel the other parent’s deletion request', async () => {
    const asked = {
      ...TWO,
      deletionRequest: { by: 'Parent 2', byYou: false, at: '2026-11-24T10:00:00.000Z' },
    };
    const api = fakeApi({
      parents: vi.fn(async () => asked),
      requestDeletion: vi.fn(async () => ({ deleted: true })),
    });
    const onDeleted = vi.fn();
    renderPanel(api, onDeleted);
    expect(
      await screen.findByText(/Parent 2 asked to delete the family account/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep the account' }));
    expect(api.cancelDeletion).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(onDeleted).toHaveBeenCalled();
  });
});

describe('Family activity log', () => {
  it('shows who changed what, marks the other parent’s new changes and clears them', async () => {
    const api = fakeApi({
      events: vi.fn(async () => ({
        events: [
          {
            id: '1',
            kind: 'child_added',
            by: 'Parent 2',
            you: false,
            what: 'added nova',
            important: true,
            createdAt: '2026-11-24T10:00:00.000Z',
            isNew: true,
          },
          {
            id: '2',
            kind: 'reward_set',
            by: 'Parent 1',
            you: true,
            what: 'set a reward for nova',
            important: false,
            createdAt: '2026-11-23T10:00:00.000Z',
            isNew: false,
          },
        ],
        newFromOtherParent: 1,
      })),
    });
    render(<FamilyLog api={api} />);
    expect(await screen.findByText('1 new change by the other parent')).toBeInTheDocument();
    expect(screen.getByText('Parent 2 added nova')).toBeInTheDocument();
    expect(screen.getByText('You set a reward for nova')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark as seen' }));
    expect(api.markSeen).toHaveBeenCalled();
    expect(screen.queryByText('1 new change by the other parent')).not.toBeInTheDocument();
  });
});

describe('Removal notice', () => {
  it('tells a removed parent once, then lets them carry on', async () => {
    const api = fakeApi({
      removalNotice: vi.fn(async () => ({ removed: true, removedAt: '2026-11-24T10:00:00.000Z' })),
    });
    const onDone = vi.fn();
    render(<RemovalNotice api={api} onDone={onDone} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The other parent removed you from the family on 24 November 2026',
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(api.seenRemovalNotice).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('shows nothing for a parent who was not removed', async () => {
    const api = fakeApi();
    const { container } = render(<RemovalNotice api={api} onDone={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
