import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OnboardChildRequest, OnboardedChild } from '@revisionden/core';
import { Button } from '../../components';
import { SignInPrompt } from '../../api/SignInButtons';
import { AddChildForm } from './AddChildForm';
import { OnboardingApiError } from './api';
import { LinkDeviceStep } from './LinkDeviceStep';
import { useOnboardingApi } from './OnboardingApiContext';
import { FamilyListStep, FinishStep, SchoolReportStep } from './steps';
import { FamilyDataPanel } from '../family-data/FamilyDataPanel';
import './onboarding.css';

type Step =
  | { name: 'family' }
  | { name: 'add' }
  | { name: 'report'; child: OnboardedChild }
  | { name: 'link'; child: OnboardedChild }
  | { name: 'finish' };

interface OnboardingPageProps {
  now?: () => Date;
  random?: () => number;
}

/** Parent onboarding after sign-in: family list, add a child, report, link a device, finish. */
export function OnboardingPage({
  now = () => new Date(),
  random = Math.random,
}: OnboardingPageProps) {
  const api = useOnboardingApi();
  const [children, setChildren] = useState<OnboardedChild[]>();
  const [loadError, setLoadError] = useState<string>();
  const [signedOut, setSignedOut] = useState(false);
  const [step, setStep] = useState<Step>({ name: 'family' });

  // "Who's revising?" sends "Link a device" here as ?link=<student id>.
  const [params] = useSearchParams();
  const linkFor = params.get('link');

  const load = useCallback(() => {
    setLoadError(undefined);
    api.getFamily().then(
      (family) => {
        setChildren(family.children);
        const child = linkFor && family.children.find((c) => c.student.id === linkFor);
        if (child)
          setStep((current) => (current.name === 'family' ? { name: 'link', child } : current));
      },
      (err: unknown) => {
        setSignedOut(err instanceof OnboardingApiError && err.status === 401);
        setLoadError(err instanceof Error ? err.message : 'Could not load');
      },
    );
  }, [api, linkFor]);

  useEffect(load, [load]);

  const backToFamily = () => {
    setStep({ name: 'family' });
    load();
  };

  const add = async (request: OnboardChildRequest) => {
    const child = await api.addChild(request);
    setChildren((list) => [...(list ?? []), child]);
    setStep({ name: 'report', child });
  };

  if (signedOut) return <SignInPrompt />;
  if (loadError) {
    return (
      <div className="stack">
        <p role="alert" className="field__error">
          {loadError}
        </p>
        <Button onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!children) return <p aria-live="polite">Loading…</p>;

  switch (step.name) {
    case 'add':
      return (
        <AddChildForm
          onSubmit={add}
          onCancel={() => setStep({ name: 'family' })}
          random={random}
          today={now()}
        />
      );
    case 'report':
      return (
        <SchoolReportStep
          child={step.child}
          siblings={children.filter((c) => c.student.id !== step.child.student.id)}
          onNext={() => setStep({ name: 'link', child: step.child })}
        />
      );
    case 'link':
      return <LinkDeviceStep child={step.child} api={api} now={now} onDone={backToFamily} />;
    case 'finish':
      return <FinishStep children={children} />;
    default:
      return (
        <>
          <FamilyListStep
            children={children}
            onAdd={() => setStep({ name: 'add' })}
            onLink={(child) => setStep({ name: 'link', child })}
            onFinish={() => setStep({ name: 'finish' })}
          />
          <FamilyDataPanel />
        </>
      );
  }
}
