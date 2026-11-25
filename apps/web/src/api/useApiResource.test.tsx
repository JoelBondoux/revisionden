import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { createApiClient } from './client';
import { useApiResource } from './useApiResource';
import { LoadingOrError } from './LoadingOrError';

const client = createApiClient({ baseUrl: 'http://api.test' });

function FamilyNames() {
  const resource = useApiResource(() => client.getFamily(), []);
  if (resource.status !== 'ready') return <LoadingOrError resource={resource} />;
  return (
    <ul>
      {resource.data.children.map(({ student: s }) => (
        <li key={s.id}>{s.nickname}</li>
      ))}
    </ul>
  );
}

describe('loading data from the API', () => {
  it('shows a loading message, then the data', async () => {
    render(<FamilyNames />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
  });

  it('shows retry UI on a network error and recovers when retried', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.error(), { once: true }));
    render(<FamilyNames />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can't reach revisionden/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
  });

  it('explains a server problem differently from being offline', async () => {
    server.use(http.get('*/v1/onboarding/family', () => new HttpResponse(null, { status: 503 })));
    render(<FamilyNames />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
