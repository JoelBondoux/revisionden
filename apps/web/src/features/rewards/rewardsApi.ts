import { ApiError, failureRef } from '../../api/client';
import type { ZodType } from 'zod';
import {
  maskIdsInPath,
  ParentRewardSchema,
  StudentRewardsResponseSchema,
  type CreateParentRewardRequest,
  type ParentReward,
  type StudentRewardsResponse,
  type UpdateParentRewardRequest,
} from '@revisionden/core';

export interface RewardsApi {
  /** The signed-in student's rewards (saves anything newly earned). */
  getMyRewards(): Promise<StudentRewardsResponse>;
  /** A child's rewards, for their parent. */
  getChildRewards(studentId: string): Promise<StudentRewardsResponse>;
  addParentReward(studentId: string, body: CreateParentRewardRequest): Promise<ParentReward>;
  markGiven(studentId: string, rewardId: string): Promise<ParentReward>;
  removeParentReward(studentId: string, rewardId: string): Promise<void>;
  /** Changes title, note or target; only before the reward is given. */
  updateParentReward(
    studentId: string,
    rewardId: string,
    change: UpdateParentRewardRequest,
  ): Promise<ParentReward>;
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
    if (!res.ok) {
      const json: unknown = await res.json().catch(() => undefined);
      throw new ApiError(
        'http',
        `The server replied with ${res.status}.`,
        res.status,
        failureRef(options, res, json),
        undefined,
        maskIdsInPath(new URL(path, root).pathname),
      );
    }
    return res;
  }
  const read = async <T>(schema: ZodType<T>, path: string, init?: RequestInit) => {
    const res = await send(path, init);
    const json: unknown = await res.json().catch(() => undefined);
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
    const ref = failureRef(options, res, json, 'schema');
    throw new ApiError(
      'schema',
      `Unexpected response from ${path}.`,
      res.status,
      ref,
      undefined,
      maskIdsInPath(new URL(path, root).pathname),
    );
  };
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
    updateParentReward: (id, rewardId, change) =>
      read(ParentRewardSchema, `${child(id)}/parent-rewards/${encodeURIComponent(rewardId)}`, {
        method: 'PATCH',
        body: JSON.stringify(change),
      }),
    removeParentReward: async (id, rewardId) => {
      await send(`${child(id)}/parent-rewards/${encodeURIComponent(rewardId)}`, {
        method: 'DELETE',
      });
    },
  };
}
