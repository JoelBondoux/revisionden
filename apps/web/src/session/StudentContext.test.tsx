import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentProvider, useStudent } from './StudentContext';

function Probe() {
  const { studentId, chooseStudent } = useStudent();
  return (
    <>
      <p>current: {studentId ?? 'none'}</p>
      <button type="button" onClick={() => chooseStudent('student-2')}>
        choose
      </button>
    </>
  );
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('student choice', () => {
  it('starts with nobody chosen', () => {
    render(
      <StudentProvider storage={memoryStorage()}>
        <Probe />
      </StudentProvider>,
    );
    expect(screen.getByText('current: none')).toBeInTheDocument();
  });

  it('remembers the chosen student on this device', async () => {
    const storage = memoryStorage();
    const { unmount } = render(
      <StudentProvider storage={storage}>
        <Probe />
      </StudentProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'choose' }));
    expect(screen.getByText('current: student-2')).toBeInTheDocument();
    unmount();
    render(
      <StudentProvider storage={storage}>
        <Probe />
      </StudentProvider>,
    );
    expect(screen.getByText('current: student-2')).toBeInTheDocument();
  });

  it('still works when the browser blocks storage', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    render(
      <StudentProvider storage={blocked}>
        <Probe />
      </StudentProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'choose' }));
    expect(screen.getByText('current: student-2')).toBeInTheDocument();
  });
});
