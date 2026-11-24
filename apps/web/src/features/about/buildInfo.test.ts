import { buildInfo, environmentLabel } from './buildInfo';

describe('environmentLabel', () => {
  it.each([
    ['production', 'Live'],
    ['staging', 'Staging'],
    ['development', 'Development'],
    [undefined, 'Development'],
    ['something-else', 'Development'],
  ])('%s is shown as %s', (env, label) => {
    expect(environmentLabel(env)).toBe(label);
  });
});

describe('buildInfo', () => {
  it('carries the version, build date and commit injected at build', () => {
    expect(buildInfo.version).toMatch(/^\d{2}\.\d{2}\.\d{3}$/);
    expect(buildInfo.buildDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buildInfo.commit).toMatch(/^([0-9a-f]{4,}|unknown)$/);
    expect(buildInfo.environment).toBe('Development');
    expect(buildInfo.licences.some((l) => l.name === 'react')).toBe(true);
  });
});
