import { useEffect, useRef, useState } from 'react';
import { helpButton, type LearnItem } from '@revisionden/core';
import { Button } from '../../components/Button';
import { MathText } from '../../components/MathText';
import { StepThrough } from '../../components/StepThrough';
import { useLearnApi } from './learnApi';

/**
 * "Need a clue?" then "Help me understand" (F10, owner 2026-11-26). The clue is the item's
 * verified hint, with no penalty. Help steps through its verified worked solution; after it the
 * student still answers, and the answer counts as helped (half XP, practised like a miss). Both
 * open in place under the question, so the answer box and Check stay on screen.
 */
export function HelpPanel({
  item,
  disabled,
  onHelped,
}: {
  item: LearnItem;
  disabled: boolean;
  onHelped: () => void;
}) {
  const api = useLearnApi();
  const [clueShown, setClueShown] = useState(false);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const next = helpButton(item, clueShown);
  // Help that arrives after the pupil has moved on belongs to the question they left: it must
  // never mark the next question as helped (Codex review on #303).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function help() {
    setFailed(false);
    try {
      const fetched = steps ?? (await api.getItemHelp(item.id));
      if (!mounted.current) return;
      setSteps(fetched);
      setOpen(true);
      onHelped();
    } catch {
      if (mounted.current) setFailed(true);
    }
  }

  return (
    <div className="help-panel">
      {clueShown && item.hint && (
        <p className="help-panel__clue">
          <strong>Clue:</strong> <MathText text={item.hint} subject={item.topicId} />
        </p>
      )}
      {open && steps && (
        <StepThrough
          steps={steps}
          label="Help me understand"
          renderStep={(text) => <MathText text={text} subject={item.topicId} />}
          onClose={() => setOpen(false)}
        />
      )}
      {failed && (
        <p role="alert" className="feedback feedback--wrong">
          Couldn&apos;t load the help. Please try again.
        </p>
      )}
      {!disabled && !open && next === 'clue' && (
        <Button variant="secondary" onClick={() => setClueShown(true)}>
          Need a clue?
        </Button>
      )}
      {!disabled && !open && next === 'help' && (
        <Button variant="secondary" onClick={() => void help()}>
          Help me understand
        </Button>
      )}
    </div>
  );
}
