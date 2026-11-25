import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  BOARD_LABELS,
  LEVEL_LABELS,
  NICKNAME_MESSAGES,
  TIER_LABELS,
  boardsFor,
  examSeasonFor,
  findSubject,
  levelForYear,
  subjectsForLevel,
  toCheckLaterCount,
  validateNickname,
  type BoardChoice,
  type OnboardChildRequest,
  type SubjectChoice,
  type TierChoice,
} from '@revisionden/core';
import { ErrorRef, refOf, type ErrorDetails } from '../../api/ErrorRef';
import { Button, Sheet } from '../../components';
import { AvatarBuilder } from '../avatar/AvatarBuilder';
import { AvatarSvg } from '../avatar/AvatarSvg';
import { STARTER_LOOKS, starterCode, type StarterId } from '../avatar/starters';
import { ChoiceGroup } from './ChoiceGroup';

interface AddChildFormProps {
  onSubmit: (request: OnboardChildRequest) => Promise<void>;
  onCancel: () => void;
  random?: () => number;
  today?: Date;
}

const YEARS = { gcse: [9, 10, 11], a_level: [12, 13] } as const;

function newChoice(subjectId: string): SubjectChoice {
  const boards = boardsFor(subjectId);
  return {
    subjectId,
    board: boards.length === 1 ? boards[0]! : 'not_sure',
    tier: findSubject(subjectId)?.tiered ? 'not_sure' : 'none',
  };
}

/** Add a child: nickname, avatar, school year, subjects, and a board and tier per subject. */
export function AddChildForm({
  onSubmit,
  onCancel,
  random = Math.random,
  today = new Date(),
}: AddChildFormProps) {
  const nicknameId = useId();
  const [nickname, setNickname] = useState('');
  const [look, setLook] = useState<StarterId | undefined>('neutral');
  const [avatarCode, setAvatarCode] = useState(() => starterCode('neutral'));
  const [building, setBuilding] = useState(false);
  const [yearGroup, setYearGroup] = useState<number>();
  const [subjects, setSubjects] = useState<SubjectChoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const [serverErrorRef, setServerErrorRef] = useState<ErrorDetails>();
  const [triedToContinue, setTriedToContinue] = useState(false);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLFieldSetElement>(null);

  const nicknameCheck = validateNickname(nickname);
  const nicknameError =
    nickname.length > 0 && !nicknameCheck.ok ? NICKNAME_MESSAGES[nicknameCheck.reason] : undefined;
  const level = yearGroup === undefined ? undefined : levelForYear(yearGroup);
  const exams = yearGroup === undefined ? undefined : examSeasonFor(yearGroup, today);
  const toCheck = toCheckLaterCount(subjects);
  const problems = [
    ...(nicknameCheck.ok
      ? []
      : [
          {
            field: 'nickname' as const,
            text:
              nickname.trim().length === 0
                ? "Add a nickname that isn't a real name"
                : NICKNAME_MESSAGES[nicknameCheck.reason],
          },
        ]),
    ...(yearGroup === undefined ? [{ field: 'year' as const, text: 'Choose a school year' }] : []),
  ];
  const levelSubjects = useMemo(() => (level ? subjectsForLevel(level) : []), [level]);

  const chooseYear = (year: number) => {
    if (levelForYear(year) !== level) setSubjects([]);
    setYearGroup(year);
  };

  const toggleSubject = (subjectId: string) =>
    setSubjects((current) =>
      current.some((s) => s.subjectId === subjectId)
        ? current.filter((s) => s.subjectId !== subjectId)
        : [...current, newChoice(subjectId)],
    );

  const update = (subjectId: string, change: Partial<SubjectChoice>) =>
    setSubjects((current) =>
      current.map((s) => (s.subjectId === subjectId ? { ...s, ...change } : s)),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (problems.length > 0) {
      setTriedToContinue(true);
      const first = problems[0]!.field;
      const target =
        first === 'nickname'
          ? nicknameRef.current
          : yearRef.current?.querySelector<HTMLElement>('[role="radio"]');
      target?.scrollIntoView?.({ block: 'center' });
      target?.focus();
      return;
    }
    setSaving(true);
    setServerError(undefined);
    try {
      await onSubmit({
        nickname: nicknameCheck.ok ? nicknameCheck.nickname : nickname,
        avatarCode,
        yearGroup: yearGroup!,
        subjects,
      });
    } catch (err) {
      setServerErrorRef(refOf(err));
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <form className="stack onboarding-form" onSubmit={submit} noValidate>
      <h1>Add a child</h1>

      <div className="field">
        <label htmlFor={nicknameId} className="field__label">
          Nickname
        </label>
        <input
          ref={nicknameRef}
          id={nicknameId}
          className="field__input"
          value={nickname}
          autoComplete="off"
          maxLength={20}
          aria-describedby={`${nicknameId}-help`}
          aria-invalid={nicknameError ? true : undefined}
          onChange={(e) => setNickname(e.target.value)}
        />
        <p id={`${nicknameId}-help`} className="secondary-text">
          Not their real name. Friends only ever see this.
        </p>
        {nicknameError && (
          <p role="alert" className="field__error">
            {nicknameError}
          </p>
        )}
      </div>

      <div className="onboarding-avatar">
        <AvatarSvg code={avatarCode} label={`${nickname || 'New child'}'s avatar`} size={96} />
        <div className="stack">
          <ChoiceGroup<StarterId>
            label="Starting look"
            options={STARTER_LOOKS.map((l) => ({ value: l.id, label: l.label }))}
            value={look}
            onChange={(id) => {
              setLook(id);
              setAvatarCode(starterCode(id));
            }}
          />
          <Button variant="secondary" onClick={() => setBuilding(true)}>
            Edit avatar
          </Button>
        </div>
      </div>

      <fieldset className="field" ref={yearRef}>
        <legend className="field__label">School year</legend>
        {(Object.keys(YEARS) as (keyof typeof YEARS)[]).map((lvl) => (
          <ChoiceGroup
            key={lvl}
            label={LEVEL_LABELS[lvl]}
            options={YEARS[lvl].map((y) => ({ value: y, label: `Year ${y}` }))}
            value={yearGroup}
            onChange={chooseYear}
          />
        ))}
        {exams && <p className="secondary-text">Exams in summer {exams.year}</p>}
      </fieldset>

      {level && (
        <div role="group" aria-label="Subjects" className="field">
          <span className="field__label">Subjects</span>
          <div className="chip-row">
            {levelSubjects.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                aria-pressed={subjects.some((c) => c.subjectId === s.id)}
                onClick={() => toggleSubject(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {subjects.map((choice) => {
        const subject = findSubject(choice.subjectId)!;
        return (
          <div key={choice.subjectId} className="card subject-choice">
            <h2 className="card__title">{subject.name}</h2>
            <ChoiceGroup<BoardChoice>
              label={`${subject.name} exam board`}
              showLabel={false}
              options={[...subject.boards, 'not_sure' as const].map((b) => ({
                value: b,
                label: BOARD_LABELS[b],
              }))}
              value={choice.board as BoardChoice}
              onChange={(board) => update(choice.subjectId, { board })}
            />
            {subject.tiered && (
              <ChoiceGroup<Exclude<TierChoice, 'none'>>
                label={`${subject.name} tier`}
                showLabel={false}
                options={(['foundation', 'higher', 'not_sure'] as const).map((t) => ({
                  value: t,
                  label: TIER_LABELS[t],
                }))}
                value={choice.tier as Exclude<TierChoice, 'none'>}
                onChange={(tier) => update(choice.subjectId, { tier })}
              />
            )}
          </div>
        );
      })}

      {serverError && (
        <div role="alert">
          <p className="field__error">{serverError}</p>
          <ErrorRef code={serverErrorRef} />
        </div>
      )}

      {triedToContinue && problems.length > 0 && (
        <div role="status" aria-label="Before you continue" className="continue-summary">
          <ul>
            {problems.map((p) => (
              <li key={p.field}>{p.text}</li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" block disabled={saving}>
        {toCheck > 0 ? `Continue · ${toCheck} to check later` : 'Continue'}
      </Button>
      <Button variant="secondary" block onClick={onCancel}>
        Back
      </Button>

      <Sheet open={building} title="Build an avatar" onClose={() => setBuilding(false)}>
        <AvatarBuilder
          code={avatarCode}
          nickname={nickname}
          onChange={(code) => {
            setAvatarCode(code);
            setLook(undefined);
          }}
          random={random}
        />
        <Button block onClick={() => setBuilding(false)}>
          Done
        </Button>
      </Sheet>
    </form>
  );
}
