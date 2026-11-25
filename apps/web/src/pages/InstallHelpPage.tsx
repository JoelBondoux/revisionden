import { useState } from 'react';
import { Card } from '../components/Card';
import { LinkButton } from '../components/links';
import { Pip } from '../components/Pip';
import { iosDevice, type IosDevice } from '../pwa/install';
import { IosSteps } from '../pwa/IosSteps';

const ALL_IOS: IosDevice[] = ['iphone', 'ipad'];
const TITLE: Record<IosDevice, string> = { iphone: 'On an iPhone', ipad: 'On an iPad' };

/**
 * How to add the app to the Home Screen (I6). iPhone and iPad Safari have no install prompt, so
 * an iPhone or iPad sees its own steps; other devices see both and the Chrome and Edge way.
 */
export function InstallHelpPage() {
  const [device] = useState(() => iosDevice(window.navigator));
  const shown = device ? [device] : ALL_IOS;
  return (
    <div className="stack">
      <Pip size={80} />
      <h1>Add RevisionDen to your Home Screen</h1>
      <p className="secondary-text">
        It then opens full screen like an app, and keeps working when the Wi-Fi drops.
      </p>
      {shown.map((d) => (
        <Card key={d} title={TITLE[d]}>
          <IosSteps device={d} />
        </Card>
      ))}
      {!device && (
        <Card title="On Android or a computer">
          <p>
            In Chrome or Edge, open the browser menu and choose <strong>Install app</strong>.
          </p>
        </Card>
      )}
      <LinkButton to="/settings" variant="secondary">
        Back to settings
      </LinkButton>
    </div>
  );
}
