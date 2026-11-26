import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  EXTRA_CARDS,
  FLASHCARD_SESSION_MAX_CARDS,
  formatReviewDelay,
  type Flashcard,
  type FlashcardSession,
  type FlashcardSessionResult,
  type FlashcardsOverview,
} from '@revisionden/core';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { MathText } from '../../components/MathText';
import { StepThrough } from '../../components/StepThrough';
import { ArenaProgress } from '../juice';
import { subjectLabel, useLearnApi, type FlashcardRating } from '../learn/learnApi';
import { NewRewards } from '../learn/NewRewards';
import { DraftBanner } from '../learn/parts';
import { useSound } from '../sound';
import { ReadAloudButton } from '../read-aloud';
import { LearnMore, learnLinksByTopic, learnMoreLinks } from '../learn-links';
import './flashcards.css';

const RATINGS: {
  rating: FlashcardRating;
  label: string;
  variant: 'danger' | 'secondary' | 'success' | 'primary';
}[] = [
  { rating: 'again', label: 'Again', variant: 'danger' },
  { rating: 'hard', label: 'Hard', variant: 'secondary' },
  { rating: 'good', label: 'Good', variant: 'success' },
  { rating: 'easy', label: 'Easy', variant: 'primary' },
];

/**
 * A card that turns over in 3D (no animation when reduced motion is asked for). Tap it, or press
 * Space or Enter, to turn it either way as often as you like (F7). The answer face stays empty
 * until the answer has been revealed, and a new card is a new element that starts on its
 * question, so the next card's answer never shows while the card turns (F7 bug fix).
 */
function FlipCard({
  card,
  flipped,
  revealed,
  onTurn,
}: {
  card: Flashcard;
  flipped: boolean;
  revealed: boolean;
  onTurn: () => void;
}) {
  const hintId = useId();
  return (
    <>
      <span id={hintId} className="visually-hidden">
        {flipped ? 'Turn back to the question' : 'Turn over to see the answer'}
      </span>
      <div
        className={`flip-card${flipped ? ' flip-card--flipped' : ''}`}
        data-testid="flip-card"
        role="button"
        tabIndex={0}
        // The accessible name is the text on the card's showing face (the hidden face is
        // aria-hidden), so it matches what is seen (WCAG 2.5.3); the turn hint is the description.
        aria-describedby={hintId}
        onClick={onTurn}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            onTurn();
          }
        }}
      >
        <div className="flip-card__inner">
          <div className="flip-card__face flip-card__face--front" aria-hidden={flipped}>
            <span className="flip-card__label">Question</span>
            <span className="flip-card__topic">{card.topicTitle}</span>
            <p className="flip-card__text">
              <MathText text={card.front} subject={card.subjectId} />
            </p>
          </div>
          <div className="flip-card__face flip-card__face--back" aria-hidden={!flipped}>
            {revealed && (
              <>
                <span className="flip-card__label">Answer</span>
                <p className="flip-card__text">
                  <MathText text={card.back} subject={card.subjectId} />
                </p>
                {card.sourceRef && <small className="flip-card__ref">{card.sourceRef}</small>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const cardsText = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

const OUTCOME_TEXT: Record<FlashcardSessionResult['reason'], string> = {
  rewarded: '',
  too_few_cards: 'Review at least 5 cards in one session to earn 20 XP.',
  daily_limit: "You've already earned today's flashcard XP. These cards still help you remember!",
  left_early: 'Finish every due card (or 20 cards) in one go to earn 20 XP.',
};

/** Daily limit reached (F11): a calm "Done for today!", with "10 more" for keen students. */
function DoneForToday({ onMore }: { onMore: () => void }) {
  const { play } = useSound();
  useEffect(() => {
    play('celebration');
  }, [play]);
  return (
    <Card title="Done for today!" className="deck-done">
      <p>You&apos;ve reviewed today&apos;s cards. The rest will come back tomorrow, no rush.</p>
      <Button variant="secondary" onClick={onMore}>
        {EXTRA_CARDS} more
      </Button>
    </Card>
  );
}

/**
 * Reviews cards in one session (at most 20). A card rated Again comes back once before the
 * session ends. XP is paid per completed session, never per card (F3).
 */
function ReviewSession({
  cards,
  topicId,
  extra,
  onExit,
  onMore,
}: {
  cards: Flashcard[];
  /** Set when reviewing one deck: the session is complete when that deck is done. */
  topicId?: string;
  /** "10 more" cards asked for today (F11b): the session is complete when they are done. */
  extra?: number;
  onExit?: () => void;
  /** Daily limit (F11): more cards are due after today's, so the end offers "10 more". */
  onMore?: () => void;
}) {
  const api = useLearnApi();
  const { play } = useSound();
  const [session, setSession] = useState<FlashcardSession | null>(null);
  const [queue, setQueue] = useState(() => cards.slice(0, FLASHCARD_SESSION_MAX_CARDS));
  const [cameBack, setCameBack] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  /** The answer has been shown for this card: the ratings stay, however often it is turned. */
  const [revealed, setRevealed] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'start' | 'review' | 'finish' | null>(null);
  const [sooner, setSooner] = useState(0);
  const [result, setResult] = useState<FlashcardSessionResult | null>(null);

  // The "10 more" batch this session was opened for. A later "10 more" brings new cards and so a
  // new ReviewSession; this one must not restart for it (W18: that left a stray open session).
  const [batch] = useState(extra);
  const start = useCallback(async () => {
    setError(null);
    try {
      setSession(await api.startFlashcardSession(topicId, batch));
    } catch {
      setError('start');
    }
  }, [api, topicId, batch]);

  useEffect(() => {
    void start();
  }, [start]);

  async function finish(id: string) {
    setBusy(true);
    setError(null);
    try {
      const done = await api.finishFlashcardSession(id);
      if (done.xpEarned > 0) play('celebration');
      setResult(done);
    } catch {
      setError('finish');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card title={onMore ? 'Done for today!' : 'Deck done!'} className="deck-done">
        {result.xpEarned > 0 ? (
          <p className="deck-done__xp">+{result.xpEarned} XP</p>
        ) : (
          <p>{OUTCOME_TEXT[result.reason]}</p>
        )}
        <NewRewards rewards={result.newlyEarned} />
        <p>
          {sooner === 0
            ? 'No cards come back sooner.'
            : `${cardsText(sooner)} ${sooner === 1 ? 'comes' : 'come'} back sooner`}
        </p>
        {onMore && (
          <Button variant="secondary" onClick={onMore}>
            {EXTRA_CARDS} more
          </Button>
        )}
        {onExit ? (
          <Button onClick={onExit}>Back to decks</Button>
        ) : (
          <ButtonLink to="/learn">Back to learning</ButtonLink>
        )}
      </Card>
    );
  }

  if (error === 'start' || error === 'finish') {
    return (
      <Card>
        <p role="alert" className="feedback feedback--wrong">
          Couldn&apos;t save your session. Please try again.
        </p>
        <Button onClick={() => (error === 'start' ? void start() : void finish(session!.id))}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!session) {
    return (
      <p role="status" className="secondary-text">
        Getting your cards ready…
      </p>
    );
  }

  const card = queue[index]!;

  /** Turns the card either way; the first turn reveals the answer (not a new attempt). */
  function turn() {
    play('cardFlip');
    setRevealed(true);
    setFlipped((f) => !f);
  }

  async function rate(rating: FlashcardRating) {
    setBusy(true);
    setError(null);
    try {
      const reviewed = await api.reviewFlashcard(card.id, rating, session!.id);
      play('cardRated');
      if (reviewed.comesBackSooner) setSooner((s) => s + 1);
      // A card rated Again comes back once in this session (it is only counted once).
      const nextQueue =
        rating === 'again' && !cameBack.includes(card.id) ? [...queue, card] : queue;
      if (nextQueue !== queue) {
        setQueue(nextQueue);
        setCameBack((ids) => [...ids, card.id]);
      }
      setFlipped(false);
      setRevealed(false);
      setExplaining(false);
      if (index + 1 >= nextQueue.length) {
        setBusy(false);
        await finish(session!.id);
      } else {
        setIndex(index + 1);
      }
    } catch {
      setError('review');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review arena">
      <header className="deck-header">
        <span className="deck-header__subject">{subjectLabel(card.subjectId)}</span>
        <h2 className="deck-header__topic">{card.topicTitle}</h2>
      </header>
      <ArenaProgress
        label="Deck progress"
        value={index}
        max={queue.length}
        valueText={`${index} of ${cardsText(queue.length)}`}
      />
      <p className="secondary-text session-hint">
        {session.rewardedLeftToday > 0
          ? `Finish the session for ${session.xp} XP (at least ${session.minCards} cards).`
          : "You've had today's 2 rewarded sessions. Keep going: every card helps you remember."}
      </p>
      <FlipCard
        // A new element per card, so it starts on its question with no turn (F7 bug fix).
        key={`${card.id}-${index}`}
        card={card}
        flipped={flipped}
        revealed={revealed}
        onTurn={turn}
      />
      <ReadAloudButton
        text={flipped ? [card.back, card.sourceRef].filter(Boolean).join('. ') : card.front}
        label="Read the card aloud"
      />
      {error === 'review' && (
        <p role="alert" className="feedback feedback--wrong">
          Couldn&apos;t save that. Please try again.
        </p>
      )}
      {flipped && card.explain && !explaining && (
        <Button variant="secondary" onClick={() => setExplaining(true)}>
          Explain
        </Button>
      )}
      {explaining && card.explain && (
        <StepThrough
          steps={card.explain}
          label="Explain"
          renderStep={(text) => <MathText text={text} subject={card.subjectId} />}
          onClose={() => setExplaining(false)}
        >
          <LearnMore
            links={learnMoreLinks(learnLinksByTopic, {
              topicId: card.topicId,
              learningPoint: card.learningPoint,
              itemId: card.contentId,
            })}
          />
        </StepThrough>
      )}
      {revealed ? (
        <div className="ratings">
          {RATINGS.map(({ rating, label, variant }) => {
            const when = formatReviewDelay(card.nextReviewMs[rating] ?? 0);
            return (
              <Button
                key={rating}
                variant={variant}
                disabled={busy}
                onClick={() => void rate(rating)}
              >
                <span className="ratings__label">{label}</span>
                <small className="ratings__when">{when}</small>
              </Button>
            );
          })}
        </div>
      ) : (
        <Button block onClick={turn}>
          Show answer
        </Button>
      )}
    </div>
  );
}

function DecksPanel({ overview }: { overview: FlashcardsOverview }) {
  const api = useLearnApi();
  const [session, setSession] = useState<{ topicId: string; cards: Flashcard[] } | null>(null);
  const [error, setError] = useState(false);
  if (session) {
    return (
      <ReviewSession
        cards={session.cards}
        topicId={session.topicId}
        onExit={() => setSession(null)}
      />
    );
  }
  if (overview.decks.length === 0) return <p>No decks yet. They appear as you learn.</p>;
  async function open(topicId: string) {
    setError(false);
    try {
      setSession({ topicId, cards: await api.getDeck(topicId) });
    } catch {
      setError(true);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="feedback feedback--wrong">
          Couldn&apos;t open that deck. Please try again.
        </p>
      )}
      <ul className="deck-list">
        {overview.decks.map((deck) => (
          <li key={deck.topicId} className="deck-list__item">
            <div>
              <span className="deck-header__subject">{subjectLabel(deck.subjectId)}</span>
              <p className="deck-list__title">{deck.title}</p>
              <p className="secondary-text">
                {deck.due} due of {deck.total}
              </p>
            </div>
            <Button
              variant="secondary"
              aria-label={`Review ${deck.title}`}
              onClick={() => void open(deck.topicId)}
            >
              Review
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

function MyCardsPanel({ overview }: { overview: FlashcardsOverview }) {
  const api = useLearnApi();
  const [mine, setMine] = useState(overview.mine);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [topicId, setTopicId] = useState(overview.decks[0]?.topicId ?? '');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(false);
    try {
      const card = await api.createFlashcard({ topicId, front, back });
      setMine((list) => [...list, card]);
      setFront('');
      setBack('');
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const ready = front.trim() !== '' && back.trim() !== '' && topicId !== '';
  return (
    <>
      {mine.length === 0 ? (
        <p>You have not made any cards yet. Add one below.</p>
      ) : (
        <ul className="deck-list">
          {mine.map((card) => (
            <li key={card.id} className="deck-list__item">
              <div>
                <p className="deck-list__title">
                  <MathText text={card.front} subject={card.subjectId} />
                </p>
                <p className="secondary-text">
                  <MathText text={card.back} subject={card.subjectId} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Card title="Add a card">
        {overview.decks.length === 0 ? (
          <p>You can add your own cards once you have started a topic.</p>
        ) : (
          <form className="card-form" onSubmit={add}>
            <label className="field">
              <span className="field__label">Front</span>
              <input
                className="field__input"
                value={front}
                maxLength={300}
                onChange={(e) => setFront(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Back</span>
              <textarea
                className="field__input field__input--multiline"
                value={back}
                maxLength={300}
                rows={3}
                onChange={(e) => setBack(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Topic</span>
              <select
                className="field__input"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
              >
                {overview.decks.map((deck) => (
                  <option key={deck.topicId} value={deck.topicId}>
                    {deck.title}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="feedback feedback--wrong">
                Couldn&apos;t add that card. Please try again.
              </p>
            )}
            <Button type="submit" disabled={!ready || saving}>
              Add card
            </Button>
          </form>
        )}
      </Card>
    </>
  );
}

type Tab = 'due' | 'decks' | 'mine';

function FlashcardsScreen({
  overview,
  extra,
  onMore,
}: {
  overview: FlashcardsOverview;
  extra: number;
  onMore: () => void;
}) {
  const [tab, setTab] = useState<Tab>('due');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'due', label: `Due today (${overview.due.length})` },
    { id: 'decks', label: 'All decks' },
    { id: 'mine', label: 'My cards' },
  ];
  return (
    <div className="flashcards">
      {overview.draftContent && <DraftBanner />}
      <h1>Cards</h1>
      <div role="tablist" aria-label="Flashcards" className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tabs__tab${tab === t.id ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="tabs__panel"
      >
        {tab === 'due' &&
          (overview.due.length === 0 ? (
            overview.doneToday ? (
              <DoneForToday onMore={onMore} />
            ) : (
              <p>Nothing is due right now. Nice work!</p>
            )
          ) : (
            <ReviewSession
              key={overview.due.map((c) => c.id).join()}
              cards={overview.due}
              extra={extra}
              {...((overview.backlog ?? 0) > overview.due.length ? { onMore } : {})}
            />
          ))}
        {tab === 'decks' && <DecksPanel overview={overview} />}
        {tab === 'mine' && <MyCardsPanel overview={overview} />}
      </div>
    </div>
  );
}

/** The Cards tab: due cards, all decks and the student's own cards (`/cards`). */
export function FlashcardsPage() {
  const api = useLearnApi();
  // "10 more" (F11) asks for that many extra cards beyond today's limit.
  const [extra, setExtra] = useState(0);
  const overview = useApiResource(() => api.getFlashcards(extra), [api, extra]);
  if (overview.status !== 'ready') return <LoadingOrError resource={overview} />;
  return (
    <FlashcardsScreen
      overview={overview.data}
      extra={extra}
      onMore={() => setExtra((e) => e + EXTRA_CARDS)}
    />
  );
}
