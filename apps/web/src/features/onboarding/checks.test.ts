import { checkItems } from './checks';

const e = (subjectId: string, board: string, tier: string) =>
  ({ studentId: 's1', subjectId, board, tier }) as Parameters<typeof checkItems>[0][number];

describe('checkItems', () => {
  it('lists every board and tier left as Not sure, in plain words', () => {
    expect(
      checkItems([
        e('gcse-maths', 'not_sure', 'not_sure'),
        e('gcse-history', 'AQA', 'none'),
        e('gcse-physics', 'OCR', 'not_sure'),
      ]).map((i) => i.text),
    ).toEqual(['Maths exam board', 'Maths tier', 'Physics tier']);
  });

  it('says which subject and field each item is', () => {
    expect(checkItems([e('gcse-maths', 'not_sure', 'higher')])).toEqual([
      { subjectId: 'gcse-maths', field: 'board', text: 'Maths exam board' },
    ]);
  });

  it('uses the subject id when the subject is unknown', () => {
    expect(checkItems([e('gcse-mystery', 'not_sure', 'none')])[0]!.text).toBe(
      'gcse-mystery exam board',
    );
  });
});
