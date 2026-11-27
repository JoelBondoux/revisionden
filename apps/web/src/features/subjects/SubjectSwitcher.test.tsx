import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { topicMap } from '../../mocks/data';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { chosenSubject, reportMap, useKnownSubjects } from './chosenSubject';
import { renderHook } from '@testing-library/react';

/*
 * Codex on #423 (blocking: siblings share a device). What the top bar knows about one student's
 * subjects must never show for, or be saved under, another student.
 */
const art = [
  { subjectId: 'gcse-art', subject: 'Art', hasContent: true },
  { subjectId: 'gcse-drama', subject: 'Drama', hasContent: true },
];
const mine = [
  { subjectId: 'gcse-maths', subject: 'Maths', hasContent: true },
  { subjectId: 'gcse-biology', subject: 'Biology', hasContent: true },
];

describe('the subject switcher on a shared device', () => {
  it("forgets another student's subjects", () => {
    reportMap('student-a', { ...topicMap, subjectId: 'gcse-art', subject: 'Art', subjects: art });
    expect(renderHook(() => useKnownSubjects('student-a')).result.current?.current.subject).toBe(
      'Art',
    );
    expect(renderHook(() => useKnownSubjects('student-b')).result.current).toBeNull();
  });

  it("shows the new student's subjects on Cards, and saves a pick under them", async () => {
    // Student A used the device first, then student B unlocks and goes straight to Cards.
    reportMap('student-a', { ...topicMap, subjectId: 'gcse-art', subject: 'Art', subjects: art });
    server.use(
      http.get('*/v1/student/map', () =>
        HttpResponse.json({ ...topicMap, subjectId: 'gcse-maths', subjects: mine }),
      ),
    );
    renderRoute('/cards', { studentId: 'student-b' });
    const button = await screen.findByRole('button', { name: /^Maths ?, change subject$/ });
    await userEvent.click(button);
    const sheet = await screen.findByRole('dialog', { name: 'Your subjects' });
    expect(within(sheet).queryByRole('button', { name: 'Art' })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Biology' }));
    expect(chosenSubject('student-b')).toBe('gcse-biology');
    expect(chosenSubject('student-a')).toBeUndefined();
  });
});
