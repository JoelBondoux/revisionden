import { EffectStylesResponseSchema } from '@revisionden/core';
import { apiRequest } from '../../../api/client';
import { defaultBaseUrl } from '../../../api/ApiContext';

/** The effect styles the signed-in student has unlocked (GET /v1/student/rewards/effect-styles). */
export async function fetchUnlockedStyles(): Promise<readonly string[]> {
  const options = { baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) };
  const { unlocked } = await apiRequest(
    options,
    'v1/student/rewards/effect-styles',
    EffectStylesResponseSchema,
  );
  return unlocked;
}
