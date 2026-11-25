import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BOARD_LABELS,
  TIER_LABELS,
  findSubject,
  type Board,
  type Enrolment,
  type OnboardedChild,
  type UpdateSubjectChoiceRequest,
} from '@revisionden/core';
import { Card } from '../../components';
import { checkItems, type CheckItem } from './checks';
import { ChoiceGroup } from './ChoiceGroup';
import { useOnboardingApi } from './OnboardingApiContext';
import './onboarding.css';

type Save = (subjectId: string, change: UpdateSubjectChoiceRequest) => Promise<unknown>;

/** One picker per Not sure board or tier. "Not sure" is not offered again here. */
function CheckPickers({
  items,
  labelPrefix = '',
  save,
}: {
  items: CheckItem[];
  labelPrefix?: string;
  save: Save;
}) {
  const [error, setError] = useState<string>();
  const choose = async (subjectId: string, change: UpdateSubjectChoiceRequest) => {
    setError(undefined);
    try {
      await save(subjectId, change);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    }
  };
  return (
    <>
      {items.map((item) => {
        const subject = findSubject(item.subjectId);
        const label = `${labelPrefix}${item.text}`;
        return item.field === 'board' ? (
          <ChoiceGroup<Board>
            key={label}
            label={label}
            options={(subject?.boards ?? []).map((b) => ({ value: b, label: BOARD_LABELS[b] }))}
            value={undefined}
            onChange={(board) => choose(item.subjectId, { board })}
          />
        ) : (
          <ChoiceGroup<'foundation' | 'higher'>
            key={label}
            label={label}
            options={(['foundation', 'higher'] as const).map((t) => ({
              value: t,
              label: TIER_LABELS[t],
            }))}
            value={undefined}
            onChange={(tier) => choose(item.subjectId, { tier })}
          />
        );
      })}
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
    </>
  );
}

/** Parent home: "Things to check: 3", with a picker for each Not sure board or tier. */
export function ThingsToCheckCard() {
  const api = useOnboardingApi();
  const [children, setChildren] = useState<OnboardedChild[]>([]);
  const load = useCallback(() => {
    api.getFamily().then(
      (family) => setChildren(family.children),
      () => setChildren([]),
    );
  }, [api]);
  useEffect(load, [load]);

  const withItems = children
    .map((c) => ({ child: c, items: checkItems(c.enrolments) }))
    .filter((c) => c.items.length > 0);
  const total = withItems.reduce((n, c) => n + c.items.length, 0);
  if (total === 0) return null;

  return (
    <Card title={`Things to check: ${total}`} className="things-to-check">
      <p className="secondary-text">Boards and tiers left as Not sure. Set them when you know.</p>
      {withItems.map(({ child, items }) => (
        <div key={child.student.id} className="stack">
          <h3>{child.student.nickname}</h3>
          <CheckPickers
            items={items}
            labelPrefix={`${child.student.nickname}: `}
            save={async (subjectId, change) => {
              await api.updateChildSubject(child.student.id, subjectId, change);
              load();
            }}
          />
        </div>
      ))}
    </Card>
  );
}

function useMySubjects() {
  const api = useOnboardingApi();
  const [subjects, setSubjects] = useState<{ enrolments: Enrolment[]; toCheckLater: number }>();
  const load = useCallback(() => {
    api.getMySubjects().then(setSubjects, () => setSubjects(undefined));
  }, [api]);
  useEffect(load, [load]);
  return { api, subjects, load };
}

const choiceText = (e: Enrolment) =>
  [
    e.board === 'not_sure' ? undefined : BOARD_LABELS[e.board as Board],
    e.tier === 'foundation' || e.tier === 'higher' ? TIER_LABELS[e.tier] : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

/** Student Settings > My subjects: their subjects; they can set Not sure boards and tiers. */
export function MySubjectsCard() {
  const { api, subjects, load } = useMySubjects();
  return (
    <div id="my-subjects">
      <Card title="My subjects">
        {!subjects ? (
          <p aria-live="polite">Loading…</p>
        ) : subjects.enrolments.length === 0 ? (
          <p className="secondary-text">No subjects yet. Ask a parent to add them.</p>
        ) : (
          <ul className="my-subjects">
            {subjects.enrolments.map((e) => {
              const items = checkItems([e]);
              return (
                <li key={e.subjectId} className="stack">
                  <span className="profile__name">
                    {findSubject(e.subjectId)?.name ?? e.subjectId}
                  </span>
                  {choiceText(e) && <span className="secondary-text">{choiceText(e)}</span>}
                  {items.length > 0 && (
                    <CheckPickers
                      items={items}
                      save={async (subjectId, change) => {
                        await api.updateMySubject(subjectId, change);
                        load();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Student home: a gentle nudge while any board or tier is still Not sure. */
export function SubjectsNudge() {
  const { subjects } = useMySubjects();
  const n = subjects?.toCheckLater ?? 0;
  if (n === 0) return null;
  return (
    <Link to="/settings#my-subjects" className="subjects-nudge">
      {n} {n === 1 ? 'thing' : 'things'} to check: which exam board or tier you&apos;re doing. Tap
      to set {n === 1 ? 'it' : 'them'}.
    </Link>
  );
}
