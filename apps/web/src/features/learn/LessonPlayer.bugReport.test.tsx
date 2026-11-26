import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems } from './mocks';

const short = { ...demoItems[1]!, contentId: 'demo-content-0002' };

describe('a bug report from a lesson names the question (F16)', () => {
  it("adds the question's content id to the device details, and no text", async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [short], draftContent: false }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    const sheet = screen.getByRole('dialog', { name: 'Report a bug' });
    // Off by default for a student; it is only sent when they turn device details on.
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Include device details' }));
    expect(within(sheet).getByText('Question or card: demo-content-0002')).toBeInTheDocument();
    expect(within(sheet).queryByText(/Demo question 2/)).toBeNull();
  });
});
