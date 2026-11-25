import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { POLICIES } from './library';
import { defaultPolicyLibrary } from './policyFiles';
import { parseFriendlyNotice } from './friendlyNotice';
import { iconNames } from './NoticeIcon';

describe('the policies built into the app', () => {
  it.each(POLICIES.map((p) => p.name))('%s has a title, version and all three sections', (name) => {
    const policy = defaultPolicyLibrary.get(name);
    expect(policy?.title).toBeTruthy();
    expect(policy?.version).toMatch(/^\d+\.\d+$/);
    expect(policy?.plainEnglish).toBeTruthy();
    expect(policy?.fullText).toBeTruthy();
    expect(policy?.changes).toBeTruthy();
  });

  it('opens a policy without signing in, with no placeholders left', async () => {
    const { container } = renderRoute('/legal/privacy-notice', { studentId: null });
    expect(await screen.findByRole('heading', { name: 'Read the full text' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{');
  });

  it("gives the young people's notice 5 or 6 short-version cards and 2 to 4 key points per part", () => {
    const notice = parseFriendlyNotice(defaultPolicyLibrary.get('privacy-for-young-people')!);
    expect(notice.shortVersion.length).toBeGreaterThanOrEqual(5);
    expect(notice.shortVersion.length).toBeLessThanOrEqual(6);
    for (const section of notice.sections) {
      expect(section.keyPoints.length, section.title).toBeGreaterThanOrEqual(2);
      expect(section.keyPoints.length, section.title).toBeLessThanOrEqual(4);
    }
    const used = [...notice.shortVersion.map((c) => c.icon), ...notice.sections.map((s) => s.icon)];
    for (const icon of used) expect(iconNames, icon).toContain(icon);
  });

  it("shows the young people's notice as cards and expandable parts", async () => {
    const { container } = renderRoute('/legal/privacy-for-young-people', { studentId: null });
    expect(await screen.findByRole('list', { name: 'The short version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{');
    expect(container.textContent).not.toContain('icon:');
  });
});
