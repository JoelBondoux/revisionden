import { useId } from 'react';

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  /** Show the label on screen (otherwise it is only spoken). */
  showLabel?: boolean;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}

/** A row of pill buttons that behave as one radio group. */
export function ChoiceGroup<T extends string | number>({
  label,
  showLabel = true,
  options,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  return (
    <div className="choice-group">
      <span id={labelId} className={showLabel ? 'choice-group__label' : 'visually-hidden'}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="chip-row">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className="chip"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
