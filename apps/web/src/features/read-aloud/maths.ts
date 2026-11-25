import type { LearnItem } from '@revisionden/core';

const UNIT_WORDS: Record<string, string> = {
  mm: 'millimetres',
  cm: 'centimetres',
  m: 'metres',
  km: 'kilometres',
};

/** Rewrites, in order. Each turns written maths into words a speech voice reads sensibly. */
const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  // Square and cubic units: "28.27 cm^2" is "28.27 square centimetres".
  [
    /(^|\d\s*)(mm|cm|km|m)(\^2|²|\^3|³)(?![\w(])/g,
    (_, before: string, unit: string, power: string) =>
      `${before}${/2|²/.test(power) ? 'square' : 'cubic'} ${UNIT_WORDS[unit]}`,
  ],
  [/\^\(([^)]+)\)/g, ' to the power $1'],
  [/\^2(?!\d)|²/g, ' squared'],
  [/\^3(?!\d)|³/g, ' cubed'],
  [/\^(-?\w+)/g, ' to the power $1'],
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
  let spoken = text;
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
