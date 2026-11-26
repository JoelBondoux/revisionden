import { render } from '@testing-library/react';
import { useLessonShowsPip, useShowsLessonPip } from './lessonPip';

function Lesson() {
  useShowsLessonPip();
  return null;
}
function Layout() {
  return <p>{useLessonShowsPip() ? 'lesson has Pip' : 'layout shows Pip'}</p>;
}

// J14b: the layout's Pip row steps aside only while a lesson shows Pip in its own header.
describe('who shows Pip in a lesson', () => {
  it('is the layout until a lesson shows its own Pip, and again once it has gone', () => {
    const { getByText, rerender } = render(<Layout />);
    expect(getByText('layout shows Pip')).toBeInTheDocument();
    rerender(
      <>
        <Layout />
        <Lesson />
      </>,
    );
    expect(getByText('lesson has Pip')).toBeInTheDocument();
    rerender(<Layout />);
    expect(getByText('layout shows Pip')).toBeInTheDocument();
  });
});
