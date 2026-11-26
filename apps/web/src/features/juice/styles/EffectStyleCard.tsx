import { useEffect, type CSSProperties } from 'react';
import { Card } from '../../../components/Card';
import './picker.css';
import { useStudent } from '../../../session/StudentContext';
import { useEffectStyle } from './EffectStyleProvider';
import { COMING_SOON_STYLES, EFFECT_STYLES, EFFECT_STYLE_IDS } from './registry';

const swatchVars = (swatch: readonly [string, string, string]) =>
  ({ '--swatch-0': swatch[0], '--swatch-1': swatch[1], '--swatch-2': swatch[2] }) as CSSProperties;

/**
 * Settings → Effect style (J10b): how rewards and celebrations look. Students only, since styles
 * unlock with their progress. Locked styles show their preview and how to unlock them.
 */
export function EffectStyleCard() {
  const { studentId } = useStudent();
  const { styleId, unlocked, choose, refresh } = useEffectStyle();
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
    </Card>
  );
}
