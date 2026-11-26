import { useEffect, useId, type CSSProperties } from 'react';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { Card } from '../../../components/Card';
import './picker.css';
import { useStudent } from '../../../session/StudentContext';
import { useEffectStyle, type StyleTester } from './EffectStyleProvider';
import { COMING_SOON_STYLES, EFFECT_STYLES, EFFECT_STYLE_IDS } from './registry';

const swatchVars = (swatch: readonly [string, string, string]) =>
  ({ '--swatch-0': swatch[0], '--swatch-1': swatch[1], '--swatch-2': swatch[2] }) as CSSProperties;

/**
 * Dev environment only (J12c): try any style and theme at once, to check them all. It unlocks
 * nothing, grants no reward and records no achievement; Reset goes back to the real choice.
 */
function StyleTesterSection({ tester }: { tester: StyleTester }) {
  const headingId = useId();
  const { settings, update } = useAppearance();
  return (
    <div className="style-tester" role="group" aria-labelledby={headingId}>
      <h3 id={headingId} className="style-tester__title">
        Tester: try any style
      </h3>
      <p className="style-tester__note">Dev only: doesn&apos;t unlock anything for real.</p>
      <div className="style-tester__row">
        {tester.styles.map((id) => (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={tester.trying === id}
            onClick={() => tester.tryStyle(id)}
          >
            {EFFECT_STYLES[id].name}
          </button>
        ))}
      </div>
      <div className="style-tester__row">
        <button
          type="button"
          className="chip"
          aria-pressed={settings.theme === 'light'}
          onClick={() => update({ theme: 'light' })}
        >
          Light
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={settings.theme === 'dark'}
          onClick={() => update({ theme: 'dark' })}
        >
          Dark
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={settings.palette === 'standard'}
          onClick={() => update({ palette: 'standard' })}
        >
          Standard colours
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={settings.palette === 'colourblind'}
          onClick={() => update({ palette: 'colourblind' })}
        >
          Colour-blind
        </button>
      </div>
      <button type="button" className="btn btn--secondary" onClick={tester.reset}>
        Reset to my unlocked style
      </button>
    </div>
  );
}

/**
 * Settings → Effect style (J10b): how rewards and celebrations look. Students only, since styles
 * unlock with their progress. Locked styles show their preview and how to unlock them.
 */
export function EffectStyleCard() {
  const { studentId } = useStudent();
  const { styleId, unlocked, choose, refresh, tester } = useEffectStyle();
  // Check again on opening, so a style earned in the last lesson can be picked straight away.
  useEffect(() => refresh(), [refresh]);
  if (!studentId) return null;
  return (
    <Card title="Effect style">
      <fieldset className="effect-styles">
        <legend className="visually-hidden">Effect style</legend>
        {EFFECT_STYLE_IDS.map((id) => {
          const style = EFFECT_STYLES[id];
          const open = unlocked.includes(id);
          const swatch = swatchVars(style.swatch);
          return (
            <label key={id} className={`effect-style${open ? '' : ' effect-style--locked'}`}>
              <input
                type="radio"
                name="effect-style"
                value={id}
                checked={styleId === id}
                disabled={!open}
                onChange={() => choose(id)}
              />
              <span className="effect-style__swatch" style={swatch} aria-hidden="true" />
              <span className="effect-style__text">
                <strong>{style.name}</strong>
                <span>{style.description}</span>
                {!open && style.unlock && (
                  <span className="effect-style__lock">Locked. Unlock: {style.unlock}</span>
                )}
              </span>
            </label>
          );
        })}
        {COMING_SOON_STYLES.map((style) => (
          <label key={style.id} className="effect-style effect-style--locked">
            <input
              type="radio"
              name="effect-style"
              value={style.id}
              checked={false}
              disabled
              readOnly
            />
            <span
              className="effect-style__swatch"
              style={swatchVars(style.swatch)}
              aria-hidden="true"
            />
            <span className="effect-style__text">
              <strong>{style.name}</strong>
              <span>{style.description}</span>
              <span className="effect-style__lock">Coming soon. Unlock: {style.unlock}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="secondary-text">
        How rewards, combos and celebrations look. Change it whenever you like. Saved on this
        device.
      </p>
      {tester && <StyleTesterSection tester={tester} />}
    </Card>
  );
}
