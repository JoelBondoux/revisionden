import { describe, expect, it } from 'vitest';
import { findPersonalData } from './privacy';

const profile = {
  id: '6f1c2b0e-1111-4222-8333-944455556666',
  familyId: '0a0b0c0d-1111-4222-8333-944455556666',
  nickname: 'pixel_fox',
  avatarCode: 'v1.0.2.3.1.0',
  yearGroup: 10,
};

describe('findPersonalData', () => {
  it('finds nothing in a request that only holds the question and answer', () => {
    const body = JSON.stringify({
      question: 'Name the organelle.',
      answer: 'The nucleus',
      marks: 10,
    });
    expect(findPersonalData(body, profile)).toEqual([]);
  });

  it('finds the nickname, in any letter case', () => {
    expect(findPersonalData('{"answer":"Pixel_Fox says mitochondria"}', profile)).toEqual([
      'nickname',
    ]);
  });

  it('finds every profile field, including ids and the avatar code', () => {
    const body = JSON.stringify({
      a: profile.id,
      b: profile.familyId,
      c: profile.avatarCode,
      d: 'Year 10',
    });
    expect(findPersonalData(body, profile).sort()).toEqual([
      'avatarCode',
      'familyId',
      'id',
      'yearGroup',
    ]);
  });

  it('finds email addresses and phone numbers whoever they belong to', () => {
    expect(findPersonalData('mail me at someone@example.com', profile)).toEqual(['email']);
    expect(findPersonalData('call 07700 900123', profile)).toEqual(['phone']);
  });

  it('matches a short nickname only as a whole word', () => {
    const short = { ...profile, nickname: 'Al' };
    expect(findPersonalData('{"answer":"It also reacts with alkalis"}', short)).toEqual([]);
    expect(findPersonalData('{"answer":"al thinks it is acid"}', short)).toEqual(['nickname']);
  });

  it('finds a nickname with spaces however the words are spaced or joined', () => {
    const spaced = { ...profile, nickname: 'Thing 1' };
    for (const body of [
      '{"answer":"Thing 1 wrote this"}',
      '{"answer":"thing  1 wrote this"}',
      '{"answer":"Thing\\n1"}',
      '{"answer":"by Thing_1"}',
    ]) {
      expect(findPersonalData(body, spaced)).toEqual(['nickname']);
    }
    expect(findPersonalData('{"answer":"Things 10"}', spaced)).toEqual([]);
  });

  it('finds an underscore nickname written with spaces', () => {
    expect(findPersonalData('{"answer":"pixel fox is here"}', profile)).toEqual(['nickname']);
  });

  it('finds a nickname that starts or ends with an underscore, written exactly', () => {
    for (const nickname of ['_Pixel', 'Pixel_', '__Owl__']) {
      const edged = { ...profile, nickname };
      expect(findPersonalData(`{"answer":"by ${nickname} today"}`, edged)).toEqual(['nickname']);
    }
  });

  it('finds an underscore-only nickname without flagging unrelated text', () => {
    const lines = { ...profile, nickname: '__' };
    expect(findPersonalData('{"answer":"x = 2"}', lines)).toEqual([]);
    expect(findPersonalData('{"answer":"by __ today"}', lines)).toEqual(['nickname']);
  });
});
