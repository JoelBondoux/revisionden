import {
  FEATURED_POINTS,
  featuredFirst,
  parseAcceptanceSummary,
  summaryIcon,
} from './acceptanceSummary';
import { iconNames } from './NoticeIcon';
import { defaultPolicyLibrary } from './policyFiles';

const plainEnglish = [
  'This notice is for parents and carers.',
  '',
  '- **Who we are.** RevisionDen is run by the operator. You can contact us at',
  '  help@example.com.',
  '- **Students** must be in Years 9 to 13.',
  '- If the summary and the full text seem to differ, the full text is the one that counts.',
].join('\n');

describe('parseAcceptanceSummary', () => {
  it('keeps the text before the bullets as the intro', () => {
    expect(parseAcceptanceSummary(plainEnglish).intro).toBe(
      'This notice is for parents and carers.',
    );
  });

  it('turns each bullet into a card, joining its wrapped lines', () => {
    const { points } = parseAcceptanceSummary(plainEnglish);
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({
      label: 'Who we are',
      text: 'RevisionDen is run by the operator. You can contact us at help@example.com.',
    });
  });

  it('only uses a bold start ending in a full stop as the label', () => {
    const { points } = parseAcceptanceSummary(plainEnglish);
    expect(points[1]).toMatchObject({
      label: null,
      text: '**Students** must be in Years 9 to 13.',
    });
    expect(points[2]!.label).toBeNull();
  });

  it('chooses a known icon for every card', () => {
    for (const point of parseAcceptanceSummary(plainEnglish).points) {
      expect(iconNames).toContain(point.icon);
    }
    expect(summaryIcon('Your rights', 0)).toBe('scales');
    expect(summaryIcon(null, 0)).not.toBe(summaryIcon(null, 1));
  });

  it('picks icons from the label, and from the text only for strong words like AI', () => {
    const { points } = parseAcceptanceSummary(
      '- The agreement between the parent or carer and us.\n- **AI marks are a guide**, not a mark.\n',
    );
    expect(points[0]!.icon).toBe('info');
    expect(points[1]!.icon).toBe('sparkle');
  });
});

describe('the summaries a parent accepts', () => {
  it.each(['terms-of-use', 'privacy-notice'])(
    '%s: every card is word for word from its "In plain English" section',
    (name) => {
      const policy = defaultPolicyLibrary.get(name)!;
      const { points } = parseAcceptanceSummary(policy.plainEnglish);
      expect(points.length).toBeGreaterThanOrEqual(5);
      const flat = policy.plainEnglish.replace(/\s+/g, ' ');
      for (const point of points) {
        const original = point.label ? `**${point.label}.** ${point.text}` : point.text;
        expect(flat).toContain(original);
      }
    },
  );
});

describe('featuredFirst', () => {
  const points = parseAcceptanceSummary(
    [
      '- **One.** a',
      '- **Two.** b',
      '- **Three.** c',
      '- **Four.** d',
      '- **Five.** e',
      '- **Six.** f',
    ].join('\n'),
  ).points;

  it('puts the chosen points first, in the chosen order, and keeps the rest in policy order', () => {
    const { featured, rest } = featuredFirst(points, [/^Five$/, /^Two$/]);
    expect(featured.map((p) => p.label)).toEqual(['Five', 'Two', 'One', 'Three']);
    expect(rest.map((p) => p.label)).toEqual(['Four', 'Six']);
  });

  it('shows the first 4 when nothing is chosen or nothing matches', () => {
    expect(featuredFirst(points, []).featured.map((p) => p.label)).toEqual([
      'One',
      'Two',
      'Three',
      'Four',
    ]);
    expect(featuredFirst(points, [/^Nope$/]).rest).toHaveLength(2);
  });
});

describe('the 4 points shown first (product owner, 2026-11-25)', () => {
  it.each([
    [
      'terms-of-use',
      [
        'The parent is in charge',
        "It's a revision helper, not a teacher",
        'AI marks are a guide',
        'No promises about grades',
      ],
    ],
    [
      'privacy-notice',
      ['What we keep about your child', 'What we keep about you', 'AI marking', 'Your rights'],
    ],
  ])('%s: each chosen point matches exactly one card', (name, expected) => {
    const { points } = parseAcceptanceSummary(defaultPolicyLibrary.get(name)!.plainEnglish);
    for (const matcher of FEATURED_POINTS[name]!) {
      expect(
        points.filter((p) => matcher.test(p.label ?? p.text)),
        String(matcher),
      ).toHaveLength(1);
    }
    const { featured } = featuredFirst(points, FEATURED_POINTS[name]!);
    expect(featured.map((p) => p.label ?? p.text.replace(/\*\*/g, ''))).toEqual(
      expected.map((e) => expect.stringContaining(e)),
    );
  });
});
