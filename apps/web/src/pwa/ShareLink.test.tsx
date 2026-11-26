import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareLink } from './ShareLink';
import { browserShareApis, isShareCancelled } from './share';

const TEXT = 'Join us on RevisionDen: https://dev.revisionden.test/join?code=ABC';

const abort = () => Object.assign(new Error('Share cancelled'), { name: 'AbortError' });

describe('browserShareApis', () => {
  it("uses the device's share sheet only when the browser has one", async () => {
    const share = vi.fn(async () => undefined);
    const apis = browserShareApis({ share } as unknown as Navigator);
    await apis.share!({ text: TEXT });
    expect(share).toHaveBeenCalledWith({ text: TEXT });
    expect(browserShareApis({} as Navigator).share).toBeUndefined();
  });

  it('copies with the clipboard when there is one', async () => {
    const writeText = vi.fn(async () => undefined);
    const apis = browserShareApis({ clipboard: { writeText } } as unknown as Navigator);
    await apis.copy!(TEXT);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(browserShareApis({} as Navigator).copy).toBeUndefined();
  });

  it('works where there is no navigator at all', () => {
    expect(browserShareApis(undefined)).toEqual({});
  });
});

describe('isShareCancelled', () => {
  it('treats closing the share sheet as a cancel, not an error', () => {
    expect(isShareCancelled(abort())).toBe(true);
    expect(isShareCancelled(new Error('Permission denied'))).toBe(false);
    expect(isShareCancelled('nope')).toBe(false);
  });
});

describe('ShareLink', () => {
  it("shows a big Share link button that opens the device's share sheet", async () => {
    const share = vi.fn(async () => undefined);
    render(<ShareLink text={TEXT} share={{ share, copy: vi.fn() }} />);
    const button = screen.getByRole('button', { name: 'Share link' });
    expect(button).toHaveClass('btn--block');
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    await userEvent.click(button);
    expect(share).toHaveBeenCalledWith({ text: TEXT });
  });

  it('keeps Copy link where the device cannot share', async () => {
    const copy = vi.fn(async () => undefined);
    render(<ShareLink text={TEXT} share={{ copy }} />);
    expect(screen.queryByRole('button', { name: 'Share link' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledWith(TEXT);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('does nothing when the share sheet is closed without sharing', async () => {
    const share = vi.fn(async () => Promise.reject(abort()));
    render(<ShareLink text={TEXT} share={{ share, copy: vi.fn() }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
  });

  it('offers Copy link instead when sharing fails', async () => {
    const share = vi.fn(async () => Promise.reject(new Error('Permission denied')));
    const copy = vi.fn(async () => undefined);
    render(<ShareLink text={TEXT} share={{ share, copy }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sharing didn't work. Copy the link instead.",
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledWith(TEXT);
  });

  it('shows no buttons when the device can neither share nor copy', () => {
    render(<ShareLink text={TEXT} share={{}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
