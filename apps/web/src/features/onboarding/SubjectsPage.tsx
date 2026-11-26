import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BOARD_LABELS,
  TIER_LABELS,
  boardsFor,
  findSubject,
  subjectsForLevel,
  type AddSubjectRequest,
  type BoardChoice,
  type OnboardedChild,
  type ParentSubject,
  type TierChoice,
  type UpdateSubjectChoiceRequest,
} from '@revisionden/core';
import { Button, Card } from '../../components';
import { BackIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { ChoiceGroup } from './ChoiceGroup';
import { useOnboardingApi } from './OnboardingApiContext';
import './onboarding.css';

type PickedTier = Exclude<TierChoice, 'none'>;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/** A new subject starts like onboarding: its only board if it has one, otherwise Not sure. */
function newChoice(subjectId: string): AddSubjectRequest {
  const boards = boardsFor(subjectId);
  return {
    subjectId,
    board: boards.length === 1 ? boards[0]! : 'not_sure',
    tier: findSubject(subjectId)?.tiered ? 'not_sure' : 'none',
  };
}

function BoardAndTier({
  name,
  subjectId,
  board,
  tier,
  onChange,
}: {
  name: string;
  subjectId: string;
  board: string;
  tier: string;
  onChange: (change: UpdateSubjectChoiceRequest) => void;
}) {
  const subject = findSubject(subjectId);
  return (
    <>
      <ChoiceGroup<BoardChoice>
        label={`${name} exam board`}
        showLabel={false}
        options={[...(subject?.boards ?? []), 'not_sure' as const].map((b) => ({
          value: b,
          label: BOARD_LABELS[b],
        }))}
        value={board as BoardChoice}
        onChange={(value) => onChange({ board: value })}
      />
      {subject?.tiered && (
        <ChoiceGroup<PickedTier>
          label={`${name} tier`}
          showLabel={false}
          options={(['foundation', 'higher', 'not_sure'] as const).map((t) => ({
            value: t,
            label: TIER_LABELS[t],
          }))}
          value={tier as PickedTier}
          onChange={(value) => onChange({ tier: value })}
        />
      )}
    </>
  );
}

function SubjectCard({
  nickname,
  subject,
  onChange,
  onRemove,
}: {
  nickname: string;
  subject: ParentSubject;
  onChange: (change: UpdateSubjectChoiceRequest) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const name = findSubject(subject.subjectId)?.name ?? subject.subjectId;
  return (
    <Card title={name} className="subject-choice">
      {!subject.hasQuestions && <p className="coming-soon-badge">Questions coming soon</p>}
      <BoardAndTier
        name={name}
        subjectId={subject.subjectId}
        board={subject.board}
        tier={subject.tier}
        onChange={onChange}
      />
      {confirming ? (
        <div className="stack">
          <p>
            {nickname}&apos;s progress in {name} is kept. It comes back if you add {name} again.
          </p>
          <Button variant="danger" onClick={onRemove}>
            Yes, remove {name}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Remove
        </Button>
      )}
    </Card>
  );
}

function AddSubject({
  child,
  taken,
  onAdd,
}: {
  child: OnboardedChild;
  taken: string[];
  /** Resolves true once the subject is added; false when it failed (the error is shown). */
  onAdd: (choice: AddSubjectRequest) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState<AddSubjectRequest>();
  const [saving, setSaving] = useState(false);
  const offered = useMemo(
    () => subjectsForLevel(child.level).filter((s) => !taken.includes(s.id)),
    [child.level, taken],
  );
  const picked = choice ? findSubject(choice.subjectId) : undefined;
  const add = async () => {
    if (!choice) return;
    setSaving(true);
    try {
      // Keep the choice when adding fails, so the parent can try again.
      if (await onAdd(choice)) setChoice(undefined);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Add a subject">
      <div role="group" aria-label="Add a subject" className="chip-row">
        {offered.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={choice?.subjectId === s.id}
            onClick={() => setChoice(newChoice(s.id))}
          >
            {s.name}
          </button>
        ))}
      </div>
      {choice && picked && (
        <div className="stack">
          <BoardAndTier
            name={picked.name}
            subjectId={choice.subjectId}
            board={choice.board}
            tier={choice.tier}
            onChange={(change) => setChoice({ ...choice, ...change } as AddSubjectRequest)}
          />
          <Button onClick={add} disabled={saving}>
            Add {picked.name}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * Parent area (E5): one child's subjects after onboarding. Either parent can add a subject (the
 * onboarding picker, Not sure allowed), change its board or tier, or remove it. Removing keeps the
 * child's progress, which comes back if the subject is added again.
 */
export function SubjectsPage() {
  const { studentId = '' } = useParams();
  const api = useOnboardingApi();
  const [child, setChild] = useState<OnboardedChild | null>();
  const [subjects, setSubjects] = useState<ParentSubject[]>([]);
  const [error, setError] = useState<string>();

  const reload = useCallback(
    async () => setSubjects(await api.getChildSubjects(studentId)),
    [api, studentId],
  );

  useEffect(() => {
    let live = true;
    api
      .getFamily()
      .then(async (family) => {
        const found = family.children.find((c) => c.student.id === studentId) ?? null;
        if (!live) return;
        setChild(found);
        if (found) await reload();
      })
      .catch((err: unknown) => {
        if (live) setError(errorText(err, 'Could not load the subjects.'));
      });
    return () => {
      live = false;
    };
  }, [api, studentId, reload]);

  /** Runs a change and reloads the list; false (with the error shown) when it failed. */
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(undefined);
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(errorText(err, 'Could not save that.'));
      return false;
    }
  };

  const back = (
    <LinkButton to="/parent" variant="quiet" icon={<BackIcon />}>
      Back to parent home
    </LinkButton>
  );

  if (child === null) {
    return (
      <div className="stack">
        <h1>Subjects</h1>
        <p>We could not find that child.</p>
        {back}
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{child ? `${child.student.nickname}'s subjects` : 'Subjects'}</h1>
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
      {child && (
        <>
          {subjects.map((s) => (
            <SubjectCard
              key={s.subjectId}
              nickname={child.student.nickname}
              subject={s}
              onChange={(change) =>
                run(() => api.updateChildSubject(studentId, s.subjectId, change))
              }
              onRemove={() => run(() => api.removeChildSubject(studentId, s.subjectId))}
            />
          ))}
          <AddSubject
            child={child}
            taken={subjects.map((s) => s.subjectId)}
            onAdd={(choice) => run(() => api.addChildSubject(studentId, choice))}
          />
        </>
      )}
      {back}
    </div>
  );
}
