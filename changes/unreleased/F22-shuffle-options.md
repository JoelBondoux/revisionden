### What's new

- Multiple choice answers now come in a different order each time, so the right answer isn't always the first one.

### Fixed

- F22 (marking fairness, found by Codex on S4's content): the right answer was option 1 in nearly every multiple choice item (Statistics 17/17, Probability 16/16, Geometry 54/60), and options showed in stored order. They are now shuffled each serve (`shuffledOptionOrder` in core, with injected randomness; `useOptionOrder` in the web), with "None of these"-type options kept last, in lessons, the starting test, the 5-a-day and recall checks. Marking goes by the option's original position, so attempts and the right-answer highlight line up. Tests: core `option-order.test.ts` (2,000 serves: the first option comes first about a quarter of the time), web `parts.shuffle.test.tsx`.
