/**
 * Mock rewards API (MSW) for development and tests. Built from the real core rules; parent
 * rewards are kept in memory.
 */
import { http, HttpResponse, type RequestHandler } from 'msw';
import {
  CreateParentRewardRequestSchema,
  UpdateParentRewardRequestSchema,
  parentRewardProgress,
  parentTargetLabel,
  formatTitle,
  TitleChoiceSchema,
  type ParentReward,
  type StudentTitleResponse,
} from '@revisionden/core';
import { sampleRewards, sampleTitle } from './fixtures';

let parentRewards: ParentReward[] = [];
let title: StudentTitleResponse = sampleTitle;
export const resetRewardsMocks = () => {
  parentRewards = [];
  title = sampleTitle;
};

const view = () => sampleRewards({ parentRewards });

export const rewardsHandlers: RequestHandler[] = [
  http.get('*/v1/student/rewards', () => HttpResponse.json(view())),
  // J10b: in development, Pop Burst is unlocked and Starlight is still locked.
  http.get('*/v1/student/rewards/effect-styles', () =>
    HttpResponse.json({ unlocked: ['pop-burst'] }),
  ),
  http.get('*/v1/student/rewards/title', () => HttpResponse.json(title)),
  http.put('*/v1/student/rewards/title', async ({ request }) => {
    const parsed = TitleChoiceSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ error: { code: 'invalid' } }, { status: 400 });
    title = { ...title, ...parsed.data, title: formatTitle(parsed.data) };
    return HttpResponse.json(title);
  }),
  http.get('*/v1/students/:id/rewards', () => HttpResponse.json(view())),
  http.get('*/v1/students/:id/parent-rewards', () => HttpResponse.json({ parentRewards })),
  http.post('*/v1/students/:id/parent-rewards', async ({ request }) => {
    const parsed = CreateParentRewardRequestSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ error: { code: 'invalid' } }, { status: 400 });
    const { title, note, target } = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    const progress = parentRewardProgress(target, { level: 4, bestStreak: 5 }, [], today);
    const reward: ParentReward = {
      id: crypto.randomUUID(),
      title,
      note: note ?? null,
      target,
      targetLabel: parentTargetLabel(target),
      reached: progress.reached,
      current: progress.current,
      goal: progress.target,
      givenAt: null,
    };
    parentRewards = [...parentRewards, reward];
    return HttpResponse.json(reward, { status: 201 });
  }),
  http.post('*/v1/students/:id/parent-rewards/:rewardId/given', ({ params }) => {
    parentRewards = parentRewards.map((r) =>
      r.id === params.rewardId ? { ...r, givenAt: new Date().toISOString() } : r,
    );
    const found = parentRewards.find((r) => r.id === params.rewardId);
    return found ? HttpResponse.json(found) : HttpResponse.json({}, { status: 404 });
  }),
  http.patch('*/v1/students/:id/parent-rewards/:rewardId', async ({ request, params }) => {
    const parsed = UpdateParentRewardRequestSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ error: { code: 'invalid' } }, { status: 400 });
    const found = parentRewards.find((r) => r.id === params.rewardId);
    if (!found) return HttpResponse.json({}, { status: 404 });
    if (found.givenAt)
      return HttpResponse.json({ error: { code: 'already_given' } }, { status: 409 });
    const { title, note, target } = parsed.data;
    const nextTarget = target ?? found.target;
    const today = new Date().toISOString().slice(0, 10);
    const progress = parentRewardProgress(nextTarget, { level: 4, bestStreak: 5 }, [], today);
    const updated: ParentReward = {
      ...found,
      title: title ?? found.title,
      note: note === undefined ? found.note : note,
      target: nextTarget,
      targetLabel: parentTargetLabel(nextTarget),
      reached: progress.reached,
      current: progress.current,
      goal: progress.target,
    };
    parentRewards = parentRewards.map((r) => (r.id === updated.id ? updated : r));
    return HttpResponse.json(updated);
  }),
  http.delete('*/v1/students/:id/parent-rewards/:rewardId', ({ params }) => {
    parentRewards = parentRewards.filter((r) => r.id !== params.rewardId);
    return new HttpResponse(null, { status: 204 });
  }),
];
