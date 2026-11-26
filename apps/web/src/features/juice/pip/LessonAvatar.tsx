import { useEffect, useRef } from 'react';
import { useAvatarMotion } from '../../avatar/motion';
import { FramedAvatar } from './FramedAvatar';
import { usePipReaction } from './reactions';

/**
 * J14b: the student's own avatar beside Pip's line in a lesson. It holds still between answers
 * (no idle loop in a lesson) and reacts with Pip to each marked answer: a nod, a hop for today's
 * goal, a "hmm" for a wrong answer (`pipReactionFor`). Nothing with reduced motion.
 */
export function LessonAvatar({
  code,
  reducedMotion,
}: {
  code: string | null | undefined;
  reducedMotion?: () => boolean;
}) {
  const { props, react } = useAvatarMotion({ paused: true, reducedMotion });
  const reaction = usePipReaction();
  const seen = useRef(reaction.key);
  useEffect(() => {
    if (reaction.key === seen.current || !reaction.avatar) return;
    seen.current = reaction.key;
    react(reaction.avatar);
  }, [reaction, react]);
  if (!code) return null;
  return (
    <span className="lesson-avatar">
      <FramedAvatar
        code={code}
        motion={props.motion}
        motionKey={props.motionKey}
        paused={props.paused}
      />
    </span>
  );
}
