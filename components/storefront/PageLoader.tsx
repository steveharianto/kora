"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LoaderShell from "./LoaderShell";

/**
 * PageLoader — full-screen gate that holds the page behind LoaderShell
 * until every `img[data-preload]` on the current route has either loaded
 * or errored.
 *
 * Why this works for both cached and uncached cases:
 *
 *   • Cached:      `img.complete` is already true on the first layout pass.
 *                  `setHidden(true)` fires synchronously in the layout
 *                  effect, before the browser paints — the loader never
 *                  appears to the user.
 *
 *   • Uncached:    The loader is painted (it's SSR-rendered, so it's in
 *                  the initial HTML), then the effect attaches
 *                  load/error listeners to the pending images. When the
 *                  last one settles, the loader unmounts.
 *
 *   • Safety net:  An 8-second timeout ensures a stuck image can never
 *                  trap the user behind the overlay forever.
 *
 * `useIsomorphicLayoutEffect` is `useLayoutEffect` on the client and
 * `useEffect` during SSR — React never warns about switching hook types.
 */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function PageLoader() {
  const pathname = usePathname();
  // Start visible: PageLoader is SSR-rendered, so on first paint the
  // overlay is up and the content behind is hidden. The layout effect
  // below hides it synchronously if everything is already in cache.
  const [hidden, setHidden] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>("img[data-preload]"),
    );

    // No images to gate on → hide immediately, no flash.
    if (imgs.length === 0) {
      setHidden(true);
      return;
    }

    // Browser-cache fast path. Runs before paint, so cached pages
    // literally never show the loader.
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) {
      setHidden(true);
      return;
    }

    // There's real work to wait for. Ensure the overlay is visible
    // (it should be already, but a re-mount from a pathname change
    // could leave it in the hidden state — this re-asserts it).
    setHidden(false);

    let remaining = pending.length;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      setHidden(true);
    };

    const onSettle = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };

    const timeout = window.setTimeout(finish, 8000);

    for (const img of pending) {
      img.addEventListener("load", onSettle, { once: true });
      img.addEventListener("error", onSettle, { once: true });
    }

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  if (hidden) return null;
  return <LoaderShell />;
}
