import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { POLICIES } from './library';
import { defaultPolicyLibrary } from './policyFiles';

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
});
