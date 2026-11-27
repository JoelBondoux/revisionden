### What's new

- Flashcards: cards made from multiple choice questions now show their choices. Tap one to answer, and the card turns over to show if you were right. The Explain button now sits on the card itself, so the buttons below no longer jump when you reveal an answer.

### Fixed

- F20 (owner bug with screenshot): flashcards made from multiple choice questions showed the prompt ("Which of these is an equation?") with no options. Cards now carry `options` and `answerOption` (core `FlashcardSchema`, API `choicesOf`); the front shows the choices as buttons; a tap is the answer, the card turns to "Right!" or "Not quite. The answer is:", and "Next card" rates it (right Good, wrong Again). Plain recall cards keep Show answer and self-rating. The topic no longer shows twice (the card's own topic line is gone; the header has it). Guard test: every served card from a multiple choice question has its options. F21 (owner): Explain moved onto the turned-over card face (bottom corner, 44px target), and the card keeps one height (faces share a grid cell), so the rating buttons take Show answer's exact place. Tests: API `flashcards.test.ts`, web `FlashcardsPage.choices.test.tsx`, e2e `flashcard-card-face.spec.ts` at 412x915 with axe.
