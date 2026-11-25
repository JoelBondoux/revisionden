import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems } from '../learn/mocks';
import { demoRecall } from './mocks';

const withRecall = () =>
  server.use(http.get('*/v1/student/recall', () => HttpResponse.json(demoRecall)));
const lessonOf = (index: number) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: [demoItems[index]], draftContent: true }),
    ),
  );

describe('Recall checks', () => {
  it('start a lesson on a practised topic with "Remember this?"', async () => {
    withRecall();
    lessonOf(2);
    renderRoute('/learn/topic/demo-topic-a');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Remember this?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no penalty/i)).toBeInTheDocument();
  });

  it('can be skipped straight to the lesson', async () => {
    withRecall();
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Skip recall check' }));
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Remember this?' })).not.toBeInTheDocument();
  });

  it('go straight on to the lesson after the 2 questions, a wrong one becoming a flashcard', async () => {
    withRecall();
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.type(await screen.findByLabelText('Your answer'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/Added to your flashcards/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Remember this?' })).not.toBeInTheDocument();
  });

  it('are left out for a topic never practised', async () => {
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
  });

  it('never block the lesson when the recall check fails to load', async () => {
    server.use(http.get('*/v1/student/recall', () => HttpResponse.json({}, { status: 500 })));
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
  });
});
