import { allowedInMode, markSound, SOUND_EVENTS } from './events';

describe('sound events', () => {
  it('pick correct, part marks or wrong from a marked answer', () => {
    expect(markSound({ correct: true, score: 1 })).toBe('correct');
    expect(markSound({ correct: false, score: 0.5 })).toBe('partMarks');
    expect(markSound({ correct: false, score: 0 })).toBe('wrong');
  });

  it('in Test mode never play correct, wrong or part marks before submit', () => {
    for (const event of ['correct', 'wrong', 'partMarks'] as const) {
      expect(allowedInMode(event, 'test')).toBe(false);
      expect(allowedInMode(event, 'learn')).toBe(true);
    }
    expect(allowedInMode('submit', 'test')).toBe(true);
    expect(allowedInMode('reveal', 'test')).toBe(true);
  });

  it('in timed papers play only the timer warning', () => {
    for (const event of SOUND_EVENTS) {
      expect(allowedInMode(event, 'timed')).toBe(event === 'timerWarning');
    }
  });
});
