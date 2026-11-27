import { useId } from 'react';
import { useParams } from 'react-router-dom';
import { pastPaperLinks, type PastPaperLink } from '@revisionden/core';
import { useApiResource } from '../../api/useApiResource';
import { LinkButton } from '../../components/links';
import { subjectLabel } from '../learn/learnApi';
import { useOnboardingApi } from '../onboarding/OnboardingApiContext';
import './past-papers.css';

/** One board's public past-paper finder, opened on the board's own site in a new tab. */
function BoardLinks({ heading, links }: { heading: string; links: PastPaperLink[] }) {
  const headingId = useId();
  if (links.length === 0) return null;
  return (
    <section className="past-papers__group" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      <ul className="past-papers__list">
        {links.map((link) => (
          <li key={link.board}>
            <LinkButton href={link.url} newTab variant="secondary" block>
              {link.name} past papers
            </LinkButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Past papers (Q7): links to each exam board's own past-paper finder, the student's board first.
 * Nothing is copied or embedded; nothing is loaded from the boards until a link is tapped.
 */
export function PastPapersPage() {
  const { subjectId = '' } = useParams();
  const api = useOnboardingApi();
  const subjects = useApiResource(() => api.getMySubjects(), [api]);
  if (subjects.status === 'loading') return null;
  const board =
    subjects.status === 'ready'
      ? subjects.data.enrolments.find((e) => e.subjectId === subjectId)?.board
      : undefined;
  const { own, others } = pastPaperLinks(subjectId, board);
  return (
    <div className="past-papers">
      <header className="page-header">
        <h1>{subjectLabel(subjectId)} past papers</h1>
      </header>
      <p>Papers and mark schemes are on the exam board's website.</p>
      <p className="past-papers__note">
        The newest papers are sometimes for teachers only, so your teacher may have more.
      </p>
      {own && <BoardLinks heading="Your exam board" links={[own]} />}
      <BoardLinks heading={own ? 'Other boards' : 'Exam boards'} links={others} />
    </div>
  );
}
