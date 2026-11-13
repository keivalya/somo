import { useEffect, type RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'motion';

type Options = {
  /** Scroll length of each chapter, in the same units as the story's total weight. */
  weights: readonly number[];
  /** Chapter-local progress range where the chapter's line is fully readable. */
  restStart: number;
  restEnd: number;
};

const IDLE_MS = 160; // how long scrolling must pause before we glide
const PULL_BACK = 0.1; // within this share of a viewport past a resting place, return to it
const EDGE_MARGIN = 0.04; // land a little inside a chapter's rest range, never on its edge

/**
 * When scrolling stops between resting places (the hero, a chapter whose line is fully
 * readable, the closing section), glide on in the direction of travel to the next one,
 * so the story never sits on a half-revealed line. Small nudges return to where they began.
 */
export const useStorySnap = (rootRef: RefObject<HTMLElement>, { weights, restStart, restEnd }: Options) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const total = weights.reduce((a, b) => a + b, 0);
    let lastY = window.scrollY;
    let direction = 1;
    let idleTimer = 0;
    let touching = false;
    let glide: AnimationPlaybackControls | null = null;

    // Resting places as [from, to] scroll ranges, top to bottom.
    const restingPlaces = () => {
      const vh = window.innerHeight;
      const top = root.getBoundingClientRect().top + window.scrollY;
      const run = root.offsetHeight - vh; // scroll distance over which the story progresses
      const at = (ci: number, local: number) =>
        top + ((weights.slice(0, ci).reduce((a, b) => a + b, 0) + local * weights[ci]) / total) * run;
      const end = Math.min(top + root.offsetHeight, document.documentElement.scrollHeight - vh);
      return [
        [0, 0] as const,
        ...weights.map((_, ci) => [at(ci, restStart + EDGE_MARGIN), at(ci, restEnd - EDGE_MARGIN)] as const),
        [end, Infinity] as const,
      ];
    };

    const stop = () => {
      glide?.stop();
      glide = null;
    };

    const settle = () => {
      if (touching || glide) return;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const places = restingPlaces();
      // Resting already (with a little slack around the hero and the readable ranges)?
      const slack = 0.15 * vh;
      if (y <= places[0][1] + slack) return;
      if (y >= places[places.length - 1][0] - 1) return;
      for (let i = 1; i < places.length - 1; i++) {
        const [from, to] = places[i];
        if (y >= from - vh * EDGE_MARGIN && y <= to + vh * EDGE_MARGIN) return;
      }

      // Between two places: `behind` is where we came from, `ahead` where we were heading.
      const next = places.findIndex(([from]) => from > y);
      const [above, below] = [places[next - 1], places[next]];
      const behind = direction > 0 ? above[1] : below[0];
      // Land mid-way through the next readable range, so a small scroll either way stays on it.
      const middle = ([from, to]: readonly [number, number]) => (Number.isFinite(to) ? (from + to) / 2 : from);
      const ahead = middle(direction > 0 ? below : above);
      const target = Math.abs(y - behind) < PULL_BACK * vh ? behind : ahead;

      const distance = Math.abs(target - y) / vh;
      glide = animate(y, target, {
        duration: Math.min(1.4, 0.45 + distance * 0.35),
        ease: [0.33, 0, 0.2, 1],
        onUpdate: (v) => window.scrollTo({ top: v, behavior: 'instant' }),
        onComplete: () => {
          glide = null;
          lastY = window.scrollY;
        },
      });
    };

    const onScroll = () => {
      if (glide) return; // our own scrolling
      const y = window.scrollY;
      if (y !== lastY) direction = y > lastY ? 1 : -1;
      lastY = y;
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(settle, IDLE_MS);
    };

    // Any new input from the visitor takes over immediately.
    // Re-arm afterwards: a late trackpad-inertia event can interrupt a glide with no scroll after it.
    const interrupt = () => {
      if (!glide) return;
      stop();
      lastY = window.scrollY;
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(settle, IDLE_MS);
    };
    const onTouchStart = () => {
      touching = true;
      interrupt();
    };
    const onTouchEnd = () => {
      touching = false;
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(settle, IDLE_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('keydown', interrupt);
    window.addEventListener('pointerdown', interrupt);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      stop();
      clearTimeout(idleTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('keydown', interrupt);
      window.removeEventListener('pointerdown', interrupt);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [rootRef, weights, restStart, restEnd]);
};
