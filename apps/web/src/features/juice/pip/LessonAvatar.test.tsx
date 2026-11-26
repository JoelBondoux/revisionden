import { act, render } from '@testing-library/react';
import { LessonAvatar } from './LessonAvatar';
import { reactToAnswer } from './reactions';

const CODE = 'A0'; // any code; AvatarSvg falls back to the default avatar when it is not valid
const motion = (c: HTMLElement) => c.querySelector('[data-motion]')?.getAttribute('data-motion');

// J14b: the student's own avatar sits beside Pip's line in a lesson and reacts with Pip.
describe('the avatar in a lesson', () => {
  it('shows the student in their ring, holding still between answers', () => {
    const { container } = render(<LessonAvatar code={CODE} reducedMotion={() => false} />);
    expect(container.querySelector('.framed-avatar')).toBeInTheDocument();
    expect(motion(container)).toBe('idle');
  });

  it('nods, hops or goes "hmm" with each marked answer', () => {
    const { container } = render(<LessonAvatar code={CODE} reducedMotion={() => false} />);
    act(() => reactToAnswer({ kind: 'right', combo: 1 }));
    expect(motion(container)).toBe('nod');
    act(() => reactToAnswer({ kind: 'goal', combo: 2 }));
    expect(motion(container)).toBe('hop');
    act(() => reactToAnswer({ kind: 'wrong', combo: 0 }));
    expect(motion(container)).toBe('hmm');
  });

  it('stays still with reduced motion, and shows nothing without an avatar', () => {
    const { container } = render(<LessonAvatar code={CODE} reducedMotion={() => true} />);
    act(() => reactToAnswer({ kind: 'goal', combo: 1 }));
    expect(motion(container)).toBe('still');
    expect(render(<LessonAvatar code={null} />).container).toBeEmptyDOMElement();
  });
});
