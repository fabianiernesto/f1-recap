"use client";

import Link from "next/link";
import { useState } from "react";
import type { Weekend } from "@/lib/types";

/**
 * The weekend hub: the spoiler gate first, then how much time you have, then
 * the five sessions. Nothing on this page reveals a result until you say you
 * already know it.
 */

const DEPTHS = [
  { key: "short", label: "30 seconds", hint: "just the headline moments" },
  { key: "medium", label: "3 minutes", hint: "the story, properly told" },
  { key: "full", label: "15 minutes", hint: "every moment and the data behind it" },
];

export default function WeekendHub({ weekend }: { weekend: Weekend }) {
  const [knows, setKnows] = useState<boolean | null>(null);
  const [depth, setDepth] = useState("medium");
  const heat = weekend.heat ?? [];
  const rating = weekend.rating;

  return (
    <section className="hub">
      {/* ---------- spoiler gate ---------- */}
      {knows === null && (
        <div className="hub-gate">
          <span className="hub-eyebrow">Before anything else</span>
          <h2>Do you already know how it ended?</h2>
          <div className="hub-gate-opts">
            <button className="hub-btn" onClick={() => setKnows(false)}>
              No — and don&apos;t spoil it
              <small>I&apos;ll tell you if it&apos;s worth watching. Nothing else.</small>
            </button>
            <button className="hub-btn" onClick={() => setKnows(true)}>
              Yes, I know — tell me everything
              <small>Full weekend, session by session</small>
            </button>
          </div>
        </div>
      )}

      {/* ---------- spoiler-free verdict ---------- */}
      {knows === false && rating && (
        <div className="hub-verdict">
          <span className="hub-eyebrow">Spoiler-free verdict</span>
          <div className="hub-score">
            {rating.score.toFixed(1)}
            <em>/10</em>
          </div>
          <p className="hub-say">{rating.verdict}</p>
          <p className="hub-note">
            No names, no results, no order. Just how much race there is in this race.
          </p>

          {heat.length > 0 && (
            <div className="hub-heat">
              <div className="hub-heat-bars">
                {heat.map((v, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${Math.max(6, v * 10)}%`,
                      background:
                        v >= 7 ? "var(--accent)" : v >= 4 ? "#8a3a24" : "#2a2d38",
                    }}
                    title={`Lap ${i + 1}`}
                  />
                ))}
              </div>
              <div className="hub-heat-legend">
                <span>Lap 1</span>
                <span>Short on time? Skip to the red</span>
                <span>Lap {heat.length}</span>
              </div>
            </div>
          )}

          <button className="hub-link" onClick={() => setKnows(true)}>
            I&apos;ve watched it now → open the weekend
          </button>
        </div>
      )}

      {/* ---------- the weekend ---------- */}
      {knows === true && (
        <>
          <div className="hub-depth">
            <span className="hub-eyebrow">How much time do you have?</span>
            <div className="hub-depth-opts">
              {DEPTHS.map((d) => (
                <button
                  key={d.key}
                  className={`hub-chip ${depth === d.key ? "on" : ""}`}
                  onClick={() => setDepth(d.key)}
                >
                  {d.label}
                  <small>{d.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="hub-sessions">
            <span className="hub-eyebrow">The weekend, session by session</span>
            {weekend.sessions.map((s) => (
              <Link
                key={s.slug}
                href={`/gp/${weekend.slug}/${s.slug}?d=${depth}`}
                className="hub-session"
              >
                <span className="hub-session-label">{s.label}</span>
                <span className="hub-session-head">{s.headline}</span>
                <span className="hub-session-meta">
                  {s.moments} moments{s.laps ? ` · ${s.laps} laps` : ""}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
