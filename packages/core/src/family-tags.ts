/**
 * Family tags (workstream O6, `docs/OPERATOR_CONSOLE.md` "Family tags"): internal labels such as
 * "Beta tester" or "Press". Managers create, edit and retire them; Agents add and remove them on
 * a family. Tags never hold personal information. A tag's effects apply while it is on a family
 * and not retired.
 */
import { z } from 'zod';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;
const noContactDetails = (v: string) => !EMAIL.test(v) && !PHONE.test(v);
const NO_CONTACT = 'Tags never hold personal information';

export const FamilyTagEffectsSchema = z
  .object({
    /** The family sees a small "Beta" badge and can leave the programme. */
    betaProgramme: z.boolean(),
    /** Features marked as beta are turned on for the family. */
    earlyAccess: z.boolean(),
    /** Premium is free while the tag is on (workstream $). */
    complimentaryPremium: z.boolean(),
    /** Left out of the overview numbers (test and press accounts). */
    excludeFromMetrics: z.boolean(),
  })
  .strict();
export type FamilyTagEffects = z.infer<typeof FamilyTagEffectsSchema>;

/** `POST tags` and `POST tags/{id}`. */
export const FamilyTagBodySchema = z
  .object({
    name: z.string().trim().min(1).max(40).refine(noContactDetails, NO_CONTACT),
    colour: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((c) => c.toLowerCase()),
    description: z.string().trim().max(200).refine(noContactDetails, NO_CONTACT),
    effects: FamilyTagEffectsSchema,
  })
  .strict();
export type FamilyTagBody = z.infer<typeof FamilyTagBodySchema>;

export const NO_FAMILY_EFFECTS: FamilyTagEffects = {
  betaProgramme: false,
  earlyAccess: false,
  complimentaryPremium: false,
  excludeFromMetrics: false,
};

/** A family's effects: any live (not retired) tag with an effect switches it on. */
export function familyEffects(
  tags: { effects: FamilyTagEffects; retired: boolean }[],
): FamilyTagEffects {
  const live = tags.filter((t) => !t.retired);
  return {
    betaProgramme: live.some((t) => t.effects.betaProgramme),
    earlyAccess: live.some((t) => t.effects.earlyAccess),
    complimentaryPremium: live.some((t) => t.effects.complimentaryPremium),
    excludeFromMetrics: live.some((t) => t.effects.excludeFromMetrics),
  };
}
