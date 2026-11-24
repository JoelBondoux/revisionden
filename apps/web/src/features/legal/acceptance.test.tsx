import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../../mocks/server';
import {
  acceptanceStatus,
  createLegalApi,
  LegalApiProvider,
  PolicyGate,
  type Acceptance,
  type LegalApi,
} from './acceptance';
import { createPolicyLibrary } from './library';
import { PolicyLibraryProvider } from './PolicyLibraryContext';

const policyFile = (title: string, version: string, change: string) =>
  `# ${title}\n\nVersion: ${version}\n\n## In plain English\n\nShort.\n\n## Full text\n\nLong.\n\n## Changes\n\n- ${change}\n`;
const library = createPolicyLibrary(
  {
    'a/privacy-notice.md': policyFile(
      'Privacy notice',
      '1.1',
      '1.1: We now keep feedback for 12 months.',
    ),
    'a/terms-of-use.md': policyFile('Terms of use', '1.0', '1.0: First version.'),
  },
  {},
);
const at = '2026-11-24T10:00:00.000Z';

describe('acceptanceStatus', () => {
  const current = { 'privacy-notice': '1.1', 'terms-of-use': '1.0' };

  it('asks for a first confirmation when nothing was accepted', () => {
    expect(acceptanceStatus([], current)).toEqual({ kind: 'first' });
  });

  it('is fine when every stored version is the current one', () => {
    const accepted: Acceptance[] = [
      { policy: 'privacy-notice', version: '1.1', acceptedAt: at },
      { policy: 'terms-of-use', version: '1.0', acceptedAt: at },
    ];
    expect(acceptanceStatus(accepted, current)).toEqual({ kind: 'ok' });
  });

  it('lists the policies that changed since they were accepted', () => {
    const accepted: Acceptance[] = [
      { policy: 'privacy-notice', version: '1.0', acceptedAt: at },
      { policy: 'terms-of-use', version: '1.0', acceptedAt: at },
    ];
    expect(acceptanceStatus(accepted, current)).toEqual({
      kind: 'changed',
      policies: ['privacy-notice'],
    });
  });

  it('treats a policy never accepted (after others were) as changed', () => {
    const accepted: Acceptance[] = [{ policy: 'terms-of-use', version: '1.0', acceptedAt: at }];
    expect(acceptanceStatus(accepted, current)).toEqual({
      kind: 'changed',
      policies: ['privacy-notice'],
    });
  });

  it('ignores policies with no file in this build', () => {
    expect(acceptanceStatus([], {})).toEqual({ kind: 'ok' });
  });
});

function fakeApi(accepted: Acceptance[]): LegalApi {
  return {
    list: vi.fn(async () => accepted),
    accept: vi.fn(async (list: { policy: string; version: string }[]) =>
      list.map((a) => ({ ...a, acceptedAt: at })),
    ),
  };
}

const show = (api: LegalApi) =>
  render(
    <PolicyLibraryProvider library={library}>
      <LegalApiProvider value={api}>
        <MemoryRouter>
          <PolicyGate>
            <h1>Onboarding</h1>
          </PolicyGate>
        </MemoryRouter>
      </LegalApiProvider>
    </PolicyLibraryProvider>,
  );

describe('PolicyGate', () => {
  it('asks a new parent to confirm the terms and privacy notice, storing the versions', async () => {
    const api = fakeApi([]);
    show(api);
    const box = await screen.findByRole('checkbox', {
      name: /I have read the Terms of use and Privacy notice/,
    });
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute(
      'href',
      '/legal/terms-of-use',
    );
    expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute(
      'href',
      '/legal/privacy-notice',
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    await userEvent.click(box);
    await userEvent.click(next);
    expect(api.accept).toHaveBeenCalledWith([
      { policy: 'privacy-notice', version: '1.1' },
      { policy: 'terms-of-use', version: '1.0' },
    ]);
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('shows the app straight away when the versions are current', async () => {
    show(
      fakeApi([
        { policy: 'privacy-notice', version: '1.1', acceptedAt: at },
        { policy: 'terms-of-use', version: '1.0', acceptedAt: at },
      ]),
    );
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows what changed and stores the new version on confirm', async () => {
    const api = fakeApi([
      { policy: 'privacy-notice', version: '1.0', acceptedAt: at },
      { policy: 'terms-of-use', version: '1.0', acceptedAt: at },
    ]);
    show(api);
    const dialog = await screen.findByRole('dialog', { name: "We've updated our Privacy notice" });
    expect(dialog).toHaveTextContent('We now keep feedback for 12 months.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(api.accept).toHaveBeenCalledWith([{ policy: 'privacy-notice', version: '1.1' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not lock anyone out when the acceptances cannot be loaded', async () => {
    show({ list: vi.fn(async () => Promise.reject(new Error('down'))), accept: vi.fn() });
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('says when saving the confirmation failed', async () => {
    const api = fakeApi([]);
    api.accept = vi.fn(async () => Promise.reject(new Error('down')));
    show(api);
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('legal API client', () => {
  it('reads and stores policy acceptances', async () => {
    server.use(
      http.get('https://app.example/api/v1/policy-acceptances', () =>
        HttpResponse.json({
          acceptances: [{ policy: 'terms-of-use', version: '1.0', acceptedAt: at }],
        }),
      ),
      http.put('https://app.example/api/v1/policy-acceptances', async ({ request }) => {
        const body = (await request.json()) as {
          acceptances: { policy: string; version: string }[];
        };
        return HttpResponse.json({
          acceptances: body.acceptances.map((a) => ({ ...a, acceptedAt: at })),
        });
      }),
    );
    const api = createLegalApi({ baseUrl: 'https://app.example/api' });
    expect(await api.list()).toHaveLength(1);
    expect(await api.accept([{ policy: 'privacy-notice', version: '1.1' }])).toEqual([
      { policy: 'privacy-notice', version: '1.1', acceptedAt: at },
    ]);
  });

  it('fails on an error reply', async () => {
    server.use(
      http.get(
        'https://app.example/api/v1/policy-acceptances',
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(createLegalApi({ baseUrl: 'https://app.example/api/' }).list()).rejects.toThrow(
      '401',
    );
  });
});
