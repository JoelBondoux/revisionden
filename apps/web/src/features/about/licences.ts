export interface LicenceEntry {
  name: string;
  version: string;
  licence: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
}

interface DependencyPackage {
  version?: string;
  license?: unknown;
}

function licenceOf(pkg: DependencyPackage | undefined): string {
  const licence = pkg?.license;
  if (typeof licence === 'string' && licence) return licence;
  if (licence && typeof licence === 'object' && 'type' in licence) {
    return String((licence as { type: unknown }).type);
  }
  return 'Unknown';
}

/**
 * The open-source packages the web app ships (its production dependencies, not our own
 * workspace packages) with their licences. Run at build time by vite.config.ts.
 */
export function listLicences(
  pkg: PackageJson,
  readPackage: (name: string) => DependencyPackage | undefined,
): LicenceEntry[] {
  return Object.entries(pkg.dependencies ?? {})
    .filter(([, range]) => !range.startsWith('workspace:'))
    .map(([name]) => {
      const dep = readPackage(name);
      return { name, version: dep?.version ?? '', licence: licenceOf(dep) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
