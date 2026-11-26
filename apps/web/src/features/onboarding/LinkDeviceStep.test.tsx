import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_AVATAR,
  encodeAvatar,
  type LinkKind,
  type OnboardedChild,
} from '@revisionden/core';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import { OnboardingApiError, type OnboardingApi } from './api';
import { LinkDeviceStep, type ShareApis } from './LinkDeviceStep';

const child: OnboardedChild = {
  student: {
    id: '11111111-1111-4111-8111-111111111111',
    nickname: 'Comet_7',
    avatarCode: encodeAvatar(DEFAULT_AVATAR),
    yearGroup: 11,
  },
  enrolments: [],
  level: 'gcse',
  examSeason: { season: 'summer', year: 2027 },
  toCheckLater: 0,
  linkedDevices: 0,
};

const START = new Date('2026-11-24T10:00:00Z');
const token = (n = 1, kind: LinkKind = 'qr') => ({
  tokenId: `token-${n}`,
  kind,
  token: `token-${n}`.padEnd(32, 'x'),
  familyId: 'family-1',
  studentId: child.student.id,
  expiresAt: new Date(
    START.getTime() + (kind === 'qr' ? 10 * 60_000 : 24 * 3600_000),
  ).toISOString(),
  linkUrl: `https://dev.revisionden.test/link?token=token-${n}&family=family-1`,
  code: kind === 'qr' ? 'ABCD-EFGH' : 'WXYZ-2345',
});

function setup(
  api: Partial<OnboardingApi> = {},
  options: { now?: () => Date; share?: ShareApis; onDone?: () => void } = {},
) {
  const full = fakeOnboardingApi({
    createLinkToken: vi.fn(async (_id: string, kind: LinkKind = 'qr') =>
      token(kind === 'qr' ? 1 : 2, kind),
    ),
    ...api,
  });
  const onDone = options.onDone ?? vi.fn();
  render(
    <LinkDeviceStep
      child={child}
      api={full}
      now={options.now ?? (() => START)}
      onDone={onDone}
      share={options.share ?? {}}
      pollMs={20}
    />,
  );
  return { api: full, onDone };
}

describe('LinkDeviceStep', () => {
  it('shows a one-time QR code that works for 10 minutes, and its short code', async () => {
    const { api } = setup({}, { now: () => new Date(START.getTime() + 30_000) });
    const qr = await screen.findByRole('img', { name: "QR code to link Comet_7's device" });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    expect(screen.getByText('Works once, for 9:30 more')).toBeInTheDocument();
    expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument();
    expect(api.createLinkToken).toHaveBeenCalledWith(child.student.id, 'qr');
  });

  it('lets the parent do this later', async () => {
    const user = userEvent.setup();
    const { onDone } = setup();
    await user.click(await screen.findByRole('button', { name: 'Do this later' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('offers a new code once the old one has expired', async () => {
    const user = userEvent.setup();
    const { api } = setup({}, { now: () => new Date(START.getTime() + 11 * 60_000) });
    expect(await screen.findByText('This code has expired.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR code/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Make a new code' }));
    expect(api.createLinkToken).toHaveBeenCalledTimes(2);
  });

  it('shows what went wrong and lets the parent try again', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new OnboardingApiError('network', 'Could not reach RevisionDen.'))
      .mockResolvedValueOnce(token());
    const user = userEvent.setup();
    setup({ createLinkToken: create });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });

  it('sends a 24-hour link with the phone share sheet, with no nickname in the message', async () => {
    const shareSheet = vi.fn(async () => undefined);
    const user = userEvent.setup();
    const { api } = setup({}, { share: { share: shareSheet } });
    await user.click(await screen.findByRole('button', { name: 'Send a link instead' }));
    expect(api.createLinkToken).toHaveBeenCalledWith(child.student.id, 'share');
    await user.click(await screen.findByRole('button', { name: 'Share link' }));
    const sent = (shareSheet.mock.calls[0] as unknown as [{ text: string; url?: string }])[0];
    expect(sent.text).toBe(
      'Set up RevisionDen on your phone: https://dev.revisionden.test/link?token=token-2&family=family-1',
    );
    expect(sent.text).not.toContain('Comet_7');
    expect(screen.getByText('WXYZ-2345')).toBeInTheDocument();
    expect(screen.getByText(/Works once, for 24 hours/)).toBeInTheDocument();
  });

  it('copies the link when the phone cannot share', async () => {
    const copy = vi.fn(async () => undefined);
    const user = userEvent.setup();
    setup({}, { share: { copy } });
    await user.click(await screen.findByRole('button', { name: 'Send a link instead' }));
    expect(screen.queryByRole('button', { name: 'Share link' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledWith(
      'Set up RevisionDen on your phone: https://dev.revisionden.test/link?token=token-2&family=family-1',
    );
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('treats closing the share sheet without sharing as nothing went wrong', async () => {
    const shareSheet = vi.fn(async () =>
      Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
    );
    const user = userEvent.setup();
    setup({}, { share: { share: shareSheet } });
    await user.click(await screen.findByRole('button', { name: 'Send a link instead' }));
    await user.click(await screen.findByRole('button', { name: 'Share link' }));
    expect(shareSheet).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('WXYZ-2345')).toBeInTheDocument();
  });

  it('keeps the QR code on screen for setting up in person', async () => {
    setup({}, { share: { share: vi.fn(async () => undefined) } });
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });

  it('waits for the device, then says it is set up', async () => {
    const statuses = ['waiting', 'waiting', 'linked'] as const;
    let i = 0;
    const getLinkStatus = vi.fn(async () => statuses[Math.min(i++, 2)]!);
    const user = userEvent.setup();
    setup({ getLinkStatus });
    await user.click(await screen.findByRole('button', { name: 'Send a link instead' }));
    expect(await screen.findByText("Waiting for Comet_7's device…")).toBeInTheDocument();
    expect(await screen.findByText("Comet_7's device is set up")).toBeInTheDocument();
    expect(getLinkStatus).toHaveBeenCalledWith(child.student.id, 'token-2');
  });

  it('notices when the QR code itself is used', async () => {
    setup({ getLinkStatus: vi.fn(async () => 'linked' as const) });
    expect(await screen.findByText("Comet_7's device is set up")).toBeInTheDocument();
  });

  it('cancels a link that is not needed any more', async () => {
    const user = userEvent.setup();
    const { api } = setup();
    await user.click(await screen.findByRole('button', { name: 'Send a link instead' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel this link' }));
    expect(api.cancelLink).toHaveBeenCalledWith(child.student.id, 'token-2');
    expect(
      await screen.findByText('Link cancelled. It will not work any more.'),
    ).toBeInTheDocument();
  });

  it('stops checking once it is unmounted', async () => {
    const getLinkStatus = vi.fn(async () => 'waiting' as const);
    const { unmount } = render(
      <LinkDeviceStep
        child={child}
        api={fakeOnboardingApi({ createLinkToken: vi.fn(async () => token()), getLinkStatus })}
        now={() => START}
        onDone={() => undefined}
        share={{}}
        pollMs={10}
      />,
    );
    await screen.findByRole('img', { name: /QR code/ });
    unmount();
    const calls = getLinkStatus.mock.calls.length;
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(getLinkStatus.mock.calls.length).toBe(calls);
  });
});
