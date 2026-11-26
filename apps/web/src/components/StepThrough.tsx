import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../features/juice';
import { Button } from './Button';
import './step-through.css';

/**
 * Steps from an item's verified content, one at a time, with Next step, Back and Close: the
 * flashcard Explain (F7) and Help me understand in lessons (F10). On a phone it scrolls into
 * view above the bottom bar on open and on each step (F7b), instantly under reduced motion.
 */
export function StepThrough({
  steps,
  label,
  onClose,
  renderStep = (text) => text,
}: {
  steps: readonly string[];
  /** The panel's name, e.g. "Explain" or "Help me understand". */
  label: string;
  onClose: () => void;
  renderStep?: (text: string) => React.ReactNode;
}) {
  const [step, setStep] = useState(0);
  const last = step === steps.length - 1;
  const panel = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [step, reduced]);
  return (
    <section ref={panel} className="explain card" aria-label={label}>
      <p className="explain__count secondary-text">
        Step {step + 1} of {steps.length}
      </p>
      <p className="explain__step" aria-live="polite">
        {renderStep(steps[step]!)}
      </p>
      <div className="explain__nav">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        {last ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button onClick={() => setStep(step + 1)}>Next step</Button>
        )}
      </div>
    </section>
  );
}
