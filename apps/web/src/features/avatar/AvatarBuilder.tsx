import { useId, useState } from 'react';
import {
  AVATAR_CATALOGUE,
  REWARDS,
  encodeAvatar,
  type AvatarItem,
  type AvatarLayer,
} from '@revisionden/core';
import { Button } from '../../components';
import { AvatarSvg, choicesFrom } from './AvatarSvg';
import { AVATAR_TABS, isAvailable, itemLabel, lockLabel, shuffleAvatar } from './catalogue';
import { colourOf } from './parts';
import './avatar.css';

interface AvatarBuilderProps {
  code: string;
  nickname: string;
  earnedRewardIds?: readonly string[];
  onChange: (code: string) => void;
  /** Injected randomness for Shuffle (tests pass a fixed one). */
  random?: () => number;
}

const rewardName = (item: AvatarItem) =>
  REWARDS.find((r) => r.id === item.unlockedBy)?.name ?? item.unlockedBy;

/** Layered avatar builder: tabs of items, locked items show their reward, Shuffle. */
export function AvatarBuilder({
  code,
  nickname,
  earnedRewardIds = [],
  onChange,
  random = Math.random,
}: AvatarBuilderProps) {
  const [tabId, setTabId] = useState(AVATAR_TABS[0]!.id);
  const baseId = useId();
  const choices = choicesFrom(code);
  const tab = AVATAR_TABS.find((t) => t.id === tabId)!;

  const pick = (layer: AvatarLayer, index: number) =>
    onChange(encodeAvatar({ ...choices, [layer]: index }));

  return (
    <div className="avatar-builder">
      <div className="avatar-builder__preview">
        <AvatarSvg code={code} label={`${nickname || 'Your'}'s avatar`} size={160} />
        <Button
          variant="secondary"
          onClick={() => onChange(encodeAvatar(shuffleAvatar(random, earnedRewardIds)))}
        >
          Shuffle
        </Button>
      </div>
      <div role="tablist" aria-label="Avatar parts" className="avatar-builder__tabs">
        {AVATAR_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={t.id === tabId}
            aria-controls={`${baseId}-panel`}
            className="avatar-builder__tab"
            onClick={() => setTabId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${tab.id}`}
        className="avatar-builder__panel"
      >
        {tab.sections.map(({ layer, label }) => (
          <fieldset key={layer} className="avatar-builder__section">
            <legend>{label}</legend>
            <div className="avatar-builder__options">
              {AVATAR_CATALOGUE[layer].map((item, index) => {
                const open = isAvailable(item, earnedRewardIds);
                const name = itemLabel(item.id);
                const swatch = colourOf(layer, item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`avatar-option${open ? '' : ' avatar-option--locked'}`}
                    aria-pressed={choices[layer] === index}
                    aria-disabled={open ? undefined : true}
                    aria-label={open ? undefined : `${name}, locked. ${lockLabel(item)}`}
                    onClick={() => open && pick(layer, index)}
                  >
                    {swatch ? (
                      <span
                        className="avatar-option__swatch"
                        style={{ backgroundColor: swatch }}
                        aria-hidden="true"
                      />
                    ) : (
                      <AvatarSvg code={encodeAvatar({ ...choices, [layer]: index })} size={56} />
                    )}
                    <span className="avatar-option__name">{name}</span>
                    {!open && <span className="avatar-option__lock">{rewardName(item)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
