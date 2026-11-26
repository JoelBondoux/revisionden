import { pipReactionFor, REACTION_POSE_MS } from './reactions';

// J14 (agreed with F, owner approved 2026-11-26): how Pip and the avatar react to a marked
// answer. A right answer is a nod, a streak of 3 or more a cheer, today's goal a cheer and a hop,
// a helped answer a gentle nod, and a wrong one an encouraging "hmm".
describe("Pip's reaction to an answer", () => {
  it('nods at a right answer', () => {
    expect(pipReactionFor({ kind: 'right', combo: 1 })).toEqual({ pip: 'nod', avatar: 'nod' });
    expect(pipReactionFor({ kind: 'right', combo: 2 })).toEqual({ pip: 'nod', avatar: 'nod' });
  });

  it('cheers from 3 right in a row', () => {
    expect(pipReactionFor({ kind: 'right', combo: 3 })).toEqual({ pip: 'cheer', avatar: 'nod' });
  });

  it("cheers and hops for today's goal", () => {
    expect(pipReactionFor({ kind: 'goal', combo: 1 })).toEqual({ pip: 'cheer', avatar: 'hop' });
  });

  it('only nods gently after help, however long the streak', () => {
    expect(pipReactionFor({ kind: 'helped', combo: 5 })).toEqual({ pip: 'nod', avatar: 'nod' });
  });

  it('tilts his head encouragingly at a wrong answer', () => {
    expect(pipReactionFor({ kind: 'wrong', combo: 0 })).toEqual({ pip: 'hmm', avatar: 'hmm' });
  });

  it('plays each reaction for as long as its animation in pip.css', () => {
    expect(REACTION_POSE_MS).toEqual({ nod: 900, cheer: 1200, hmm: 1400 });
  });
});
