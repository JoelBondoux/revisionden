/**
 * Past paper links (workstream Q7, owner request 2026-11-27): each exam board's own public
 * past-paper finder, opened on the board's site. We never copy or embed a paper, and never link
 * straight to papers a board keeps for teachers (Pearson: the last 12 months; OCR: its past
 * paper policy, read 2026-11-27, keeps five years public). See docs/PRODUCT_RULES.md "Past papers".
 */
import { BOARD_LABELS, findSubject, type Board } from './onboarding';

export interface PastPaperPage {
  /** The board's public past-paper finder or search page. */
  url: string;
  /** The page's <title> as fetched. */
  pageTitle: string;
  /** The status the page answered with when checked (no redirect followed). */
  status: 200;
  /** ISO date the page was fetched and read. */
  checkedAt: string;
}

/** Each board's own host: a page link must be on it. */
export const PAST_PAPER_HOSTS: Record<Board, string> = {
  AQA: 'www.aqa.org.uk',
  Edexcel: 'qualifications.pearson.com',
  OCR: 'www.ocr.org.uk',
  Eduqas: 'www.eduqas.co.uk',
};

/**
 * One checked page per board, or 'none' if a board has no public page we can link to. Every page
 * was fetched (200, title below) and read on 2026-11-27: each is a public search for past papers
 * and mark schemes that needs no sign-in. The Eduqas URL is the "Past Papers" link on its home page.
 */
export const PAST_PAPER_PAGES: Record<Board, PastPaperPage | 'none'> = {
  AQA: {
    url: 'https://www.aqa.org.uk/find-past-papers-and-mark-schemes',
    pageTitle: 'AQA | Resources | Past Papers & AQA Mark Schemes',
    status: 200,
    checkedAt: '2026-11-27',
  },
  Edexcel: {
    url: 'https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html',
    pageTitle: 'Past papers | Past exam papers | Pearson qualifications',
    status: 200,
    checkedAt: '2026-11-27',
  },
  OCR: {
    url: 'https://www.ocr.org.uk/qualifications/past-paper-finder/',
    pageTitle: 'Past papers materials finder - Cambridge OCR',
    status: 200,
    checkedAt: '2026-11-27',
  },
  Eduqas: {
    url: 'https://www.eduqas.co.uk/home/past-papers-and-mark-schemes/',
    pageTitle: 'Past Papers and Mark Schemes',
    status: 200,
    checkedAt: '2026-11-27',
  },
};

export interface PastPaperLink {
  board: Board;
  /** The board's full name, e.g. "Pearson Edexcel". */
  name: string;
  url: string;
}

const BOARD_ORDER: readonly Board[] = ['AQA', 'Edexcel', 'OCR', 'Eduqas'];

/**
 * Past paper links for a subject: the student's own board first (when known), then the other
 * boards that offer the subject, for families who do not know their board yet.
 */
export function pastPaperLinks(
  subjectId: string,
  /** The student's board for the subject: anything else (e.g. not_sure) counts as not known. */
  board: string | undefined,
): { own?: PastPaperLink; others: PastPaperLink[] } {
  const subject = findSubject(subjectId);
  if (!subject) return { others: [] };
  const linkFor = (b: Board): PastPaperLink | undefined => {
    const page = PAST_PAPER_PAGES[b];
    return page === 'none' ? undefined : { board: b, name: BOARD_LABELS[b], url: page.url };
  };
  const offered = BOARD_ORDER.filter((b) => subject.boards.includes(b));
  const ownBoard = offered.find((b) => b === board);
  const own = ownBoard ? linkFor(ownBoard) : undefined;
  const others = offered
    .filter((b) => b !== ownBoard)
    .map(linkFor)
    .filter((l): l is PastPaperLink => Boolean(l));
  return own ? { own, others } : { others };
}
