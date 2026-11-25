import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  encodeAvatar,
  examSeasonFor,
  levelForYear,
  toCheckLaterCount,
  type OnboardChildRequest,
  type OnboardedChild,
} from '@revisionden/core';
import { OnboardingApiError, type OnboardingApi } from './api';
import { OnboardingApiProvider } from './OnboardingApiContext';
import { OnboardingPage } from './OnboardingPage';

const TODAY = new Date('2026-11-24T10:00:00Z');

/** An in-memory family that behaves like the API. */
function fakeApi(initial: OnboardedChild[] = []): OnboardingApi & { children: OnboardedChild[] } {
  const children = [...initial];
  return {
    children,
    getFamily: vi.fn(async () => ({ children: [...children] })),
    addChild: vi.fn(async (req: OnboardChildRequest) => {
      const id = `00000000-0000-4000-8000-00000000000${children.length + 1}`;
      const child: OnboardedChild = {
        student: {
          id,
          nickname: req.nickname,
          avatarCode: req.avatarCode,
          yearGroup: req.yearGroup,
        },
        enrolments: req.subjects.map((s) => ({ ...s, studentId: id })),
        level: levelForYear(req.yearGroup)!,
        examSeason: examSeasonFor(req.yearGroup, TODAY)!,
        toCheckLater: toCheckLaterCount(req.subjects),
        linkedDevices: 0,
      };
      children.push(child);
      return child;
    }),
    createLinkToken: vi.fn(async (studentId: string) => ({
      token: 't'.repeat(32),
      familyId: 'family-1',
      studentId,
      expiresAt: new Date(TODAY.getTime() + 600_000).toISOString(),
      linkUrl: 'https://dev.revisionden.test/link?token=ttt&family=family-1',
    })),
    redeemLink: vi.fn(),
    verifyLink: vi.fn(),
    updateChildSubject: vi.fn(),
    getMySubjects: vi.fn(),
    updateMySubject: vi.fn(),
    getMyAvatar: vi.fn(),
    saveMyAvatar: vi.fn(),
  };
}

function renderPage(api: OnboardingApi) {
  return render(
    <MemoryRouter>
      <OnboardingApiProvider api={api}>
        <OnboardingPage now={() => TODAY} random={() => 0} />
      </OnboardingApiProvider>
    </MemoryRouter>,
  );
}

async function addChild(
  user: ReturnType<typeof userEvent.setup>,
  nickname: string,
  year: string,
  subject: string,
) {
  await user.click(screen.getByRole('button', { name: 'Add a child' }));
  await user.type(screen.getByLabelText('Nickname'), nickname);
  await user.click(screen.getByRole('radio', { name: year }));
  await user.click(screen.getByRole('button', { name: subject }));
  await user.click(screen.getByRole('button', { name: /^Continue/ }));
}

describe('OnboardingPage', () => {
  it('asks a signed-out parent to sign in, with the sign-in buttons', async () => {
    const api = fakeApi();
    api.getFamily = vi.fn(async () =>
      Promise.reject(new OnboardingApiError('unauthorized', 'Sign in to continue', 401)),
    );
    renderPage(api);
    expect(await screen.findByRole('heading', { name: 'Please sign in' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('starts with an empty family and Finish switched off', async () => {
    renderPage(fakeApi());
    expect(await screen.findByRole('heading', { name: "Who's studying?" })).toBeInTheDocument();
    expect(screen.getByText('No one yet. Add a child to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
  });

  it('offers the family data download on the family list', async () => {
    renderPage(fakeApi());
    expect(
      await screen.findByRole('link', { name: 'Download your family’s data' }),
    ).toHaveAttribute('href', expect.stringMatching(/\/v1\/export$/));
    expect(
      await screen.findByText(/Accounts nobody uses for 12 months are deleted automatically/),
    ).toBeInTheDocument();
  });

  it('adds two children, links a device, and finishes', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderPage(api);
    await screen.findByRole('heading', { name: "Who's studying?" });

    await addChild(user, 'Comet_7', 'Year 11', 'Maths');
    expect(
      await screen.findByRole('heading', { name: 'School report for Comet_7' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Same school as/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(
      await screen.findByRole('img', { name: "QR code to link Comet_7's device" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Do this later' }));

    const first = await screen.findByRole('listitem');
    expect(within(first).getByText('Comet_7')).toBeInTheDocument();
    expect(within(first).getByText('Year 11 · GCSE · exams summer 2027')).toBeInTheDocument();
    expect(within(first).getByText('2 to check later')).toBeInTheDocument();

    await addChild(user, 'Nova', 'Year 12', 'Further Maths');
    await screen.findByRole('heading', { name: 'School report for Nova' });
    await user.click(screen.getByRole('button', { name: 'Same school as Comet_7' }));
    await screen.findByRole('img', { name: /QR code/ });
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByRole('heading', { name: 'All set!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What Comet_7 sees first' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What Nova sees first' })).toBeInTheDocument();
    expect(screen.getAllByText(/A short starting test/)).toHaveLength(2);
    expect(screen.getByText(/Further Maths/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the family screen' })).toHaveAttribute(
      'href',
      '/family',
    );
  });

  it('can link a device later from the family list', async () => {
    const api = fakeApi();
    await api.addChild({
      nickname: 'Orbit',
      avatarCode: encodeAvatar(DEFAULT_AVATAR),
      yearGroup: 10,
      subjects: [],
    });
    const user = userEvent.setup();
    renderPage(api);
    await user.click(await screen.findByRole('button', { name: 'Link a device for Orbit' }));
    expect(
      await screen.findByRole('img', { name: "QR code to link Orbit's device" }),
    ).toBeInTheDocument();
  });

  it('says when a device is already linked', async () => {
    const api = fakeApi();
    const child = await api.addChild({
      nickname: 'Orbit',
      avatarCode: encodeAvatar(DEFAULT_AVATAR),
      yearGroup: 10,
      subjects: [],
    });
    child.linkedDevices = 1;
    renderPage(api);
    expect(await screen.findByText('Device linked')).toBeInTheDocument();
  });

  it('explains that report upload comes later', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderPage(api);
    await screen.findByRole('heading', { name: "Who's studying?" });
    await addChild(user, 'Comet_7', 'Year 9', 'History');
    await user.click(await screen.findByRole('button', { name: 'Upload the report letter' }));
    expect(
      screen.getByText(/Reading school reports is coming in a later update/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });

  it('goes back to the family list from the form', async () => {
    const user = userEvent.setup();
    renderPage(fakeApi());
    await user.click(await screen.findByRole('button', { name: 'Add a child' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: "Who's studying?" })).toBeInTheDocument();
  });

  it('shows an error with a retry when the family cannot load', async () => {
    const api = fakeApi();
    vi.mocked(api.getFamily).mockRejectedValueOnce(new Error('Could not reach RevisionDen.'));
    const user = userEvent.setup();
    renderPage(api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: "Who's studying?" })).toBeInTheDocument();
  });
});

describe('OnboardingPage from "Who\'s revising?"', () => {
  it("opens straight on linking the chosen child's device", async () => {
    const { renderRoute } = await import('../../test/render');
    renderRoute('/onboarding?link=8f6d2b1e-4c3a-4d5e-9f00-000000000002', { studentId: null });
    expect(
      await screen.findByRole('heading', { name: "Link PixelOwl's device" }),
    ).toBeInTheDocument();
  });
});
