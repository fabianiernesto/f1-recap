"use client";

import { useEffect } from "react";
import { soundAllowed, uiBack, uiConfirm, uiTick } from "@/lib/sfx";

/**
 * The site clicks back.
 *
 * One listener rather than a handler on every control, because there are
 * dozens of them across the screens and a sound that only some buttons make is
 * worse than none at all. What you pressed decides which pip you get: a way in
 * confirms, a way back knocks low, everything else ticks like a timing screen.
 *
 * It listens in the bubble phase and skips anything already handled, so a
 * component with something better to say about its own click, the blind test
 * scoring you or Alfred coming on air, is never talked over.
 */

/* the controls that commit to something */
const CONFIRM = [
  ".ledhero-enter",
  ".act-go",
  "a.act",
  ".blind-go",
  ".mate-ask button[type='submit']",
].join(",");

/* and the ones that step back out */
const BACK = [".ledhero-home", ".hub-back", ".hub-home", ".blind-back"].join(",");

export default function UISound() {
  useEffect(() => {
    if (!soundAllowed()) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented && !(e.target as HTMLElement)?.closest?.("a")) return;
      const el = (e.target as HTMLElement)?.closest?.(
        "a,button,[role='button']"
      ) as HTMLElement | null;
      if (!el || el.hasAttribute("disabled")) return;
      // a component that wants its own sound says so and is left alone
      if (el.closest("[data-sfx='own']")) return;

      if (el.closest(BACK)) uiBack();
      else if (el.closest(CONFIRM)) uiConfirm();
      else uiTick();
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
