import { describe, expect, it } from 'vitest';
import { SUBJECTS, type Board } from './onboarding';
import { PAST_PAPER_HOSTS, PAST_PAPER_PAGES, pastPaperLinks } from './past-papers';

describe('PAST_PAPER_PAGES', () => {
  it('has a checked page, or an explicit none, for every board of every subject we support', () => {
    for (const subject of SUBJECTS) {
      for (const board of subject.boards) {
        const entry = PAST_PAPER_PAGES[board];
        expect(entry, `${subject.id} ${board}`).toBeDefined();
        if (entry === 'none') continue;
        expect(entry.status).toBe(200);
        expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.pageTitle.length).toBeGreaterThan(0);
      }
    }
  });

  it("links only to each board's own public site over https", () => {
    for (const [board, entry] of Object.entries(PAST_PAPER_PAGES)) {
      if (entry === 'none') continue;
      const url = new URL(entry.url);
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe(PAST_PAPER_HOSTS[board as Board]);
      // A finder or search page, never a copied or embedded paper.
      expect(url.pathname).not.toMatch(/\.pdf$/i);
    }
  });
});

describe('pastPaperLinks', () => {
  it("puts the student's own board first, then the other boards that offer the subject", () => {
    const links = pastPaperLinks('gcse-maths', 'Edexcel');
    expect(links.own?.board).toBe('Edexcel');
    expect(links.others.map((l) => l.board)).toEqual(['AQA', 'OCR', 'Eduqas']);
  });

  it('shows every board as "other" when the board is not known yet', () => {
    const links = pastPaperLinks('gcse-maths', 'not_sure');
    expect(links.own).toBeUndefined();
    expect(links.others.map((l) => l.board)).toEqual(['AQA', 'Edexcel', 'OCR', 'Eduqas']);
    expect(pastPaperLinks('gcse-maths', undefined).others).toHaveLength(4);
  });

  it('leaves out boards that do not offer the subject', () => {
    expect(pastPaperLinks('gcse-film-studies', 'not_sure').others.map((l) => l.board)).toEqual([
      'Eduqas',
    ]);
    expect(pastPaperLinks('alevel-maths', 'AQA').others.map((l) => l.board)).toEqual([
      'Edexcel',
      'OCR',
    ]);
  });

  it("names each board in full and gives the board's page", () => {
    const { own } = pastPaperLinks('gcse-maths', 'Eduqas');
    expect(own?.name).toBe('WJEC Eduqas');
    expect(own?.url).toBe((PAST_PAPER_PAGES.Eduqas as { url: string }).url);
  });

  it('gives no links for a subject we do not know', () => {
    expect(pastPaperLinks('gcse-made-up', 'AQA')).toEqual({ others: [] });
  });
});
