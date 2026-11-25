import { useMemo } from 'react';
import { defaultBaseUrl } from '../../api/ApiContext';
import { ApiError } from '../../api/client';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Card, Pill, ProgressBar } from '../../components';
import { itemWords, longDate, RarityPill } from './parts';
import { RewardSound } from '../sound';
import { createRewardsApi, type RewardsApi } from './rewardsApi';
import './rewards.css';

/** The student rewards screen: level, this year's chapter, milestones, collections and drops. */
export function RewardsScreen({ api }: { api: RewardsApi }) {
  const resource = useApiResource(
    () =>
      api.getMyRewards().catch((err: unknown) => {
        throw err instanceof ApiError ? err : new ApiError('network', String(err));
      }),
    [api],
  );
  if (resource.status !== 'ready') return <LoadingOrError resource={resource} />;
  const { overview, newlyEarned, parentRewards } = resource.data;
  const metFromHome = parentRewards.filter((r) => r.reached && !r.givenAt);
  const { level, chapter } = overview;
  const next =
    level.prestigeStars > 0 || level.level === 100
      ? 'the next prestige star'
      : `level ${level.level + 1}`;

  return (
    <div className="stack rewards">
      {newlyEarned.length + metFromHome.length > 0 && (
        <div role="status" className="rewards__new">
          <RewardSound rewards={newlyEarned} />
          {newlyEarned.map((r) => (
            <p key={r.id}>New: {r.name}</p>
          ))}
          {metFromHome.map((r) => (
            <p key={r.id}>Target met: {r.title} (from home)</p>
          ))}
        </div>
      )}

      <section className="rewards__level" aria-labelledby="rewards-level">
        <h1 id="rewards-level">Level {level.level}</h1>
        {level.prestigeStars > 0 && (
          <p className="rewards__stars" aria-label={`${level.prestigeStars} prestige stars`}>
            {'★'.repeat(level.prestigeStars)}
          </p>
        )}
        <ProgressBar
          label={`XP to ${next}`}
          value={level.xpIntoLevel}
          max={level.xpForNext}
          valueText={`${level.xpIntoLevel} of ${level.xpForNext} XP`}
          tone="gold"
        />
        <p className="secondary-text">
          Reward XP comes from right answers. Late-night study does not count.
        </p>
      </section>

      {chapter && (
        <Card title={`Chapter ${chapter.number}: ${chapter.name}`}>
          <p className="secondary-text">
            {chapter.theme} · {chapter.earned} of {chapter.total} unlocked
          </p>
          {chapter.next && (
            <p>
              Next: {chapter.next.name} ({chapter.next.current} of {chapter.next.target})
            </p>
          )}
          <ol className="rewards__track">
            {chapter.steps.map((step, i) => (
              <li
                key={step.id}
                className={step.earned ? 'rewards__step rewards__step--earned' : 'rewards__step'}
                title={step.name}
                aria-label={`Step ${i + 1}: ${step.name}, ${step.earned ? 'unlocked' : 'locked'}`}
              >
                {i + 1}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Next milestones">
        <ul className="rewards__list">
          {overview.nextMilestones.map((m) => (
            <li key={m.id}>
              <span className="rewards__row">
                <strong>{m.name}</strong> <RarityPill rarity={m.rarity} />
              </span>
              <ProgressBar
                label={m.name}
                value={m.current}
                max={m.target}
                valueText={`${m.current} of ${m.target}`}
              />
              <span className="secondary-text">{itemWords(m)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {overview.seasons.map((season) => (
        <Card key={season.id} title={season.name}>
          <p className="secondary-text">
            {season.challenge}. Ends {longDate(season.ends)}.
          </p>
          <ul className="rewards__list">
            {season.items.map((item) => (
              <li key={item.id}>
                <span className="rewards__row">
                  <span>
                    {item.earned ? '✓ ' : ''}
                    {item.name}
                  </span>
                  <RarityPill rarity={item.rarity} />
                  <span className="secondary-text">
                    {item.current} of {item.target}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {overview.hiddenTracks.map((track) => (
        <Card key={track.id} title={track.name}>
          <p className="secondary-text">
            Hidden track · {track.earned} of {track.total} unlocked
          </p>
          {track.next && (
            <p>
              Next: {track.next.name} ({track.next.current} of {track.next.target})
            </p>
          )}
        </Card>
      ))}

      <Card title="Secret achievements">
        <p className="secondary-text">
          {overview.secrets.found} of {overview.secrets.total} found
        </p>
        <ul className="rewards__secrets">
          {overview.secrets.cards.map((secret) => (
            <li
              key={secret.id}
              className={
                secret.earned ? 'rewards__secret rewards__secret--found' : 'rewards__secret'
              }
            >
              <strong>{secret.name}</strong>
              {!secret.earned && secret.hint && (
                <span className="secondary-text">{secret.hint}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Collections">
        <ul className="rewards__list">
          {overview.collections.map((set) => (
            <li key={set.id}>
              <span className="rewards__row">
                <strong>{set.name}</strong>
                {set.complete && <Pill tone="success">Complete</Pill>}
              </span>
              <ProgressBar
                label={`${set.name} collection`}
                value={set.earned}
                max={set.total}
                valueText={`${set.earned} of ${set.total}`}
                tone="success"
              />
            </li>
          ))}
        </ul>
      </Card>

      {parentRewards.length > 0 && (
        <Card title="From home">
          <ul className="rewards__list">
            {parentRewards.map((r) => (
              <li key={r.id}>
                <span className="rewards__row">
                  <strong>{r.title}</strong> <Pill tone="primary">From home</Pill>
                  {r.givenAt ? (
                    <Pill tone="success">Given</Pill>
                  ) : (
                    r.reached && <Pill tone="gold">Target met</Pill>
                  )}
                </span>
                {r.note && <span>{r.note}</span>}
                <span className="secondary-text">{r.targetLabel}</span>
                <ProgressBar
                  label={r.title}
                  value={r.current}
                  max={r.goal}
                  valueText={`${r.current} of ${r.goal}`}
                  tone="success"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function RewardsPage() {
  const api = useMemo(
    () => createRewardsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [],
  );
  return <RewardsScreen api={api} />;
}
