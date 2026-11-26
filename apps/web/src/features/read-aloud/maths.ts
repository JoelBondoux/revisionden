import { parsePowers, type LearnItem, type PowerPart } from '@revisionden/core';

const UNIT_WORDS: Record<string, string> = {
  mm: 'millimetres',
  cm: 'centimetres',
  m: 'metres',
  km: 'kilometres',
};

type Rule = [RegExp, string | ((...m: string[]) => string)];

/** Square and cubic units: "28.27 cm^2" is "28.27 square centimetres". */
const UNIT_POWER: Rule = [
  /(^|\d\s*)(mm|cm|km|m)(\^2|²|\^3|³)(?![\w(])/g,
  (_, before: string, unit: string, power: string) =>
    `${before}${/2|²/.test(power) ? 'square' : 'cubic'} ${UNIT_WORDS[unit]}`,
];

/**
 * Powers written with ^ are read from the same parser the screen uses (`parsePowers`), so a
 * screen reader hears exactly the power that is shown raised (10^2.5, 10^−3, e^(x^2)).
 */
function speakPowers(parts: PowerPart[]): string {
  return parts
    .map((p) => {
      if (p.kind === 'text') return p.text;
      const only = p.parts.length === 1 && p.parts[0]!.kind === 'text' ? p.parts[0]!.text : null;
      if (only === '2') return ' squared ';
      if (only === '3') return ' cubed ';
      return ` to the power ${speakPowers(p.parts)} `;
    })
    .join('');
}

/** Rewrites, in order, after units and powers. Each turns written maths into words. */
const RULES: Rule[] = [
  [/²/g, ' squared'],
  [/³/g, ' cubed'],
  [/√\s*/g, 'the square root of '],
  [/π/g, ' pi '],
  [/\s\*\s|\*|×/g, ' times '],
  [/÷/g, ' divided by '],
  [/(\d)\s*\/\s*(\d)/g, '$1 over $2'],
  [/≤/g, ' is less than or equal to '],
  [/≥/g, ' is greater than or equal to '],
  [/</g, ' is less than '],
  [/>/g, ' is greater than '],
  [/±/g, ' plus or minus '],
  [/=/g, ' equals '],
  [/\+/g, ' plus '],
  [/\s[-−]\s/g, ' minus '],
  [/(^|[\s(])[-−](?=[\w(])/g, '$1minus '],
  [/−/g, ' minus '],
  [/°/g, ' degrees'],
];

/** Turns written maths ("x^2", "8^(2/3)", "√49", "cm^2") into words for read aloud. */
export function mathsToSpeech(text: string): string {
  let spoken = speakPowers(parsePowers(text.replace(UNIT_POWER[0], UNIT_POWER[1] as string)));
  for (const [pattern, replacement] of RULES) {
    spoken = spoken.replace(pattern, replacement as string);
  }
  return spoken
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.,!:;)])/g, '$1')
    .trim();
}

/** What read aloud says for a question: the prompt, then any options or unit. */
export function itemSpeechText(item: LearnItem): string {
  if (item.type === 'flashcard') return mathsToSpeech(item.front);
  const parts = [mathsToSpeech(item.prompt)];
  if (item.type === 'multiple_choice') {
    item.options.forEach((option, i) => parts.push(`Option ${i + 1}: ${mathsToSpeech(option)}.`));
  }
  if (item.type === 'numeric' && item.unit) parts.push(`Answer in ${mathsToSpeech(item.unit)}.`);
  return parts.join(' ');
}
