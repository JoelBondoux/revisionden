import { useReadAloud } from './ReadAloudProvider';

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ReadAloudButtonProps {
  /** What to read; written maths is read sensibly. */
  text: string;
  /** The button's accessible name, for example "Read the question aloud". */
  label: string;
}

/** A speaker button that reads text aloud. Shows only when read aloud is on for this device. */
export function ReadAloudButton({ text, label }: ReadAloudButtonProps) {
  const { on, speak } = useReadAloud();
  if (!on) return null;
  return (
    <button
      type="button"
      className="icon-button read-aloud-button"
      aria-label={label}
      title={label}
      onClick={() => speak(text)}
    >
      <SpeakerIcon />
    </button>
  );
}
