import { EffectStylesResponseSchema, type EffectStylesResponse } from '@revisionden/core';
import { apiRequest } from '../../../api/client';
import { defaultBaseUrl } from '../../../api/ApiContext';

/**
 * The effect styles the signed-in student has unlocked (GET /v1/student/rewards/effect-styles),
 * and, on the dev environment only, every style a tester may try (`testerStyles`, J12c).
 */
export async function fetchUnlockedStyles(): Promise<EffectStylesResponse> {
  const options = { baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) };
  return apiRequest(options, 'v1/student/rewards/effect-styles', EffectStylesResponseSchema);
}
