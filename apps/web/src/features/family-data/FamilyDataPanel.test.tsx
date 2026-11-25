import { render, screen } from '@testing-library/react';
import { FamilyDataPanel } from './FamilyDataPanel';
import { createFamilyDataApi, type FamilyActivity, type FamilyDataApi } from './familyDataApi';

const QUIET: FamilyActivity = {
  lastUsedAt: '2026-11-24T10:00:00.000Z',
  deletedIfUnusedAfter: '2027-11-24T10:00:00.000Z',
  warning: null,
};

function fakeApi(activity: FamilyActivity | Error): FamilyDataApi {
  return {
    exportUrl: 'https://api.test/v1/export',
    activity: vi.fn(async () => {
      if (activity instanceof Error) throw activity;
      return activity;
    }),
  };
}

describe('family data panel', () => {
  it('offers a download of all the family’s data', async () => {
    render(<FamilyDataPanel api={fakeApi(QUIET)} />);
    const link = await screen.findByRole('link', { name: 'Download your family’s data' });
    expect(link).toHaveAttribute('href', 'https://api.test/v1/export');
    expect(link).toHaveAttribute('download');
  });

  it('says when an unused account would be deleted', async () => {
    render(<FamilyDataPanel api={fakeApi(QUIET)} />);
    expect(
      await screen.findByText(
        /Accounts nobody uses for 12 months are deleted automatically\. If nobody uses this one, it will be deleted after 24 November 2027\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns a parent who comes back after a long break', async () => {
    render(
      <FamilyDataPanel
        api={fakeApi({
          ...QUIET,
          warning: {
            unusedSince: '2025-12-20T00:00:00.000Z',
            wouldHaveBeenDeletedOn: '2026-12-20T00:00:00.000Z',
          },
        })}
      />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Nobody had used this account since 20 December 2025. It would have been deleted on 20 December 2026. Using it now keeps it for another 12 months.',
    );
  });

  it('still offers the download when the activity cannot be loaded', async () => {
    render(<FamilyDataPanel api={fakeApi(new Error('offline'))} />);
    expect(await screen.findByRole('link', { name: 'Download your family’s data' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('family data client', () => {
  it('reads the activity with the parent session cookie', async () => {
    const fetch = vi.fn(async () => Response.json(QUIET));
    const api = createFamilyDataApi({ baseUrl: 'https://api.test/', fetch });
    expect(api.exportUrl).toBe('https://api.test/v1/export');
    expect(await api.activity()).toEqual(QUIET);
    expect(fetch).toHaveBeenCalledWith(new URL('https://api.test/v1/family/activity'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('fails clearly when the server says no', async () => {
    const api = createFamilyDataApi({
      baseUrl: 'https://api.test',
      fetch: async () => new Response('', { status: 500 }),
    });
    await expect(api.activity()).rejects.toThrow('The server replied with 500.');
  });
});
