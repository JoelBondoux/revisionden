import { DEMO_CHILDREN } from '../features/stats/mocks';
import { cardsDue, family } from './data';

/* The mock API should tell one story, so screens built on it agree with each other. */
describe('mock API data', () => {
  it("has every child parent home lists in the family, so each child's links open", () => {
    const familyIds = family.children.map((c) => c.student.id);
    for (const child of DEMO_CHILDREN) expect(familyIds).toContain(child.id);
  });

  it('shows the same number on the Cards tab badge as cards due on the Cards page', async () => {
    const res = await fetch('http://localhost/v1/student/flashcards');
    const { due } = (await res.json()) as { due: unknown[] };
    expect(cardsDue.due).toBe(due.length);
  });
});
