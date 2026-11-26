/**
 * The flashcard "Explain" walk-through (workstream F7; docs/PRODUCT_RULES.md "Flashcards and
 * mastery"). Built only from the item's verified content (CLAUDE.md rule 7: no AI-made
 * explanation): its worked steps, else its inline mark scheme, then its formula and every
 * condition the formula needs, ending on the answer. No such content means no steps, and the
 * card shows no Explain button.
 */

export interface ExplainSource {
  /** Worked maths: the model solution, one line of working per step. */
  steps?: readonly string[];
  /** The inline mark scheme, one mark point per step. */
  markScheme?: readonly string[];
  /** Maths flashcards: the back as a formula, with the conditions it needs. */
  backFormula?: { formula: string; conditions?: readonly string[] };
  /** The card's answer (its back), always the last step. */
  answer: string;
}

export function explainSteps(source: ExplainSource): string[] {
  const working = source.steps?.length ? source.steps : (source.markScheme ?? []);
  const formula = source.backFormula
    ? [
        `Formula: ${source.backFormula.formula}`,
        ...(source.backFormula.conditions ?? []).map((c) => `Condition: ${c}`),
      ]
    : [];
  const steps = [...working, ...formula];
  return steps.length === 0 ? [] : [...steps, `Answer: ${source.answer}`];
}
