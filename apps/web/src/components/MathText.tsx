import { Fragment, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import { hasPowers, parsePowers, showsPowers, type PowerPart } from '@revisionden/core';
import { mathsToSpeech } from '../features/read-aloud/maths';

const STORAGE_KEY = 'revisionden.powersSwitched';

// F9b (owner): one switch for every power on screen, remembered on this device. Switched means
// the other way from the subject's usual look: ^ in maths, raised in computing.
let switched = readSwitched();
const listeners = new Set<() => void>();

function readSwitched(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A new screen picks up the saved choice (for example after another tab changed it).
  switched = readSwitched();
  return () => listeners.delete(listener);
}

function toggle() {
  switched = !switched;
  try {
    window.localStorage.setItem(STORAGE_KEY, switched ? '1' : '0');
  } catch {
    // Private mode or blocked storage: the switch still works until the page reloads.
  }
  listeners.forEach((l) => l());
}

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
 * A tap on any power switches every power on screen between x² and x^2, and back on another
 * tap; the choice is remembered on this device (F9b, owner). Computing subjects start with ^
 * (a real symbol there) and a tap raises them. The tap never chooses an answer or turns a card.
 * Screen readers hear the words either way ("x squared"). Text without a power is left as it is.
 */
export function MathText({ text, subject }: { text: string; subject?: string }) {
  const flipped = useSyncExternalStore(
    subscribe,
    () => switched,
    () => false,
  );
  if (!hasPowers(text)) return <>{text}</>;
  const raised = showsPowers(subject) !== flipped;
  function onTap(event: MouseEvent) {
    // Inside an answer choice or a flashcard, the tap only switches the powers.
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }
  return (
    <>
      <span
        aria-hidden="true"
        className="math-text"
        title={raised ? 'Tap to show as ^' : 'Tap to show as a power'}
        onClick={onTap}
      >
        {raised ? <Parts parts={parsePowers(text)} /> : text}
      </span>
      <span className="visually-hidden">{mathsToSpeech(text)}</span>
    </>
  );
}
