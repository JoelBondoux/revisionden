import { listLicences } from './licences';

describe('listLicences', () => {
  it('lists each production dependency with its version and licence, sorted by name', () => {
    const packages: Record<string, { version?: string; license?: unknown }> = {
      react: { version: '18.3.1', license: 'MIT' },
      zod: { version: '3.25.76', license: 'MIT' },
      'old-style': { version: '1.0.0', license: { type: 'ISC' } },
    };
    const result = listLicences(
      {
        dependencies: {
          zod: '^3',
          react: '^18',
          'old-style': '1',
          '@revisionden/core': 'workspace:*',
        },
      },
      (name) => packages[name],
    );
    expect(result).toEqual([
      { name: 'old-style', version: '1.0.0', licence: 'ISC' },
      { name: 'react', version: '18.3.1', licence: 'MIT' },
      { name: 'zod', version: '3.25.76', licence: 'MIT' },
    ]);
  });

  it('says the licence is unknown when a package cannot be read or has none', () => {
    expect(
      listLicences({ dependencies: { a: '1', b: '1' } }, (name) => (name === 'a' ? {} : undefined)),
    ).toEqual([
      { name: 'a', version: '', licence: 'Unknown' },
      { name: 'b', version: '', licence: 'Unknown' },
    ]);
  });

  it('gives an empty list when there are no dependencies', () => {
    expect(listLicences({}, () => undefined)).toEqual([]);
  });
});
