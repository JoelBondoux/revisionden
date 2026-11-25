import { useEffect, useState } from 'react';
import { useFamilyDataApi, type FamilyActivity, type FamilyDataApi } from './familyDataApi';

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });

/**
 * Parent area: download all the family's data, and how automatic deletion of unused accounts
 * works (with a warning for a parent who comes back after 11 months or more).
 */
export function FamilyDataPanel({ api: given }: { api?: FamilyDataApi }) {
  const fromContext = useFamilyDataApi();
  const api = given ?? fromContext;
  const [activity, setActivity] = useState<FamilyActivity>();

  useEffect(() => {
    let live = true;
    api.activity().then(
      (a) => live && setActivity(a),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  return (
    <section className="stack" aria-labelledby="family-data-heading">
      <h2 id="family-data-heading">Your family&apos;s data</h2>
      {activity?.warning && (
        <p role="alert" className="field__error">
          Nobody had used this account since {longDate(activity.warning.unusedSince)}. It would have
          been deleted on {longDate(activity.warning.wouldHaveBeenDeletedOn)}. Using it now keeps it
          for another 12 months.
        </p>
      )}
      <p className="secondary-text">
        Download everything RevisionDen holds about you and your children, as a file you can keep.
      </p>
      <a className="btn btn--secondary" href={api.exportUrl} download>
        Download your family’s data
      </a>
      {activity && (
        <p className="secondary-text">
          Accounts nobody uses for 12 months are deleted automatically. If nobody uses this one, it
          will be deleted after {longDate(activity.deletedIfUnusedAfter)}.
        </p>
      )}
    </section>
  );
}
