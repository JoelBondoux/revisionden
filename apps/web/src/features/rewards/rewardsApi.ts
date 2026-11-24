import type { ZodType } from 'zod';
import {
  ParentRewardSchema,
  StudentRewardsResponseSchema,
  type CreateParentRewardRequest,
  type ParentReward,
  type StudentRewardsResponse,
} from '@revisionden/core';

export interface RewardsApi {
  /** The signed-in student's rewards (saves anything newly earned). */
  getMyRewards(): Promise<StudentRewardsResponse>;
  /** A child's rewards, for their parent. */
  getChildRewards(studentId: string): Promise<StudentRewardsResponse>;
  addParentReward(studentId: string, body: CreateParentRewardRequest): Promise<ParentReward>;
  markGiven(studentId: string, rewardId: string): Promise<ParentReward>;
  removeParentReward(studentId: string, rewardId: string): Promise<void>;
}

/** Calls the rewards routes (apps/api/src/routes/rewards.ts) with the session cookies. */
export function createRewardsApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): RewardsApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(new URL(path, root), {
      credentials: 'include',
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new Error(`The server replied with ${res.status}.`);
    return res;
  }
  const read = async <T>(schema: ZodType<T>, path: string, init?: RequestInit) =>
    schema.parse(await (await send(path, init)).json());
  const child = (id: string) => `v1/students/${encodeURIComponent(id)}`;

  return {
    getMyRewards: () => read(StudentRewardsResponseSchema, 'v1/student/rewards'),
    getChildRewards: (id) => read(StudentRewardsResponseSchema, `${child(id)}/rewards`),
    addParentReward: (id, body) =>
      read(ParentRewardSchema, `${child(id)}/parent-rewards`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    markGiven: (id, rewardId) =>
      read(
        ParentRewardSchema,
        `${child(id)}/parent-rewards/${encodeURIComponent(rewardId)}/given`,
        {
          method: 'POST',
        },
      ),
    removeParentReward: async (id, rewardId) => {
      await send(`${child(id)}/parent-rewards/${encodeURIComponent(rewardId)}`, {
        method: 'DELETE',
      });
    },
  };
}
