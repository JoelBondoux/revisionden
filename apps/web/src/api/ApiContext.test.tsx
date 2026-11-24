import { render, screen } from '@testing-library/react';
import type { ApiClient } from './client';
import { ApiProvider, defaultBaseUrl, useApi } from './ApiContext';

function WhichClient() {
  const api = useApi();
  return <p>{'marker' in api ? 'custom' : 'default'}</p>;
}

describe('API context', () => {
  it('gives components a default client when no provider is present', () => {
    render(<WhichClient />);
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('lets a provider supply its own client', () => {
    const custom = { marker: true } as unknown as ApiClient;
    render(
      <ApiProvider client={custom}>
        <WhichClient />
      </ApiProvider>,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('uses the configured API address, or /api on this site', () => {
    expect(defaultBaseUrl({ VITE_API_URL: 'https://api.example.test' }, 'http://x.test')).toBe(
      'https://api.example.test',
    );
    expect(defaultBaseUrl({}, 'http://x.test')).toBe('http://x.test/api');
  });
});
