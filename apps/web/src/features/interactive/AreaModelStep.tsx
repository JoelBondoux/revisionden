import { useId, useState, type KeyboardEvent } from 'react';
import {
  areaModelLayout,
  checkAreaModelPair,
  factorPairs,
  factorisedForm,
  formatAreaModelAnswer,
  parseAreaModelAnswer,
  tileExplanation,
  type AreaModelTile,
  type LearnItem,
} from '@revisionden/core';
import './interactive.css';

type AreaItem = Extract<LearnItem, { type: 'area_model' }>;

interface AreaModelStepProps {
  item: AreaItem;
  /** The chosen pair as the answer text ("2,3"), or empty. */
  draft: string;
  /** True once the answer has been checked. */
  disabled: boolean;
  onChange: (draft: string) => void;
}

const TILE_NAMES: Record<AreaModelTile, string> = {
  square: 'The x² square',
  strip: 'An x strip',
  unit: 'A unit square',
};

// Drawing sizes in SVG units; the picture scales to the width it is given.
const X = 90;
const U = 18;
const GAP = 2;
const OX = 34;
const OY = 30;

/**
 * The interactive area model (lesson pilot W8): x² + bx + c as tiles. The student picks the two
 * numbers that split the middle term and the tiles make a rectangle whose sides are the brackets.
 * Tap a tile to see which term it is. Everything works by keyboard and screen reader: the tiles
 * are buttons and the pairs are radio buttons, so nothing needs dragging. Nothing about how the
 * tiles were moved is recorded; only the checked answer is sent, as for any question.
 */
export function AreaModelStep({ item, draft, disabled, onChange }: AreaModelStepProps) {
  const { b, c } = item.quadratic;
  const id = useId();
  const [lit, setLit] = useState<AreaModelTile | null>(null);
  const [message, setMessage] = useState('');
  const pair = parseAreaModelAnswer(draft);
  const check = pair ? checkAreaModelPair(item.quadratic, pair) : null;
  const showVerdict = item.mode === 'explore' || disabled;

  const light = (tile: AreaModelTile) => {
    setLit(tile);
    setMessage(tileExplanation(tile, item.quadratic));
  };

  const choose = (p: number, q: number) => {
    onChange(formatAreaModelAnswer([p, q]));
    setLit(null);
    setMessage('');
  };

  const verdict =
    check && showVerdict
      ? check.correct
        ? `The tiles make a rectangle: x² + ${b === 1 ? '' : b}x + ${c} = ${factorisedForm(pair!)}.`
        : `${pair![0]} × ${pair![1]} = ${check.product}, but ${pair![0]} + ${pair![1]} = ${check.sum}, not ${b}. Try another pair.`
      : '';

  return (
    <div className="question area-model">
      <p className="question__prompt">{item.prompt}</p>
      <p className="area-expression" data-testid="area-expression">
        <Term tile="square" lit={lit}>
          x²
        </Term>{' '}
        +{' '}
        <Term tile="strip" lit={lit}>
          {b === 1 ? 'x' : `${b}x`}
        </Term>{' '}
        +{' '}
        <Term tile="unit" lit={lit}>
          {String(c)}
        </Term>
      </p>

      <div className="area-board">
        <Tiles
          b={b}
          c={c}
          pair={pair}
          fits={!showVerdict || !!check?.correct}
          lit={lit}
          onTile={light}
        />
      </div>
      {pair && (
        <p className="area-sides" data-testid="area-sides">
          The sides are x + {Math.max(...pair)} and x + {Math.min(...pair)}.
        </p>
      )}
      <p
        className={`area-status${check && showVerdict ? (check.correct ? ' area-status--right' : ' area-status--try') : ''}`}
        role="status"
      >
        {message || verdict}
      </p>

      <div className="area-pairs" role="radiogroup" aria-labelledby={`${id}-pairs`}>
        <p id={`${id}-pairs`} className="area-pairs__label">
          Which two numbers multiply to {c} and add to {b}?
        </p>
        <div className="area-pairs__options">
          {factorPairs(c).map(([p, q]) => (
            <label key={`${p}-${q}`} className="area-pair">
              <input
                type="radio"
                name={`${id}-pair`}
                checked={!!pair && pair[0] === p && pair[1] === q}
                disabled={disabled}
                onChange={() => choose(p, q)}
              />
              <span>
                {p} and {q}
              </span>
            </label>
          ))}
        </div>
      </div>
      <p className="secondary-text area-help">
        Tap a tile to see which part of the expression it is.
      </p>
    </div>
  );
}

function Term({
  tile,
  lit,
  children,
}: {
  tile: AreaModelTile;
  lit: AreaModelTile | null;
  children: React.ReactNode;
}) {
  return (
    <span
      data-testid={`area-term-${tile}`}
      className={`area-term area-term--${tile}${lit === tile ? ' area-term--lit' : ''}`}
    >
      {children}
    </span>
  );
}

interface TilesProps {
  b: number;
  c: number;
  pair: readonly [number, number] | null;
  /** False in explore mode when the chosen pair does not make a rectangle: units fade. */
  fits: boolean;
  lit: AreaModelTile | null;
  onTile: (tile: AreaModelTile) => void;
}

/** The tiles as an SVG picture. One tile of each kind is a keyboard stop; all can be tapped. */
function Tiles({ b, c, pair, fits, lit, onTile }: TilesProps) {
  const seen = new Set<AreaModelTile>();
  const tile = (
    kind: AreaModelTile,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    faded = false,
  ) => {
    const first = !seen.has(kind);
    seen.add(kind);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTile(kind);
      }
    };
    return (
      <rect
        key={key}
        className={`area-tile area-tile--${kind}${lit === kind ? ' area-tile--lit' : ''}${faded ? ' area-tile--faded' : ''}`}
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        role="button"
        aria-label={TILE_NAMES[kind]}
        tabIndex={first ? 0 : -1}
        onClick={() => onTile(kind)}
        onKeyDown={onKey}
      />
    );
  };

  const shapes = [tile('square', 'sq', OX, OY, X, X)];
  const labels = [
    <text key="tx" x={OX + X / 2} y={OY - 10} textAnchor="middle">
      x
    </text>,
    <text key="lx" x={OX - 12} y={OY + X / 2 + 5} textAnchor="middle">
      x
    </text>,
  ];
  let width: number;
  let height: number;

  if (!pair) {
    for (let i = 0; i < b; i++)
      shapes.push(tile('strip', `s${i}`, OX + X + 14 + i * (U + 4), OY, U, X));
    for (let j = 0; j < c; j++) {
      shapes.push(
        tile(
          'unit',
          `u${j}`,
          OX + (j % 8) * (U + 4),
          OY + X + 14 + Math.floor(j / 8) * (U + 4),
          U,
          U,
        ),
      );
    }
    width = OX + X + 14 + b * (U + 4) + 10;
    height = OY + X + 14 + Math.ceil(c / 8) * (U + 4) + 10;
  } else {
    const layout = areaModelLayout(pair);
    for (let i = 0; i < layout.rightStrips; i++) {
      shapes.push(tile('strip', `r${i}`, OX + X + GAP + i * (U + GAP), OY, U, X));
    }
    for (let i = 0; i < layout.bottomStrips; i++) {
      shapes.push(tile('strip', `d${i}`, OX, OY + X + GAP + i * (U + GAP), X, U));
    }
    for (const { row, col } of layout.units) {
      shapes.push(
        tile(
          'unit',
          `u${row}-${col}`,
          OX + X + GAP + col * (U + GAP),
          OY + X + GAP + row * (U + GAP),
          U,
          U,
          !fits,
        ),
      );
    }
    const qw = layout.rightStrips * (U + GAP);
    const ph = layout.bottomStrips * (U + GAP);
    labels.push(
      <text key="tq" x={OX + X + GAP + qw / 2} y={OY - 10} textAnchor="middle">
        {layout.sides.top[1]}
      </text>,
      <text key="lp" x={OX - 12} y={OY + X + GAP + ph / 2 + 5} textAnchor="middle">
        {layout.sides.left[1]}
      </text>,
    );
    width = OX + X + GAP + qw + 20;
    height = OY + X + GAP + ph + 20;
  }

  return (
    <svg
      className="area-svg"
      viewBox={`0 0 ${Math.max(240, width)} ${Math.max(180, height)}`}
      role="group"
      aria-label={`Tiles for x² + ${b}x + ${c}`}
    >
      {shapes}
      <g aria-hidden="true">{labels}</g>
    </svg>
  );
}
