import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORT_FILE,
  isUkPhoneNumber,
  isUkTextNumber,
  monthsBetween,
  validateSupportServices,
} from './support.mjs';

const NOW = new Date('2026-11-25T12:00:00Z');
const SOURCE = 'https://www.example-helpline.org.uk/contact/';

function service(overrides = {}) {
  return {
    id: 'example-helpline',
    service: 'Example helpline',
    audiences: ['student'],
    topics: ['feeling-low'],
    helps_with: 'Someone to talk to.',
    official_domains: ['example-helpline.org.uk'],
    contacts: [
      {
        kind: 'phone',
        number: '0800 1111',
        href: 'tel:08001111',
        hours: { text: '24 hours a day', source: SOURCE },
        source: SOURCE,
      },
    ],
    checked_at: '2026-11-25',
    ...overrides,
  };
}

function file(services = [service()], topics) {
  return {
    about: 'Test data.',
    topics: topics ?? [{ id: 'feeling-low', title: 'Feeling low', intro: 'Talk.', urgent: false }],
    services,
  };
}

const messages = (data) => validateSupportServices(data, { now: NOW }).map((e) => e.message);

test('a complete, recently checked entry is valid', () => {
  assert.deepEqual(messages(file()), []);
});

test('a contact detail without a source URL fails', () => {
  const contact = { kind: 'phone', number: '0800 1111', href: 'tel:08001111' };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /source/.test(m)));
});

test('opening hours without a source URL fail', () => {
  const contact = { ...service().contacts[0], hours: { text: '24 hours a day' } };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /source/.test(m)));
});

test('an age range without a source URL fails', () => {
  const errors = messages(file([service({ age_range: { text: 'Under 19' } })]));
  assert.ok(errors.some((m) => /source/.test(m)));
});

test("a source on another site than the service's own fails", () => {
  const contact = { ...service().contacts[0], source: 'https://www.somewhere-else.org/' };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /official/.test(m)));
});

test('a source on a subdomain of the official site is accepted', () => {
  const contact = { ...service().contacts[0], source: 'https://help.example-helpline.org.uk/a' };
  assert.deepEqual(messages(file([service({ contacts: [contact] })])), []);
});

test('a source that is not https fails', () => {
  const contact = { ...service().contacts[0], source: 'http://www.example-helpline.org.uk/' };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.length > 0);
});

test('a check older than 4 months fails', () => {
  const errors = messages(file([service({ checked_at: '2026-07-24' })]));
  assert.ok(errors.some((m) => /older than 4 months/.test(m)));
});

test('a check exactly 4 months old is still accepted', () => {
  assert.deepEqual(messages(file([service({ checked_at: '2026-07-25' })])), []);
});

test('a check dated in the future fails', () => {
  const errors = messages(file([service({ checked_at: '2026-12-01' })]));
  assert.ok(errors.some((m) => /future/.test(m)));
});

test('a phone number that is not in UK format fails', () => {
  const contact = { ...service().contacts[0], number: '+1 800 273 8255', href: 'tel:+18002738255' };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /UK format/.test(m)));
});

test('a tel: link that does not match the number fails', () => {
  const contact = { ...service().contacts[0], href: 'tel:08001112' };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /tel:/.test(m)));
});

test('a text number with a keyword needs an sms: link carrying that keyword', () => {
  const contact = {
    kind: 'text',
    number: '85258',
    keyword: 'SHOUT',
    href: 'sms:85258',
    source: SOURCE,
  };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /keyword/.test(m)));
});

test('a text contact with a matching sms: link is valid', () => {
  const contact = {
    kind: 'text',
    number: '85258',
    keyword: 'SHOUT',
    href: 'sms:85258?&body=SHOUT',
    source: SOURCE,
  };
  assert.deepEqual(messages(file([service({ contacts: [contact] })])), []);
});

test('a web chat or website link must be on the official site', () => {
  const contact = { kind: 'website', url: 'https://www.elsewhere.com/', source: SOURCE };
  const errors = messages(file([service({ contacts: [contact] })]));
  assert.ok(errors.some((m) => /official/.test(m)));
});

test('a service listing an unknown topic fails', () => {
  const errors = messages(file([service({ topics: ['made-up'] })]));
  assert.ok(errors.some((m) => /made-up/.test(m)));
});

test('a topic with no student service fails', () => {
  const topics = [
    { id: 'feeling-low', title: 'Feeling low', intro: 'Talk.', urgent: false },
    { id: 'grief', title: 'Grief', intro: 'Talk.', urgent: false },
  ];
  const errors = messages(file([service()], topics));
  assert.ok(errors.some((m) => /grief/.test(m)));
});

test('duplicate service ids fail', () => {
  const errors = messages(file([service(), service()]));
  assert.ok(errors.some((m) => /duplicate/i.test(m)));
});

test('UK phone numbers: freephone, 03, 116 and short emergency numbers', () => {
  for (const n of ['0800 1111', '0808 800 5000', '0300 123 6600', '116 123', '111', '999']) {
    assert.equal(isUkPhoneNumber(n), true, n);
  }
  for (const n of ['+1 800 273 8255', '12345', '0800 11', '01234 567 8901 2', '911']) {
    assert.equal(isUkPhoneNumber(n), false, n);
  }
});

test('UK text numbers: five-digit short codes and UK mobiles', () => {
  assert.equal(isUkTextNumber('85258'), true);
  assert.equal(isUkTextNumber('07700 900123'), true);
  assert.equal(isUkTextNumber('+44 7700 900123'), false);
  assert.equal(isUkTextNumber('1234'), false);
});

test('months between two dates counts whole calendar months', () => {
  assert.equal(monthsBetween(new Date('2026-07-25'), NOW), 4);
  assert.equal(monthsBetween(new Date('2026-07-26'), NOW), 3);
  assert.equal(monthsBetween(new Date('2026-07-24'), NOW), 4);
});

test('the real support services file is valid and checked within the last 4 months', () => {
  // Uses today's date on purpose: CI fails once any entry is due for its termly recheck.
  const here = dirname(fileURLToPath(import.meta.url));
  assert.equal(SUPPORT_FILE, join(here, '../../content/support/uk-services.json'));
  const data = JSON.parse(readFileSync(SUPPORT_FILE, 'utf8'));
  assert.deepEqual(validateSupportServices(data, { now: new Date() }), []);
});

test('the real file has the services the page needs', () => {
  const data = JSON.parse(readFileSync(SUPPORT_FILE, 'utf8'));
  const ids = data.services.map((s) => s.id);
  for (const id of ['emergency-999', 'childline', 'report-remove', 'nspcc-helpline', 'nhs-111']) {
    assert.ok(ids.includes(id), id);
  }
  const nspcc = data.services.find((s) => s.id === 'nspcc-helpline');
  assert.deepEqual(nspcc.audiences, ['parent']);
});
