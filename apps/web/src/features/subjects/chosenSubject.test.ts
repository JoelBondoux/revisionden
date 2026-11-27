import { act, renderHook } from '@testing-library/react';
import type { TopicMap } from '@revisionden/core';
import { topicMap } from '../../mocks/data';
import {
  chooseSubject,
  chosenSubject,
  pickerOrder,
  reportMap,
  resetKnownSubjects,
  stillTaken,
  useChosenSubject,
  useKnownSubjects,
} from './chosenSubject';

const subjects = [
  { subjectId: 'maths', subject: 'Maths', hasContent: true },
  { subjectId: 'biology', subject: 'Biology', hasContent: false },
];
const mapFor = (subjectId: string, subject: string): TopicMap => ({
  ...topicMap,
  subjectId,
  subject,
  subjects,
});

afterEach(() => {
  localStorage.clear();
  resetKnownSubjects();
});

describe('the chosen subject (UX-1)', () => {
  it('is remembered for each student on this device, and forgotten on request', () => {
    expect(chosenSubject('s1')).toBeUndefined();
    chooseSubject('s1', 'biology');
    expect(chosenSubject('s1')).toBe('biology');
    expect(chosenSubject('s2')).toBeUndefined();
    chooseSubject('s1', null);
    expect(chosenSubject('s1')).toBeUndefined();
  });

  it('is nothing without a student', () => {
    chooseSubject(null, 'biology');
    expect(chosenSubject(null)).toBeUndefined();
  });

  it('tells every screen when it changes', () => {
    const { result } = renderHook(() => useChosenSubject('s1'));
    expect(result.current).toBeUndefined();
    act(() => chooseSubject('s1', 'maths'));
    expect(result.current).toBe('maths');
  });

  it('counts as still taken unless the subjects are known and it is not among them', () => {
    expect(stillTaken(undefined, subjects)).toBe(true);
    expect(stillTaken('maths', subjects)).toBe(true);
    expect(stillTaken('maths', [])).toBe(true);
    expect(stillTaken('chemistry', subjects)).toBe(false);
  });

  it('falls back to the default when a loaded map shows the subject was dropped', () => {
    chooseSubject('s1', 'chemistry');
    reportMap('s1', mapFor('maths', 'Maths'));
    expect(chosenSubject('s1')).toBeUndefined();
  });

  it("gives the top bar the subject on screen and the student's subjects", () => {
    const { result } = renderHook(() => useKnownSubjects());
    expect(result.current).toBeNull();
    act(() => reportMap('s1', mapFor('biology', 'Biology')));
    expect(result.current?.current).toEqual({ subjectId: 'biology', subject: 'Biology' });
    expect(result.current?.subjects.map((s) => s.subject)).toEqual(['Maths', 'Biology']);
  });

  it('shows the one subject on screen when the map lists none', () => {
    const { result } = renderHook(() => useKnownSubjects());
    act(() => reportMap('s1', { ...topicMap, subjectId: 'maths', subjects: undefined }));
    expect(result.current?.subjects).toEqual([
      { subjectId: 'maths', subject: 'Maths', hasContent: true },
    ]);
  });
});

describe('the order subjects are offered in (UX-1)', () => {
  const four = [
    { subjectId: 'art', subject: 'Art', hasContent: false },
    { subjectId: 'biology', subject: 'Biology', hasContent: true },
    { subjectId: 'chemistry', subject: 'Chemistry', hasContent: false },
    { subjectId: 'maths', subject: 'Maths', hasContent: true },
  ];
  const ids = (list: { subjectId: string }[]) => list.map((s) => s.subjectId);

  it('puts the current subject first, then the others with questions, and folds the rest', () => {
    const { now, later } = pickerOrder(four, 'maths');
    expect(ids(now)).toEqual(['maths', 'biology']);
    expect(ids(later)).toEqual(['art', 'chemistry']);
  });

  it('keeps a current subject that is coming soon at the top, not folded away', () => {
    const { now, later } = pickerOrder(four, 'art');
    expect(ids(now)).toEqual(['art', 'biology', 'maths']);
    expect(ids(later)).toEqual(['chemistry']);
  });

  it('works before any subject is current', () => {
    expect(ids(pickerOrder(four, undefined).now)).toEqual(['biology', 'maths']);
  });
});
