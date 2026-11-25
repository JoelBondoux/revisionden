import { useState, type FormEvent } from 'react';
import { formatReviewDelay, type Flashcard, type FlashcardsOverview } from '@revisionden/core';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { ArenaProgress } from '../juice';
import { subjectLabel, useLearnApi, type FlashcardRating } from '../learn/learnApi';
import { DraftBanner } from '../learn/parts';
import { useSound } from '../sound';
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

/** A card that turns over in 3D (no animation when reduced motion is asked for). */
function FlipCard({ card, flipped }: { card: Flashcard; flipped: boolean }) {
  return (
    <div className={`flip-card${flipped ? ' flip-card--flipped' : ''}`} data-testid="flip-card">
      <div className="flip-card__inner">
        <div className="flip-card__face flip-card__face--front" aria-hidden={flipped}>
          <span className="flip-card__label">Question</span>
          <span className="flip-card__topic">{card.topicTitle}</span>
          <p className="flip-card__text">{card.front}</p>
        </div>
        <div className="flip-card__face flip-card__face--back" aria-hidden={!flipped}>
          <span className="flip-card__label">Answer</span>
          <p className="flip-card__text">{card.back}</p>
          {card.sourceRef && <small className="flip-card__ref">{card.sourceRef}</small>}
        </div>
      </div>
    </div>
  );
}

const cardsText = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

/** Reviews a list of cards one by one, then shows the deck-done summary. */
function ReviewSession({ cards, onExit }: { cards: Flashcard[]; onExit?: () => void }) {
  const api = useLearnApi();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [xp, setXp] = useState(0);
  const [sooner, setSooner] = useState(0);

  if (index >= cards.length) {
    return (
      <Card title="Deck done!" className="deck-done">
        <p className="deck-done__xp">+{xp} XP</p>
        <p>
          {sooner === 0
            ? 'No cards come back sooner.'
            : `${cardsText(sooner)} ${sooner === 1 ? 'comes' : 'come'} back sooner`}
        </p>
        {onExit ? (
          <Button onClick={onExit}>Back to decks</Button>
        ) : (
          <ButtonLink to="/learn">Back to learning</ButtonLink>
        )}
      </Card>
    );
  }

  const card = cards[index]!;

  async function rate(rating: FlashcardRating) {
    setBusy(true);
    setError(false);
    try {
      const result = await api.reviewFlashcard(card.id, rating);
      play('cardRated');
      setXp((x) => x + result.xpEarned);
      if (result.comesBackSooner) setSooner((s) => s + 1);
      setIndex((i) => i + 1);
      setFlipped(false);
    } catch {
      setError(true);
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
        max={cards.length}
        valueText={`${index} of ${cardsText(cards.length)}`}
      />
      <FlipCard card={card} flipped={flipped} />
      {error && (
        <p role="alert" className="feedback feedback--wrong">
          Couldn&apos;t save that. Please try again.
        </p>
      )}
      {flipped ? (
        <div className="ratings">
          {RATINGS.map(({ rating, label, variant }) => {
            const when = formatReviewDelay(card.nextReviewMs[rating] ?? 0);
            return (
              <Button
                key={rating}
                variant={variant}
                disabled={busy}
                aria-label={`${label}, back in ${when}`}
                onClick={() => void rate(rating)}
              >
                <span className="ratings__label">{label}</span>
                <small className="ratings__when">{when}</small>
              </Button>
            );
          })}
        </div>
      ) : (
        <Button block onClick={() => (play('cardFlip'), setFlipped(true))}>
          Show answer
        </Button>
      )}
    </div>
  );
}

function DecksPanel({ overview }: { overview: FlashcardsOverview }) {
  const api = useLearnApi();
  const [session, setSession] = useState<Flashcard[] | null>(null);
  const [error, setError] = useState(false);
  if (session) return <ReviewSession cards={session} onExit={() => setSession(null)} />;
  if (overview.decks.length === 0) return <p>No decks yet. They appear as you learn.</p>;
  async function open(topicId: string) {
    setError(false);
    try {
      setSession(await api.getDeck(topicId));
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
                <p className="deck-list__title">{card.front}</p>
                <p className="secondary-text">{card.back}</p>
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

function FlashcardsScreen({ overview }: { overview: FlashcardsOverview }) {
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
            <p>Nothing is due right now. Nice work!</p>
          ) : (
            <ReviewSession cards={overview.due} />
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
  const overview = useApiResource(() => api.getFlashcards(), [api]);
  if (overview.status !== 'ready') return <LoadingOrError resource={overview} />;
  return <FlashcardsScreen overview={overview.data} />;
}
