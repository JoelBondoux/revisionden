// Validates content/support/uk-services.json, the data behind the Get help page
// (docs/PRODUCT_RULES.md, Get help). On top of the JSON Schema it checks that every detail's
// source is on the service's own official site, that no check is older than 4 months, and that
// phone and text numbers are in UK format with matching tel: and sms: links.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { SCHEMA_DIR } from './schemas.mjs';

export const SUPPORT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../content/support/uk-services.json',
);
export const MAX_AGE_MONTHS = 4;

let compiled;
function schemaValidator() {
  if (!compiled) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    const schema = JSON.parse(
      readFileSync(join(SCHEMA_DIR, 'support-services.schema.json'), 'utf8'),
    );
    compiled = ajv.compile(schema);
  }
  return compiled;
}

const digits = (number) => number.replace(/\s+/g, '');

/** Short UK numbers that are not 10 or 11 digits: Childline's freephone and NHS and emergency. */
const SHORT_UK_NUMBERS = new Set(['08001111', '111', '999']);

/** UK phone numbers: 10 or 11 digits starting 0, 116 helplines, and the short numbers above. */
export function isUkPhoneNumber(number) {
  const d = digits(number);
  return /^0[1-9]\d{8,9}$/.test(d) || /^116\d{3}$/.test(d) || SHORT_UK_NUMBERS.has(d);
}

/** UK text numbers: five-digit short codes or UK mobile numbers (07...). */
export function isUkTextNumber(number) {
  const d = digits(number);
  return /^\d{5}$/.test(d) || /^07\d{9}$/.test(d);
}

const dayOf = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Whole calendar months from `from` to `to` (a month counts once its day of month is reached). */
export function monthsBetween(from, to) {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function onOfficialSite(url, domains) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function serviceErrors(s, topicIds, now) {
  const errors = [];
  const add = (message) => errors.push({ id: s.id, message });
  const checkSource = (what, source) => {
    if (!onOfficialSite(source, s.official_domains))
      add(`${what}: source ${source} is not on the service's official site`);
  };

  for (const t of s.topics) if (!topicIds.has(t)) add(`unknown topic "${t}"`);
  if (s.age_range) checkSource('age range', s.age_range.source);
  if (s.area) checkSource('area', s.area.source);

  for (const c of s.contacts) {
    const what = `${c.kind} ${c.number ?? c.url}`;
    checkSource(what, c.source);
    if (c.hours) checkSource(`${what} hours`, c.hours.source);
    if (c.kind === 'phone') {
      if (!isUkPhoneNumber(c.number)) add(`${what}: phone number is not in UK format`);
      if (c.href !== `tel:${digits(c.number)}`)
        add(`${what}: link must be tel:${digits(c.number)}`);
    } else if (c.kind === 'text') {
      if (!isUkTextNumber(c.number)) add(`${what}: text number is not in UK format`);
      const expected = c.keyword
        ? `sms:${digits(c.number)}?&body=${c.keyword}`
        : `sms:${digits(c.number)}`;
      if (c.href !== expected)
        add(`${what}: link must be ${expected}${c.keyword ? ' (with the keyword)' : ''}`);
    } else if (!onOfficialSite(c.url, s.official_domains)) {
      add(`${what}: link is not on the service's official site`);
    }
  }

  const checked = new Date(`${s.checked_at}T00:00:00Z`);
  if (Number.isNaN(checked.getTime())) add(`checked_at ${s.checked_at} is not a date`);
  else if (dayOf(checked) > dayOf(now)) add(`checked_at ${s.checked_at} is in the future`);
  else if (dayOf(addMonths(checked, MAX_AGE_MONTHS)) < dayOf(now))
    add(`checked_at ${s.checked_at} is older than ${MAX_AGE_MONTHS} months: recheck every detail`);
  return errors;
}

/** Returns a list of { id, message } problems; empty when the file is valid. */
export function validateSupportServices(data, { now }) {
  const validate = schemaValidator();
  if (!validate(data)) {
    return validate.errors.map((e) => ({
      id: e.instancePath || '/',
      message: `${e.instancePath || '/'} ${e.message}${e.params?.missingProperty === 'source' ? ' (every detail needs a source URL)' : ''}`,
    }));
  }
  const errors = [];
  const topicIds = new Set(data.topics.map((t) => t.id));
  const seen = new Set();
  for (const s of data.services) {
    if (seen.has(s.id)) errors.push({ id: s.id, message: `duplicate service id "${s.id}"` });
    seen.add(s.id);
    errors.push(...serviceErrors(s, topicIds, now));
  }
  for (const t of data.topics) {
    const covered = data.services.some(
      (s) => s.topics.includes(t.id) && s.audiences.includes('student'),
    );
    if (!covered) errors.push({ id: t.id, message: `topic "${t.id}" has no student service` });
  }
  return errors;
}

/** Validates the file on disk (used by pnpm content:validate). */
export function validateSupportFile(path = SUPPORT_FILE, now = new Date()) {
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return [{ id: '/', message: `cannot read: ${e.message}` }];
  }
  return validateSupportServices(data, { now });
}
