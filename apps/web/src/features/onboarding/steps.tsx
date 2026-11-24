import { useState } from 'react';
import { findSubject, LEVEL_LABELS, type OnboardedChild } from '@revisionden/core';
import { Avatar, Button, ButtonLink, Card, Pill } from '../../components';

const summary = (c: OnboardedChild) =>
  `Year ${c.student.yearGroup} · ${LEVEL_LABELS[c.level]} · exams ${c.examSeason.season} ${c.examSeason.year}`;

const subjectNames = (c: OnboardedChild) =>
  c.enrolments.map((e) => findSubject(e.subjectId)?.name ?? e.subjectId);

interface FamilyListProps {
  children: OnboardedChild[];
  onAdd: () => void;
  onLink: (child: OnboardedChild) => void;
  onFinish: () => void;
}

/** "Who's studying?": every child, with what is left to check and whether a device is linked. */
export function FamilyListStep({ children, onAdd, onLink, onFinish }: FamilyListProps) {
  return (
    <div className="stack">
      <h1>Who&apos;s studying?</h1>
      {children.length === 0 ? (
        <p className="secondary-text">No one yet. Add a child to get started.</p>
      ) : (
        <ul className="profile-list">
          {children.map((c) => (
            <li key={c.student.id} className="profile onboarding-child">
              <Avatar code={c.student.avatarCode} nickname={c.student.nickname} size={56} />
              <span className="profile__text">
                <span className="profile__name">{c.student.nickname}</span>
                <span className="secondary-text">{summary(c)}</span>
                <span className="secondary-text">
                  {c.enrolments.length} {c.enrolments.length === 1 ? 'subject' : 'subjects'}
                </span>
                {c.toCheckLater > 0 && <Pill tone="warning">{c.toCheckLater} to check later</Pill>}
              </span>
              {c.linkedDevices > 0 ? (
                <Pill tone="success">Device linked</Pill>
              ) : (
                <Button
                  variant="secondary"
                  aria-label={`Link a device for ${c.student.nickname}`}
                  onClick={() => onLink(c)}
                >
                  Link a device
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button block variant="secondary" onClick={onAdd}>
        Add a child
      </Button>
      <Button block disabled={children.length === 0} onClick={onFinish}>
        Finish
      </Button>
    </div>
  );
}

interface SchoolReportProps {
  child: OnboardedChild;
  siblings: OnboardedChild[];
  onNext: () => void;
}

/**
 * School report step. Nothing is stored yet: reading reports (and sharing one school's report
 * set-up between siblings) arrives in Stage 5. No school name is ever asked for here.
 */
export function SchoolReportStep({ child, siblings, onNext }: SchoolReportProps) {
  const [uploadChosen, setUploadChosen] = useState(false);
  const sibling = siblings[0];
  return (
    <div className="stack">
      <h1>School report for {child.student.nickname}</h1>
      <p>
        A school report helps set targets and effort scores. Photos are read, checked by you and
        then deleted.
      </p>
      {uploadChosen ? (
        <>
          <p className="secondary-text">
            Reading school reports is coming in a later update. We&apos;ll remind you then.
          </p>
          <Button block onClick={onNext}>
            Continue
          </Button>
        </>
      ) : (
        <>
          <Button block variant="secondary" onClick={() => setUploadChosen(true)}>
            Upload the report letter
          </Button>
          {sibling && (
            <Button block variant="secondary" onClick={onNext}>
              Same school as {sibling.student.nickname}
            </Button>
          )}
          <Button block variant="secondary" onClick={onNext}>
            Skip for now
          </Button>
        </>
      )}
    </div>
  );
}

/** Finish: what each child sees first when they open the app (the starting test intro). */
export function FinishStep({ children }: { children: OnboardedChild[] }) {
  return (
    <div className="stack">
      <h1>All set!</h1>
      {children.map((c) => {
        const names = subjectNames(c);
        return (
          <Card key={c.student.id} title={`What ${c.student.nickname} sees first`}>
            <div className="finish-child">
              <Avatar code={c.student.avatarCode} nickname={c.student.nickname} size={64} />
              <p>
                A short starting test{names.length > 0 ? ` in ${names.join(', ')}` : ''}. It finds
                what {c.student.nickname} already knows, so practice starts with weak spots.
              </p>
            </div>
          </Card>
        );
      })}
      <ButtonLink to="/family" block>
        Go to the family screen
      </ButtonLink>
    </div>
  );
}
