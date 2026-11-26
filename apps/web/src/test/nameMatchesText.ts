/** Lower-case words, as axe compares them (punctuation and symbols dropped). */
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * The accessible name starts with the text shown in the element, read as axe's
 * `label-content-name-mismatch` rule reads it: every text node in page order, joined with no
 * spaces (so neighbouring spans need a space between them). Voice control users then can say
 * what they see.
 */
export function nameStartsWithText(el: HTMLElement): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let shownText = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    shownText += node.textContent ?? '';
  }
  const shown = tokens(shownText);
  const name = tokens(el.getAttribute('aria-label') ?? shownText);
  return shown.length > 0 && shown.every((word, i) => name[i] === word);
}
