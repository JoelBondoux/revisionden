import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { family } from '../../mocks/data';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import type { OnboardingApi } from './api';
import { LinkedDevicesCard } from './LinkedDevicesCard';
import { OnboardingApiProvider } from './OnboardingApiContext';

const [nova, pixel] = family.children;

function renderCard(api: OnboardingApi) {
  return render(
    <MemoryRouter>
      <OnboardingApiProvider api={api}>
        <LinkedDevicesCard />
      </OnboardingApiProvider>
    </MemoryRouter>,
  );
}

describe('LinkedDevicesCard (parent area)', () => {
  it("lists each child's devices with type and date linked", async () => {
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => family),
      listDevices: vi.fn(async (id: string) =>
        id === nova!.student.id
          ? [
              {
                id: 'd1',
                deviceType: 'phone' as const,
                linkedAt: '2026-11-24T10:00:00.000Z',
                lastUsedAt: null,
              },
            ]
          : [],
      ),
    });
    renderCard(api);
    const card = await screen.findByRole('region', { name: 'Linked devices' });
    const novaList = await within(card).findByRole('list', {
      name: `${nova!.student.nickname}'s devices`,
    });
    expect(within(novaList).getByText('Phone')).toBeInTheDocument();
    expect(within(novaList).getByText('Linked 24 November 2026')).toBeInTheDocument();
    expect(
      within(card).getByText(`No devices linked for ${pixel!.student.nickname} yet.`),
    ).toBeInTheDocument();
  });

  it('removes a device after asking, which signs it out', async () => {
    let devices = [
      { id: 'd1', deviceType: null, linkedAt: '2026-11-24T10:00:00.000Z', lastUsedAt: null },
    ];
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({ children: [nova!] })),
      listDevices: vi.fn(async () => devices),
      removeDevice: vi.fn(async () => {
        devices = [];
      }),
    });
    const user = userEvent.setup();
    renderCard(api);
    expect(await screen.findByText('Device')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText(/This signs the device out/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(api.removeDevice).toHaveBeenCalledWith(nova!.student.id, 'd1');
    expect(
      await screen.findByText(`No devices linked for ${nova!.student.nickname} yet.`),
    ).toBeInTheDocument();
  });

  it('can back out of removing', async () => {
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({ children: [nova!] })),
      listDevices: vi.fn(async () => [
        {
          id: 'd1',
          deviceType: 'tablet' as const,
          linkedAt: '2026-11-24T10:00:00.000Z',
          lastUsedAt: null,
        },
      ]),
    });
    const user = userEvent.setup();
    renderCard(api);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(api.removeDevice).not.toHaveBeenCalled();
    expect(screen.getByText('Tablet')).toBeInTheDocument();
  });

  it('shows nothing when there are no children', async () => {
    const api = fakeOnboardingApi();
    const { container } = renderCard(api);
    await vi.waitFor(() => expect(api.getFamily).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a remove error', async () => {
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({ children: [nova!] })),
      listDevices: vi.fn(async () => [
        {
          id: 'd1',
          deviceType: 'computer' as const,
          linkedAt: '2026-11-24T10:00:00.000Z',
          lastUsedAt: null,
        },
      ]),
      removeDevice: vi.fn(async () => {
        throw new Error('Could not reach RevisionDen.');
      }),
    });
    const user = userEvent.setup();
    renderCard(api);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
  });
});
