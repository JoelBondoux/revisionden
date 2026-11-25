import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BetaBadge, type ProgrammesApi } from './BetaBadge';

const api = (beta: boolean): ProgrammesApi => ({
  get: vi.fn(async () => ({ beta })),
  leaveBeta: vi.fn(async () => {}),
});

describe('Beta badge (family tags, O6)', () => {
  it('shows nothing for a family that is not in the beta programme', async () => {
    const a = api(false);
    const { container } = render(<BetaBadge api={a} />);
    await vi.waitFor(() => expect(a.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a small Beta badge and lets a parent leave the programme', async () => {
    const a = api(true);
    render(<BetaBadge api={a} />);
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leave the beta programme' }));
    expect(a.leaveBeta).toHaveBeenCalled();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });
});

describe('programmes client', () => {
  it('reads and leaves on the real API paths with the session cookie', async () => {
    const { createProgrammesApi } = await import('./BetaBadge');
    const calls: string[] = [];
    const fetch = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)} ${init?.credentials}`);
      return String(url).endsWith('/programmes')
        ? new Response(JSON.stringify({ beta: true }), { status: 200 })
        : new Response(null, { status: 204 });
    });
    const client = createProgrammesApi({ baseUrl: 'https://api.example.test', fetch });
    expect(await client.get()).toEqual({ beta: true });
    await client.leaveBeta();
    expect(calls).toEqual([
      'GET https://api.example.test/v1/family/programmes include',
      'DELETE https://api.example.test/v1/family/programmes/beta include',
    ]);
  });

  it('treats a failed read as not in the programme', async () => {
    const { createProgrammesApi } = await import('./BetaBadge');
    const client = createProgrammesApi({
      baseUrl: 'https://api.example.test',
      fetch: async () => new Response(null, { status: 500 }),
    });
    expect(await client.get()).toEqual({ beta: false });
    await expect(client.leaveBeta()).rejects.toThrow();
  });
});
