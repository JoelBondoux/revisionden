/**
 * The scheduled clean-up (daily cron, see crons.ts and worker.ts): deletes data whose retention
 * period is over, as `docs/legal/data-retention.md` describes.
 */
import { and, eq, gte, inArray, lt, notExists } from 'drizzle-orm';
import {
  authSessions,
  authUsers,
  authVerifications,
  deviceLinkTokens,
  families,
  familyEvents,
  parentInvites,
  parents,
  passkeyChallenges,
  passkeyNewDeviceClaims,
  studentSessions,
  type Database,
} from '@revisionden/db';
import { deleteExpiredFeedback } from './feedback/retention';
import { deleteExpiredErrorReports } from './feedback/error-reports';
import { deleteExpiredOperatorRecords } from './operator/bridge';
import { deleteExpiredDataRequests } from './operator/data-requests';
import { deleteExpiredComplaintRequests, deleteExpiredComplaints } from './complaints/routes';
import { deleteExpiredFriendRecords } from './routes/friends';

/** Accounts nobody has used for this many months are deleted. */
export const INACTIVE_DELETE_AFTER_MONTHS = 12;
/** Family activity log rows are kept for this many months. */
export const FAMILY_EVENTS_KEPT_MONTHS = 12;
/** A parent who comes back after this many months without use sees a warning. */
export const INACTIVE_WARNING_AFTER_MONTHS = 11;

/** The same day and time, `months` calendar months before `now` (UTC). */
export function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

async function count<T>(rows: Promise<T[]>): Promise<number> {
  return (await rows).length;
}

/**
 * Deletes the given families with everything in them (foreign keys cascade), and their
 * parents' sign-in records (email, provider account id, sessions), which the family does not
 * own. Returns how many sign-in records went.
 */
export async function deleteFamilies(db: Database, familyIds: string[]): Promise<number> {
  if (familyIds.length === 0) return 0;
  const signIns = await db
    .select({ id: parents.authUserId })
    .from(parents)
    .where(inArray(parents.familyId, familyIds));
  await db.delete(families).where(inArray(families.id, familyIds));
  if (signIns.length === 0) return 0;
  return count(
    db
      .delete(authUsers)
      .where(
        inArray(
          authUsers.id,
          signIns.map((s) => s.id),
        ),
      )
      .returning({ id: authUsers.id }),
  );
}

/**
 * Deletes families nobody has used for over 12 months. Deleting a family removes its parents,
 * students and every student record with them (foreign keys cascade); the parents' sign-in
 * records (email, provider account, sessions) are deleted separately because they are not
 * owned by the family. Sign-ins that never became a family are deleted once 12 months old.
 */
export async function deleteInactiveAccounts(db: Database, now: Date) {
  const cutoff = monthsBefore(now, INACTIVE_DELETE_AFTER_MONTHS);
  const expired = await db
    .select({ id: families.id })
    .from(families)
    .where(lt(families.lastActiveAt, cutoff));
  let authUsersDeleted = await deleteFamilies(
    db,
    expired.map((f) => f.id),
  );
  authUsersDeleted += await count(
    db
      .delete(authUsers)
      .where(
        and(
          lt(authUsers.createdAt, cutoff),
          notExists(
            db.select({ id: parents.id }).from(parents).where(eq(parents.authUserId, authUsers.id)),
          ),
        ),
      )
      .returning({ id: authUsers.id }),
  );
  return { inactiveFamiliesDeleted: expired.length, authUsersDeleted };
}

/** Everything the scheduled clean-up deletes because its retention period is over. */
export async function cleanUpExpiredData({ db, now }: { db: Database; now: Date }) {
  const feedbackDeleted = await deleteExpiredFeedback(db, now);
  const errorReportsDeleted = await deleteExpiredErrorReports(db, now);
  const linkTokensDeleted = await count(
    db
      .delete(deviceLinkTokens)
      .where(
        and(
          lt(deviceLinkTokens.expiresAt, now),
          // A link redeemed just before it expired keeps its passkey set-up (up to 5 more
          // minutes); deleting it would end that set-up early.
          notExists(
            db
              .select({ id: passkeyChallenges.id })
              .from(passkeyChallenges)
              .where(
                and(
                  eq(passkeyChallenges.linkTokenId, deviceLinkTokens.id),
                  gte(passkeyChallenges.expiresAt, now),
                ),
              ),
          ),
        ),
      )
      .returning({ id: deviceLinkTokens.id }),
  );
  const studentSessionsDeleted = await count(
    db
      .delete(studentSessions)
      .where(lt(studentSessions.expiresAt, now))
      .returning({ id: studentSessions.id }),
  );
  const parentSessionsDeleted = await count(
    db
      .delete(authSessions)
      .where(lt(authSessions.expiresAt, now))
      .returning({ id: authSessions.id }),
  );
  const challengesDeleted = await count(
    db
      .delete(passkeyChallenges)
      .where(lt(passkeyChallenges.expiresAt, now))
      .returning({ id: passkeyChallenges.id }),
  );
  const verificationsDeleted = await count(
    db
      .delete(authVerifications)
      .where(lt(authVerifications.expiresAt, now))
      .returning({ id: authVerifications.id }),
  );
  const familyEventsDeleted = await count(
    db
      .delete(familyEvents)
      .where(lt(familyEvents.createdAt, monthsBefore(now, FAMILY_EVENTS_KEPT_MONTHS)))
      .returning({ id: familyEvents.id }),
  );
  const parentInvitesDeleted = await count(
    db
      .delete(parentInvites)
      .where(lt(parentInvites.expiresAt, now))
      .returning({ id: parentInvites.id }),
  );
  // A new-device claim only matters for its 24 hours (B7).
  const newDeviceClaimsDeleted = await count(
    db
      .delete(passkeyNewDeviceClaims)
      .where(lt(passkeyNewDeviceClaims.claimedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
      .returning({ id: passkeyNewDeviceClaims.credentialId }),
  );
  return {
    feedbackDeleted,
    newDeviceClaimsDeleted,
    familyEventsDeleted,
    parentInvitesDeleted,
    errorReportsDeleted,
    linkTokensDeleted,
    studentSessionsDeleted,
    parentSessionsDeleted,
    challengesDeleted,
    verificationsDeleted,
    ...(await deleteExpiredFriendRecords(db, now)),
    ...(await deleteExpiredOperatorRecords(db, now)),
    dataRequestsDeleted: await deleteExpiredDataRequests(db, now),
    complaintsDeleted: await deleteExpiredComplaints(db, now),
    complaintRequestsDeleted: await deleteExpiredComplaintRequests(db, now),
    ...(await deleteInactiveAccounts(db, now)),
  };
}
