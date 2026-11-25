import { describe, expect, it } from 'vitest';
import { containsPersonalData } from './routes';

const profile = {
  id: '6f1c2b0e-1111-4222-8333-944455556666',
  familyId: '0a0b0c0d-1111-4222-8333-944455556666',
  nickname: 'Thing 1',
  avatarCode: '1000000000000000000000000000',
  yearGroup: 10,
};

describe('containsPersonalData (feedback text)', () => {
  it('catches a nickname with spaces however it is written', () => {
    expect(containsPersonalData('Thing 1 found a bug on the map', [profile])).toBe(true);
    expect(containsPersonalData('thing_1 found a bug', [profile])).toBe(true);
    expect(containsPersonalData('Thing   1 found a bug', [profile])).toBe(true);
  });

  it('lets ordinary text through', () => {
    expect(containsPersonalData('The map button is hard to find', [profile])).toBe(false);
  });
});
