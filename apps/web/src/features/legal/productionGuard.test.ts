import { assertProductionDetails, missingProductionDetails } from './productionGuard';

const complete = {
  VITE_ENVIRONMENT: 'production',
  VITE_OPERATOR_NAME: 'Trading Name',
  VITE_CONTACT_EMAIL: 'contact@example.com',
  VITE_POLICY_EFFECTIVE_DATE: '2026-12-01',
};

describe('production build guard', () => {
  it('needs nothing more when every operator detail is set', () => {
    expect(missingProductionDetails(complete)).toEqual([]);
  });

  it('names each operator detail a production build is missing', () => {
    expect(missingProductionDetails({ VITE_ENVIRONMENT: 'production' })).toEqual([
      'VITE_OPERATOR_NAME',
      'VITE_CONTACT_EMAIL',
      'VITE_POLICY_EFFECTIVE_DATE',
    ]);
  });

  it('treats blank values as missing', () => {
    expect(missingProductionDetails({ ...complete, VITE_CONTACT_EMAIL: '  ' })).toEqual([
      'VITE_CONTACT_EMAIL',
    ]);
  });

  it.each(['development', 'staging', undefined])(
    'lets a %s build use the "to be added" fallbacks',
    (environment) => {
      expect(missingProductionDetails({ VITE_ENVIRONMENT: environment })).toEqual([]);
    },
  );

  it('stops a production build that is missing details, naming them', () => {
    expect(() => assertProductionDetails({ VITE_ENVIRONMENT: 'production' })).toThrow(
      /VITE_OPERATOR_NAME, VITE_CONTACT_EMAIL, VITE_POLICY_EFFECTIVE_DATE/,
    );
    expect(() => assertProductionDetails(complete)).not.toThrow();
  });
});
