import { act, render, screen } from '@testing-library/react';
import { setPipSubject, usePipSubject } from './subject';

function Show() {
  return <p>{usePipSubject() ?? 'plain'}</p>;
}

describe('the subject Pip dresses for', () => {
  afterEach(() => setPipSubject(null));

  it('follows the subject last shown on the map, and is not saved on the device', () => {
    const before = { ...localStorage };
    render(<Show />);
    expect(screen.getByText('plain')).toBeInTheDocument();
    act(() => setPipSubject('gcse-physics'));
    expect(screen.getByText('gcse-physics')).toBeInTheDocument();
    expect({ ...localStorage }).toEqual(before);
  });
});
