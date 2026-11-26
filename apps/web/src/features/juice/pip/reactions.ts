import { useSyncExternalStore } from 'react';
import type { AvatarReaction } from '../../avatar/motion';
import type { AnswerReactionEvent } from '../../learn/reaction';

/**
 * J14: how Pip and the avatar react to a marked answer in a lesson (F decides when, J decides how;
 * docs/PRODUCT_RULES.md "Lesson reactions"). The lesson player calls `reactToAnswer`; Pip in the
 * lesson header listens with `usePipReaction`. Kept in memory only.
 */
export type PipReaction = 'nod' | 'cheer' | 'hmm';

/** How long each reaction pose plays; matches the animations in pip.css. */
export const REACTION_POSE_MS: Record<PipReaction, number> = { nod: 900, cheer: 1200, hmm: 1400 };

/** A streak this long makes Pip cheer instead of nod. */
const CHEER_FROM = 3;

export function pipReactionFor({ kind, combo }: AnswerReactionEvent): {
  pip: PipReaction;
  avatar: AvatarReaction;
} {
  switch (kind) {
    case 'goal':
      return { pip: 'cheer', avatar: 'hop' };
    case 'wrong':
      return { pip: 'hmm', avatar: 'hmm' };
    case 'helped':
      return { pip: 'nod', avatar: 'nod' };
    case 'right':
      return { pip: combo >= CHEER_FROM ? 'cheer' : 'nod', avatar: 'nod' };
  }
}

export interface PipReactionState {
  pip: PipReaction | null;
  avatar: AvatarReaction | null;
  /** Goes up by one per answer, so the same reaction twice still plays twice. */
  key: number;
}

let current: PipReactionState = { pip: null, avatar: null, key: 0 };
const listeners = new Set<() => void>();

export function reactToAnswer(event: AnswerReactionEvent): void {
  current = { ...pipReactionFor(event), key: current.key + 1 };
  for (const listen of listeners) listen();
}

export function usePipReaction(): PipReactionState {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    () => current,
  );
}
