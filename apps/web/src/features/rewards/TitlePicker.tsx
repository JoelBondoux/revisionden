/**
 * Two-part title picker (R8; see docs/REWARDS.md "Two-part titles"). Shows the student's title
 * under their nickname and lets them pick one first word and one last word from the words they
 * have unlocked. Curated words only; changing is free and allowed any time.
 */
import { useEffect, useState } from 'react';
import {
  isReviewedPair,
  TITLE_MESSAGES,
  type StudentTitleResponse,
  type TitleChoice,
} from '@revisionden/core';
import { Button, Card } from '../../components';

export interface TitleApi {
  getMyTitle(): Promise<StudentTitleResponse>;
  setMyTitle(choice: TitleChoice): Promise<StudentTitleResponse>;
}

export function TitlePicker({ api }: { api: TitleApi }) {
  const [view, setView] = useState<StudentTitleResponse | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [error, setError] = useState<string | null>(null);

  const show = (next: StudentTitleResponse) => {
    setView(next);
    setFirst(next.first ?? '');
    setLast(next.last ?? '');
  };

  useEffect(() => {
    let live = true;
    api
      .getMyTitle()
      .then((next) => live && show(next))
      .catch(() => live && setError("Couldn't load your title"));
    return () => {
      live = false;
    };
  }, [api]);

  if (!view) return error ? <p role="alert">{error}</p> : null;
  const none = view.words.first.length + view.words.last.length === 0;

  async function save() {
    setError(null);
    // Pairs on the manual review list are refused by the server too; say why up front.
    if (first && last && isReviewedPair(first, last)) {
      setError(TITLE_MESSAGES.reviewed);
      return;
    }
    try {
      show(await api.setMyTitle({ first: first || null, last: last || null }));
    } catch {
      setError("Couldn't save your title. Try again");
    }
  }

  return (
    <Card title="Your title" className="rewards__title">
      <p className="rewards__nickname">{view.nickname}</p>
      {view.title && <p className="rewards__title-text">{view.title}</p>}
      {none ? (
        <p className="secondary-text">
          Earn rewards to unlock title words, then build your own title from a first and a last
          word.
        </p>
      ) : (
        <form
          className="rewards__title-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            First word
            <select value={first} onChange={(e) => setFirst(e.target.value)}>
              <option value="">None</option>
              {view.words.first.map((w) => (
                <option key={w.text} value={w.text}>
                  {w.text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Last word
            <select value={last} onChange={(e) => setLast(e.target.value)}>
              <option value="">None</option>
              {view.words.last.map((w) => (
                <option key={w.text} value={w.text}>
                  {w.text}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Save title</Button>
          <p className="secondary-text">Change it whenever you like. It&apos;s free.</p>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </Card>
  );
}
