import { Fragment, type ReactNode } from 'react';
import { hasPowers, parsePowers, showsPowers, type PowerPart } from '@revisionden/core';
import { mathsToSpeech } from '../features/read-aloud/maths';

function Parts({ parts }: { parts: PowerPart[] }): ReactNode {
  return parts.map((part, i) =>
    part.kind === 'text' ? (
      <Fragment key={i}>{part.text}</Fragment>
    ) : (
      <sup key={i}>
        <Parts parts={part.parts} />
      </sup>
    ),
  );
}

/**
 * Text that may contain maths, with powers shown as superscripts (F9): "x^2" is shown as x².
 * Screen readers hear the words instead ("x squared"), from the read-aloud rules. Text without a
 * power, and any text in a computing subject (where ^ is a real symbol), is shown as it is.
 */
export function MathText({ text, subject }: { text: string; subject?: string }) {
  if (!showsPowers(subject) || !hasPowers(text)) return <>{text}</>;
  return (
    <>
      <span aria-hidden="true">
        <Parts parts={parsePowers(text)} />
      </span>
      <span className="visually-hidden">{mathsToSpeech(text)}</span>
    </>
  );
}
