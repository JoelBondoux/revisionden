import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MapTopic as Topic, UnitChallenge } from '@revisionden/core';
import { CheckIcon, CrownIcon, LockIcon, WrenchIcon } from '../components/icons';

type OnLocked = (message: string) => void;

function topicLabel(topic: Topic): string {
  switch (topic.status) {
    case 'mastered':
      return `${topic.title}, mastered`;
    case 'in-progress':
      return `${topic.title}, ${topic.mastery}% mastered`;
    case 'weak':
      return `${topic.title}, weak, ${topic.mastery}% mastered`;
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
  // The title comes first in the page, so the name starts with the words on screen in the
  // same order (CSS still shows the hexagon above the title).
  const content = (
    <>
      <span className="hex__title" aria-hidden="true">
        {topic.title}
      </span>{' '}
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
    <Link to={`/learn/topic/${topic.lessonId}`} className={className} aria-label={label}>
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
      <span className="hex__title" aria-hidden="true">
        Challenge
      </span>{' '}
      <HexShell>
        <span className="hex__content" aria-hidden="true">
          <CrownIcon />
          {!challenge.unlocked && (
            <span className="hex__tag">Unlocks at {challenge.unlockAtPercent}%</span>
          )}
        </span>
      </HexShell>
    </>
  );

  if (!challenge.unlocked) {
    return (
      <button
        type="button"
        className="hex hex--challenge"
        aria-label={`Challenge, unlocks at ${challenge.unlockAtPercent}% mastered in ${unitTitle}`}
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
      to={`/learn/topic/${challenge.lessonId}`}
      className="hex hex--challenge hex--unlocked"
      aria-label={`Challenge, ${unitTitle}`}
    >
      {content}
    </Link>
  );
}
