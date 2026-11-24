import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Topic, UnitChallenge } from '../api/schemas';
import { CheckIcon, CrownIcon, LockIcon, WrenchIcon } from '../components/icons';

type OnLocked = (message: string) => void;

function topicLabel(topic: Topic): string {
  switch (topic.status) {
    case 'mastered':
      return `${topic.title}, mastered`;
    case 'in-progress':
      return `${topic.title}, ${topic.mastery}% mastered`;
    case 'weak':
      return `${topic.title}, weak spot, ${topic.mastery}% mastered`;
    case 'locked':
      return `${topic.title}, locked`;
  }
}

function HexBody({ topic }: { topic: Topic }) {
  switch (topic.status) {
    case 'mastered':
      return <CheckIcon />;
    case 'in-progress':
      return <span className="hex__percent">{topic.mastery}%</span>;
    case 'weak':
      return (
        <>
          <WrenchIcon />
          <span className="hex__tag">WEAK · {topic.mastery}%</span>
        </>
      );
    case 'locked':
      return <LockIcon />;
  }
}

function HexShell({ children }: { children: ReactNode }) {
  return <span className="hex__shape">{children}</span>;
}

/** One topic on the map: a pointy-top hexagon whose look follows the topic's state. */
export function TopicHex({ topic, onLocked }: { topic: Topic; onLocked: OnLocked }) {
  const className = `hex hex--${topic.status}`;
  const label = topicLabel(topic);
  const content = (
    <>
      <HexShell>
        {topic.status === 'in-progress' && (
          <span className="hex__fill-area" aria-hidden="true">
            <span className="hex__fill" style={{ height: `${topic.mastery}%` }} />
          </span>
        )}
        <span className="hex__content" aria-hidden="true">
          <HexBody topic={topic} />
        </span>
      </HexShell>
      <span className="hex__title" aria-hidden="true">
        {topic.title}
      </span>
    </>
  );

  if (topic.status === 'locked') {
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={() => onLocked(`Finish the topics before ${topic.title} to unlock it.`)}
      >
        {content}
      </button>
    );
  }
  return (
    <Link to={`/lesson/${topic.lessonId}`} className={className} aria-label={label}>
      {content}
    </Link>
  );
}

interface ChallengeHexProps {
  unitTitle: string;
  challenge: UnitChallenge;
  onLocked: OnLocked;
}

/** The unit challenge: a dark hexagon with a crown, unlocked by unit mastery. */
export function ChallengeHex({ unitTitle, challenge, onLocked }: ChallengeHexProps) {
  const content = (
    <>
      <HexShell>
        <span className="hex__content" aria-hidden="true">
          <CrownIcon />
          {!challenge.unlocked && (
            <span className="hex__tag">Unlocks at {challenge.unlockAtPercent}%</span>
          )}
        </span>
      </HexShell>
      <span className="hex__title" aria-hidden="true">
        Challenge
      </span>
    </>
  );

  if (!challenge.unlocked) {
    return (
      <button
        type="button"
        className="hex hex--challenge"
        aria-label={`${unitTitle} challenge, unlocks at ${challenge.unlockAtPercent}% mastered`}
        onClick={() =>
          onLocked(
            `Reach ${challenge.unlockAtPercent}% mastery in ${unitTitle} to unlock the challenge.`,
          )
        }
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      to={`/lesson/${challenge.lessonId}`}
      className="hex hex--challenge hex--unlocked"
      aria-label={`${unitTitle} challenge`}
    >
      {content}
    </Link>
  );
}
