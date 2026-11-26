import type { ZodType } from 'zod';
import {
  FriendCodeResponseSchema,
  LeagueResponseSchema,
  ParentFriendsResponseSchema,
  RedeemFriendCodeResponseSchema,
  StudentFriendsResponseSchema,
  maskIdsInPath,
  type FriendCodeResponse,
  type LeagueResponse,
  type ParentFriendsResponse,
  type RedeemFriendCodeResponse,
  type ReportReason,
  type StudentFriendsResponse,
} from '@revisionden/core';
import { ApiError, failureRef } from '../../api/client';

export interface StudentLeagueApi {
  getLeague(): Promise<LeagueResponse>;
  getFriends(): Promise<StudentFriendsResponse>;
  makeCode(): Promise<FriendCodeResponse>;
  redeem(code: string): Promise<RedeemFriendCodeResponse>;
  confirm(requestId: string): Promise<void>;
  cancel(requestId: string): Promise<void>;
  removeFriend(friendId: string): Promise<void>;
  blockFriend(friendId: string): Promise<void>;
  reportFriend(friendId: string, reason: ReportReason): Promise<void>;
  setHidden(hidden: boolean): Promise<void>;
}

export interface ParentLeagueApi {
  getChildFriends(studentId: string): Promise<ParentFriendsResponse>;
  setAllowed(studentId: string, allowed: boolean): Promise<void>;
  approve(studentId: string, requestId: string): Promise<void>;
  decline(studentId: string, requestId: string): Promise<void>;
  parentRemove(studentId: string, friendId: string): Promise<void>;
  parentBlock(studentId: string, friendId: string): Promise<void>;
  unblock(studentId: string, blockedId: string): Promise<void>;
  setLabel(studentId: string, friendId: string, label: string | null): Promise<void>;
}

export type LeagueApi = StudentLeagueApi & ParentLeagueApi;

/** Calls the friends league routes (apps/api/src/routes/friends.ts) with the session cookies. */
export function createLeagueApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): LeagueApi {
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
  async function read<T>(schema: ZodType<T>, path: string, init?: RequestInit): Promise<T> {
    const res = await send(path, init);
    const json: unknown = await res.json().catch(() => undefined);
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
    throw new ApiError(
      'schema',
      `Unexpected response from ${path}.`,
      res.status,
      failureRef(options, res, json, 'schema'),
      undefined,
      maskIdsInPath(new URL(path, root).pathname),
    );
  }
  const act = async (path: string, method: string, body?: unknown) => {
    await send(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  };
  const e = encodeURIComponent;
  const mine = 'v1/student/friends';
  const child = (id: string) => `v1/students/${e(id)}/friends`;

  return {
    getLeague: () => read(LeagueResponseSchema, 'v1/student/league'),
    getFriends: () => read(StudentFriendsResponseSchema, mine),
    makeCode: () => read(FriendCodeResponseSchema, `${mine}/codes`, { method: 'POST', body: '{}' }),
    redeem: (code) =>
      read(RedeemFriendCodeResponseSchema, `${mine}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    confirm: (id) => act(`${mine}/requests/${e(id)}/confirm`, 'POST', {}),
    cancel: (id) => act(`${mine}/requests/${e(id)}/cancel`, 'POST', {}),
    removeFriend: (id) => act(`${mine}/${e(id)}`, 'DELETE'),
    blockFriend: (id) => act(`${mine}/${e(id)}/block`, 'POST', {}),
    reportFriend: (id, reason) => act(`${mine}/${e(id)}/report`, 'POST', { reason }),
    setHidden: (hidden) => act('v1/student/league/hidden', 'PUT', { hidden }),
    getChildFriends: (id) => read(ParentFriendsResponseSchema, child(id)),
    setAllowed: (id, allowed) => act(`${child(id)}/allowed`, 'PUT', { allowed }),
    approve: (id, rid) => act(`${child(id)}/requests/${e(rid)}/approve`, 'POST', {}),
    decline: (id, rid) => act(`${child(id)}/requests/${e(rid)}/decline`, 'POST', {}),
    parentRemove: (id, fid) => act(`${child(id)}/${e(fid)}`, 'DELETE'),
    parentBlock: (id, fid) => act(`${child(id)}/${e(fid)}/block`, 'POST', {}),
    unblock: (id, bid) => act(`${child(id)}/blocks/${e(bid)}`, 'DELETE'),
    setLabel: (id, fid, label) => act(`${child(id)}/${e(fid)}/label`, 'PUT', { label }),
  };
}
