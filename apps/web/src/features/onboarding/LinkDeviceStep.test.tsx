import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AVATAR, encodeAvatar, type OnboardedChild } from '@revisionden/core';
import type { OnboardingApi } from './api';
import { OnboardingApiError } from './api';
import { LinkDeviceStep } from './LinkDeviceStep';

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
const token = (n = 1) => ({
  token: `token-${n}`.padEnd(32, 'x'),
  familyId: 'family-1',
  studentId: child.student.id,
  expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
  linkUrl: `https://dev.revisionden.test/link?token=token-${n}&family=family-1`,
});

function fakeApi(create: OnboardingApi['createLinkToken']): OnboardingApi {
  return {
    getFamily: vi.fn(),
    addChild: vi.fn(),
    createLinkToken: create,
    redeemLink: vi.fn(),
    verifyLink: vi.fn(),
    unlockOptions: vi.fn(),
    unlockVerify: vi.fn(),
  };
}

describe('LinkDeviceStep', () => {
  it('shows a one-time QR code that works for 10 minutes', async () => {
    const create = vi.fn(async () => token());
    render(
      <LinkDeviceStep
        child={child}
        api={fakeApi(create)}
        now={() => new Date(START.getTime() + 30_000)}
        onDone={() => undefined}
      />,
    );
    const qr = await screen.findByRole('img', { name: "QR code to link Comet_7's device" });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    expect(screen.getByText('Works once, for 9:30 more')).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(child.student.id);
  });

  it('lets the parent do this later', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(
      <LinkDeviceStep
        child={child}
        api={fakeApi(async () => token())}
        now={() => START}
        onDone={onDone}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Do this later' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('offers a new code once the old one has expired', async () => {
    const create = vi.fn(async () => token(create.mock.calls.length));
    const user = userEvent.setup();
    render(
      <LinkDeviceStep
        child={child}
        api={fakeApi(create)}
        now={() => new Date(START.getTime() + 11 * 60_000)}
        onDone={() => undefined}
      />,
    );
    expect(await screen.findByText('This code has expired.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR code/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Make a new code' }));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('shows what went wrong and lets the parent try again', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new OnboardingApiError('network', 'Could not reach RevisionDen.'))
      .mockResolvedValueOnce(token());
    const user = userEvent.setup();
    render(
      <LinkDeviceStep
        child={child}
        api={fakeApi(create)}
        now={() => START}
        onDone={() => undefined}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });
});
