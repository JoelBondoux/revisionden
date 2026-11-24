/**
 * Feedback levels: how often a student sees answers.
 * 1 = after every question, 2 = every 5 questions, 3 = end of topic, 4 = end of a full paper.
 *
 * Rules (agreed with the product owner):
 * - Move up when the average of the last 3 sets beats last summer's grade boundary for the
 *   student's target grade.
 * - Move down when that average falls below the boundary one grade under target.
 * - Boundaries are percentages of marks for the student's exam board and tier.
 */
export type FeedbackLevel = 1 | 2 | 3 | 4;

export interface FeedbackLevelInput {
  current: FeedbackLevel;
  /** Set scores as percentages, oldest first. */
  recentSetScores: number[];
  /** Grade boundary (%) for the target grade. */
  target: number;
  /** Grade boundary (%) for one grade below target. */
  oneBelowTarget: number;
}

const WINDOW = 3;

export function nextFeedbackLevel(input: FeedbackLevelInput): FeedbackLevel {
  const { current, recentSetScores, target, oneBelowTarget } = input;
  if (oneBelowTarget >= target) {
    throw new Error('Grade boundaries out of order: one below target must be lower than target');
  }
  const recent = recentSetScores.slice(-WINDOW);
  if (recent.length === 0) return current;
  const average = recent.reduce((sum, s) => sum + s, 0) / recent.length;

  if (recent.length >= WINDOW && average >= target && current < 4) {
    return (current + 1) as FeedbackLevel;
  }
  if (average < oneBelowTarget && current > 1) {
    return (current - 1) as FeedbackLevel;
  }
  return current;
}
