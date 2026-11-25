import { fillPlaceholders, parsePolicy } from './policy';

const SAMPLE = `# Sample policy

Version: 1.2
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- We keep very little.
- Ask {{OPERATOR_NAME}} at {{CONTACT_EMAIL}}.

## Full text

### 1. Who we are

{{OPERATOR_NAME}}, {{POSTAL_ADDRESS}}.

## Changes

- 1.2: Clearer words.
- 1.0: First version.
`;

describe('parsePolicy', () => {
  it('reads the title, version, date and the three sections', () => {
    const policy = parsePolicy(SAMPLE);
    expect(policy.title).toBe('Sample policy');
    expect(policy.version).toBe('1.2');
    expect(policy.effectiveDate).toBe('{{EFFECTIVE_DATE}}');
    expect(policy.plainEnglish).toContain('We keep very little.');
    expect(policy.fullText).toContain('### 1. Who we are');
    expect(policy.fullText).not.toContain('Clearer words');
    expect(policy.changes).toContain('1.2: Clearer words.');
  });

  it('gives empty parts when the file leaves them out', () => {
    const policy = parsePolicy('# Only a title\n');
    expect(policy).toEqual({
      title: 'Only a title',
      version: '',
      effectiveDate: '',
      plainEnglish: '',
      fullText: '',
      changes: '',
    });
  });
});

describe('fillPlaceholders', () => {
  it('fills every placeholder from the build variables', () => {
    const text = fillPlaceholders(SAMPLE, {
      VITE_OPERATOR_NAME: 'Example Operator',
      VITE_CONTACT_EMAIL: 'help@example.com',
      VITE_POSTAL_ADDRESS: '1 Example Street',
      VITE_POLICY_EFFECTIVE_DATE: '1 January 2027',
    });
    expect(text).toContain('Ask Example Operator at help@example.com.');
    expect(text).toContain('Example Operator, 1 Example Street.');
    expect(text).toContain('Effective date: 1 January 2027');
    expect(text).not.toContain('{{');
  });

  it('fills {{SUPPORT_EMAIL}} from VITE_SUPPORT_EMAIL, or help@revisionden.com by default', () => {
    expect(fillPlaceholders('Email {{SUPPORT_EMAIL}}.', {})).toBe('Email help@revisionden.com.');
    expect(
      fillPlaceholders('Email {{SUPPORT_EMAIL}}.', { VITE_SUPPORT_EMAIL: 'x@example.com' }),
    ).toBe('Email x@example.com.');
  });

  it('says contact details are to be added when a value is missing or blank', () => {
    const text = fillPlaceholders(SAMPLE, { VITE_OPERATOR_NAME: '  ' });
    expect(text).toContain('Ask contact details to be added at contact details to be added.');
    expect(text).toContain('Effective date: date to be added');
  });
});
