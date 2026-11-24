/**
 * Mock rewards API (MSW) for development and tests. Built from the real core rules; parent
 * rewards are kept in memory.
 */
import { http, HttpResponse, type RequestHandler } from 'msw';
import {
  CreateParentRewardRequestSchema,
  parentRewardProgress,
  parentTargetLabel,
  type ParentReward,
} from '@revisionden/core';
import { sampleRewards } from './fixtures';

let parentRewards: ParentReward[] = [];
export const resetRewardsMocks = () => {
  parentRewards = [];
};

const view = () => sampleRewards({ parentRewards });

export const rewardsHandlers: RequestHandler[] = [
  http.get('*/v1/student/rewards', () => HttpResponse.json(view())),
  http.get('*/v1/students/:id/rewards', () => HttpResponse.json(view())),
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
  http.delete('*/v1/students/:id/parent-rewards/:rewardId', ({ params }) => {
    parentRewards = parentRewards.filter((r) => r.id !== params.rewardId);
    return new HttpResponse(null, { status: 204 });
  }),
];
