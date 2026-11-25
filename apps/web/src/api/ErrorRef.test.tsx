import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../mocks/server';
import { ErrorRef, refOf } from './ErrorRef';
import { ApiError } from './client';

const show = (path = '/family/8f6d2b1e-4c3a-4d5e-9f00-000000000001/rewards') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ErrorRef code={{ ref: 'RD-VDMW5E', status: 404, apiPath: '/v1/student/map' }} />
    </MemoryRouter>,
  );

describe('ErrorRef', () => {
  it('shows the code and sends an anonymous report with one tap', async () => {
    let body: unknown;
    server.use(
      http.post('*/v1/error-reports', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ received: true }, { status: 202 });
      }),
    );
    show();
    expect(screen.getByText('RD-VDMW5E')).toBeInTheDocument();
    expect(body).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Send error report' }));
    expect(await screen.findByText("Thanks, we're on it.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send error report' })).not.toBeInTheDocument();
    expect(body).toEqual({
      ref: 'RD-VDMW5E',
      screen: '/family/:id/rewards',
      apiPath: '/v1/student/map',
      status: 404,
      build: expect.any(String),
      browser: expect.stringMatching(/^(Chrome|Edge|Firefox|Safari|Other)$/),
      online: true,
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('says so when the report cannot be sent, so it can be tried again', async () => {
    server.use(http.post('*/v1/error-reports', () => HttpResponse.error()));
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Send error report' }));
    expect(await screen.findByText(/could not be sent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send error report' })).toBeEnabled();
  });

  it('shows nothing without a code', () => {
    const { container } = render(
      <MemoryRouter>
        <ErrorRef code={undefined} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reads the code, status and failing API path from an API error', () => {
    const error = new ApiError('http', 'x', 404, 'RD-VDMW5E', 'not_found', '/v1/student/map');
    expect(refOf(error)).toEqual({ ref: 'RD-VDMW5E', status: 404, apiPath: '/v1/student/map' });
    expect(refOf(new Error('plain'))).toBeUndefined();
  });
});
