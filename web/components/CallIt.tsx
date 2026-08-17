"use client";

import { useState } from "react";
import type { CardData } from "@/lib/types";

/**
 * The two cards that stop the story and hand it over.
 *
 * A decision is not a quiz: there is rarely a right answer, so every option
 * carries its own consequence and the reveal says what the pit wall actually
 * did. A guess is the opposite, one number, and you either land near it or you
 * find out how wrong your instinct was.
 */

export function DecisionBody({ card }: { card: CardData }) {
  const [pick, setPick] = useState<string | null>(null);
  const choices = card.choices || [];
  const matched = pick && card.actual && pick === card.actual;

  return (
    <div className="call">
      {card.state && card.state.length > 0 && (
        <dl className="call-state">
          {card.state.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="call-opts">
        {choices.map((o) => (
          <button
            key={o.id}
            className={`call-opt${pick === o.id ? " picked" : ""}${
              pick && card.actual === o.id ? " real" : ""
            }`}
            disabled={!!pick}
            onClick={() => setPick(o.id)}
          >
            <b>{o.label}</b>
            {o.sub && <span>{o.sub}</span>}
            {pick && card.actual === o.id && <em>What they did</em>}
          </button>
        ))}
      </div>

      {pick && (
        <div className="call-out">
          <div className={`call-verdict${matched ? " agreed" : ""}`}>
            {card.actual
              ? matched
                ? "You made the same call they did"
                : "You went the other way"
              : "Nobody can check this one"}
          </div>
          {card.outcomes?.[pick] && <p className="call-cost">{card.outcomes[pick]}</p>}
          {card.reveal && <p className="call-reveal">{card.reveal}</p>}
        </div>
      )}
    </div>
  );
}

export function GuessBody({ card }: { card: CardData }) {
  const min = card.min ?? 0;
  const max = card.max ?? 100;
  const step = card.step ?? 1;
  const target = card.target ?? 0;
  const [value, setValue] = useState((min + max) / 2);
  const [locked, setLocked] = useState(false);

  const off = Math.abs(value - target);
  const close = card.close ?? (max - min) * 0.1;
  const verdict = off <= close / 3 ? "Spot on" : off <= close ? "Close" : "Not even near";

  return (
    <div className="guess">
      <div className="guess-dial">
        <span className="guess-val">
          {value.toFixed(step < 1 ? 2 : 0)}
          <small>{card.unit}</small>
        </span>
        {locked && (
          <span className="guess-real">
            Actual {target.toFixed(3)}
            {card.unit}
          </span>
        )}
      </div>

      <input
        type="range"
        className="guess-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={locked}
        onChange={(e) => setValue(+e.target.value)}
      />
      <div className="guess-scale">
        <span>
          {min}
          {card.unit}
        </span>
        <span>
          {max}
          {card.unit}
        </span>
      </div>

      {!locked ? (
        <button className="call-opt lock" onClick={() => setLocked(true)}>
          <b>Lock it in</b>
        </button>
      ) : (
        <div className="call-out">
          <div className={`call-verdict${off <= close ? " agreed" : ""}`}>
            {verdict}, you were {off.toFixed(step < 1 ? 2 : 0)}
            {card.unit} off
          </div>
          {card.reveal && <p className="call-reveal">{card.reveal}</p>}
        </div>
      )}
    </div>
  );
}
