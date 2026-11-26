/**
 * The flashcard "Explain" walk-through (workstream F7; docs/PRODUCT_RULES.md "Flashcards and
 * mastery"). Built only from the item's verified content (CLAUDE.md rule 7: no AI-made
 * explanation): its worked steps, else its inline mark scheme, then its formula and every
 * condition the formula needs, then the answer, then its verified explanation as a final "why"
 * step. No such content means no steps, and the card shows no Explain button.
 */

export interface ExplainSource {
  /** Worked maths: the model solution, one line of working per step. */
  steps?: readonly string[];
  /** The inline mark scheme, one mark point per step. */
  markScheme?: readonly string[];
  /** Maths flashcards: the back as a formula, with the conditions it needs. */
  backFormula?: { formula: string; conditions?: readonly string[] };
  /** The card's answer (its back), the last step before "why". */
  answer: string;
  /** The item's verified explanation: the final "why" step, after the answer. */
  explanation?: string;
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
  const why = source.explanation?.trim() ? [`Why: ${source.explanation.trim()}`] : [];
  if (steps.length === 0 && why.length === 0) return [];
  return [...steps, `Answer: ${source.answer}`, ...why];
}
