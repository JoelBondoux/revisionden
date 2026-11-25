/**
 * Pip, the RevisionDen mascot: the angular geometric fox (mockup 6, docs/GAME_FEEL.md), drawn
 * with the same shapes and token colours as apps/web/src/components/Pip.tsx. Decorative unless
 * given a label.
 */
export type PipMood = 'happy' | 'cheer';

export const PIP_SHAPES = `<polygon points="18,52 30,8 54,36" fill="#FF7A2F"/>
<polygon points="102,52 90,8 66,36" fill="#E35F17"/>
<polygon points="27,42 31,20 45,35" fill="#3A2622"/>
<polygon points="93,42 89,20 75,35" fill="#3A2622"/>
<polygon points="18,52 54,36 60,36 60,106 32,82" fill="#FF7A2F"/>
<polygon points="60,36 66,36 102,52 88,82 60,106" fill="#E35F17"/>
<polygon points="36,74 60,64 84,74 60,106" fill="#F7F3EE"/>`;

const EYES: Record<PipMood, string> = {
  happy: `<polygon points="40,58 47,52 52,59 45,63" fill="#3A2622"/>
<polygon points="80,58 73,52 68,59 75,63" fill="#3A2622"/>`,
  cheer: `<polyline points="38,60 45,54 52,60" fill="none" stroke="#3A2622" stroke-width="4"/>
<polyline points="68,60 75,54 82,60" fill="none" stroke="#3A2622" stroke-width="4"/>`,
};

const NOSE = '<polygon points="53,90 67,90 60,98" fill="#3A2622"/>';

export function pip(size: number, mood: PipMood = 'happy', label?: string): string {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="pip" width="${size}" height="${size}" viewBox="0 0 120 120" focusable="false" ${a11y}>${PIP_SHAPES}${EYES[mood]}${NOSE}</svg>`;
}

/** Pip as a standalone SVG file (the site icon). */
export function pipIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${PIP_SHAPES}${EYES.happy}${NOSE}</svg>\n`;
}
