import { useId } from 'react';
import type { NextMission } from '../api/schemas';
import { ButtonLink } from '../components/Button';
import { Pip } from '../components/Pip';

/** The dark card at the top of the map that suggests what to do next. */
export function NextMissionCard({ mission }: { mission: NextMission }) {
  const headingId = useId();
  return (
    <section className="mission" aria-labelledby={headingId}>
      <Pip size={64} />
      <div className="mission__text">
        <h2 id={headingId} className="mission__eyebrow">
          Next mission
        </h2>
        <p className="mission__title">{mission.title}</p>
        <p className="mission__time">{mission.minutes} min</p>
      </div>
      <ButtonLink
        to={`/lesson/${mission.lessonId}`}
        variant="gold"
        aria-label={`Go: ${mission.title}`}
      >
        Go
      </ButtonLink>
    </section>
  );
}
