import { useSound } from './SoundProvider';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

/** The quick mute in the app header. The icon changes too, so sound is never the only signal. */
export function MuteButton() {
  const { settings, update } = useSound();
  const muted = !settings.enabled;
  return (
    <button
      type="button"
      className="icon-button mute-button"
      aria-pressed={muted}
      aria-label={muted ? 'Turn sounds on' : 'Mute sounds'}
      title={muted ? 'Sounds off' : 'Sounds on'}
      onClick={() => update({ enabled: muted })}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
