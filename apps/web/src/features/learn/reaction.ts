/**
 * When Pip and the avatar react in a lesson (F13, for J14; docs/PRODUCT_RULES.md "Lesson
 * reactions"). F decides WHEN; J decides how each reaction looks (Pip's mood, the avatar's nod,
 * hmm or hop). No styling or timing here.
 */
export type LessonReaction = 'right' | 'wrong' | 'helped' | 'goal';

/** What a reaction handler gets: the reaction and the right answers in a row after this one. */
export interface AnswerReactionEvent {
  kind: LessonReaction;
  combo: number;
}

export function answerReaction({
  correct,
  helped = false,
  goalWasMet,
  goalMet,
}: {
  correct: boolean;
  /** Answered after "Help me understand" (F10). */
  helped?: boolean;
  /** Today's goal was already met before this answer. */
  goalWasMet: boolean;
  /** Today's goal is met after this answer. */
  goalMet: boolean;
}): LessonReaction {
  if (!correct) return 'wrong';
  if (goalMet && !goalWasMet) return 'goal';
  return helped ? 'helped' : 'right';
}
