import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart } from './BarChart';

const buckets = [
  { label: 'Mon', value: 60 },
  { label: 'Tue', value: 35 },
  { label: 'Wed', value: 0 },
];

describe('BarChart', () => {
  it('shows a bar value in a tooltip on hover and on keyboard focus', async () => {
    render(<BarChart title="XP per day" buckets={buckets} unit="XP" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', { name: 'Mon: 60 XP' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mon: 60 XP');
    await userEvent.tab();
    expect(screen.getByRole('img', { name: 'Mon: 60 XP' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tue: 35 XP');
  });

  it('draws a dashed reference line for a goal', () => {
    render(
      <BarChart
        title="XP per day"
        buckets={buckets}
        unit="XP"
        reference={{ value: 50, label: 'Daily goal' }}
      />,
    );
    expect(screen.getByTestId('chart-reference')).toHaveAttribute('stroke-dasharray');
    expect(screen.getByText('Daily goal: 50 XP')).toBeInTheDocument();
  });

  it('has a table view with every value, which can be shown on screen', async () => {
    render(<BarChart title="XP per day" buckets={buckets} unit="XP" />);
    const table = screen.getByRole('table', { name: 'XP per day' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('cell', { name: '35 XP' })).toBeInTheDocument();
    expect(table.closest('.visually-hidden')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));
    expect(table.closest('.visually-hidden')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show chart' })).toBeInTheDocument();
  });

  it('formats values with a custom formatter', () => {
    render(
      <BarChart title="Study time" buckets={buckets} unit="min" format={(v) => `${v / 60} h`} />,
    );
    expect(screen.getByRole('img', { name: 'Mon: 1 h' })).toBeInTheDocument();
  });
});
