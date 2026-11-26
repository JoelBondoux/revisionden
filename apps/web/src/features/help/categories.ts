import { helpTopics, type Audience, type HelpTopic } from './data';

/**
 * How the Get help topics are grouped on the page (W3). Presentation only: the topics, their
 * wording and every service come unchanged from content/support/uk-services.json. "Right now"
 * is always first and always open; the others are collapsible.
 */
export interface HelpCategory {
  id: string;
  title: string;
  /** Topic ids in display order. */
  topics: string[];
  /** Open when the page loads (the most common topics stay visible). */
  openByDefault: boolean;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'right-now',
    title: 'Right now',
    topics: ['emergency', 'suicidal-thoughts'],
    openByDefault: true,
  },
  {
    id: 'feelings',
    title: 'Feelings and mental health',
    topics: ['feeling-low', 'exam-stress', 'self-harm', 'eating', 'grief'],
    openByDefault: true,
  },
  {
    id: 'safe',
    title: 'Staying safe',
    topics: ['abuse', 'online-safety', 'crime'],
    openByDefault: false,
  },
  {
    id: 'home-school-friends',
    title: 'Home, school and friends',
    topics: ['bullying', 'lgbtq', 'young-carers'],
    openByDefault: false,
  },
  {
    id: 'body-health',
    title: 'Body and health',
    topics: ['health', 'sexual-health', 'drugs-alcohol'],
    openByDefault: false,
  },
];

export interface ResolvedCategory extends Omit<HelpCategory, 'topics'> {
  topics: HelpTopic[];
}

/** The categories with the topics this audience has services for, in display order. */
export function categoriesFor(audience: Audience): ResolvedCategory[] {
  const available = new Map(helpTopics(audience).map((t) => [t.id, t]));
  return HELP_CATEGORIES.map((c) => ({
    ...c,
    topics: c.topics.flatMap((id) => (available.has(id) ? [available.get(id)!] : [])),
  })).filter((c) => c.topics.length > 0);
}
