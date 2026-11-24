import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';

/** Explains how to install the app on an iPad, which has no install prompt of its own. */
export function InstallHelpPage() {
  return (
    <div className="stack">
      <Pip size={80} />
      <h1>Add RevisionDen to your Home Screen</h1>
      <p className="secondary-text">
        It then opens full screen like an app, and keeps working when the Wi-Fi drops.
      </p>
      <Card title="On an iPad or iPhone">
        <ol className="steps" aria-label="Steps for iPad">
          <li>Open RevisionDen in Safari.</li>
          <li>
            Tap the <strong>Share</strong> button (the square with an arrow pointing up).
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Pip now lives on your Home Screen.
          </li>
        </ol>
      </Card>
      <Card title="On Android or a computer">
        <p>
          In Chrome or Edge, open the browser menu and choose <strong>Install app</strong>.
        </p>
      </Card>
      <ButtonLink to="/settings" variant="secondary">
        Back to settings
      </ButtonLink>
    </div>
  );
}
