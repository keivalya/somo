import { useCallback, useEffect, useRef, useState } from 'react';
import type { IroEmotion } from '../components/SomoHeroCanvas';
import type { PresenceState } from '../components/PresenceLight';

export interface Mood {
  emotion: IroEmotion;
  presence: PresenceState;
}

interface Beat extends Mood {
  ms: number;
}

const IDLE_TO_SLEEP_MS = 20000;
const ARRIVAL_NAP_MS = 1500; // how long iro dozes after it first appears
const AWAY_FOR_GREETING_MS = 4000;

const CLICK_CYCLE: IroEmotion[] = ['shy', 'surprised', 'thinking', 'confused', 'joy', 'comfort'];

// iro remembers visitors on their own device only: when they last came and whether they
// joined. No email or identifier is stored, and nothing leaves the browser.
const MEMORY_KEY = 'iro:memory:v1';
const NEW_VISIT_GAP_MS = 30 * 60 * 1000; // a reload within this is the same visit
const LONG_AWAY_MS = 14 * 24 * 60 * 60 * 1000;
const RETURN_NAP_MS = 800;

interface Memory {
  lastSeen: number;
  joined: boolean;
}

function readMemory(): Memory | null {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    const m = raw ? JSON.parse(raw) : null;
    return m && typeof m.lastSeen === 'number' ? { lastSeen: m.lastSeen, joined: m.joined === true } : null;
  } catch {
    return null;
  }
}

function writeMemory(update: Partial<Memory>) {
  try {
    const next = { lastSeen: Date.now(), joined: false, ...readMemory(), ...update };
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode, settings): iro just treats everyone as new.
  }
}

interface Recognition {
  joined: boolean; // joined the waitlist on an earlier visit
  returning: boolean; // came back after a real gap (not a reload)
  longAway: boolean;
}

function recognize(): Recognition {
  const m = readMemory();
  const away = m ? Date.now() - m.lastSeen : 0;
  return { joined: Boolean(m?.joined), returning: Boolean(m) && away > NEW_VISIT_GAP_MS, longAway: away > LONG_AWAY_MS };
}

// Where the email field is relative to iro: beside it on wide screens, above it on phones.
const glanceAtSignup = (): IroEmotion =>
  window.matchMedia('(max-width: 960px), (max-aspect-ratio: 1/1)').matches ? 'glanceUp' : 'glanceLeft';

/**
 * iro reacts to the visitor: dozes on arrival and wakes up, falls asleep when left alone,
 * startles awake on movement, leans in while you type, thinks while your signup is sent,
 * and is overjoyed when you're in. It also remembers you between visits (see recognize()).
 */
export function useIroMood({ focused, typing, submitted }: { focused: boolean; typing: boolean; submitted: boolean }) {
  const [memory] = useState(recognize);
  // Someone who already joined is never met with a nap: iro is up and waiting for them.
  const [asleep, setAsleep] = useState(!memory.joined);
  const [beat, setBeat] = useState<Mood | null>(null);
  const [holding, setHolding] = useState<Mood | null>(null); // held until released (e.g. while submitting)
  const timers = useRef<number[]>([]);
  const asleepRef = useRef(!memory.joined);
  const readyAt = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const cycle = useRef(0);
  const arrivalGreeting = useRef<Beat[] | null>(null); // used by whichever wake comes first
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  const play = useCallback((beats: Beat[]) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let at = 0;
    beats.forEach((b) => {
      timers.current.push(window.setTimeout(() => setBeat({ emotion: b.emotion, presence: b.presence }), at));
      at += b.ms;
    });
    timers.current.push(window.setTimeout(() => setBeat(null), at));
  }, []);

  const sleep = useCallback(() => {
    asleepRef.current = true;
    setAsleep(true);
  }, []);

  const wake = useCallback(
    (greeting: Beat[] = [{ emotion: 'surprised', presence: 'listening', ms: 750 }]) => {
      if (!asleepRef.current) return;
      asleepRef.current = false;
      setAsleep(false);
      play(arrivalGreeting.current ?? greeting);
      arrivalGreeting.current = null;
    },
    [play],
  );

  // Arrival. A first visit: iro is dozing and wakes up to meet you. A return visit: it
  // recognizes you (and, if you haven't joined yet, glances shyly at the email field).
  // Someone who joined: no nap, just a happy welcome back.
  useEffect(() => {
    writeMemory({ lastSeen: Date.now() });
    let napTimer = 0;
    const onReady = () => {
      readyAt.current = performance.now();
      const { joined, returning, longAway } = memory;
      const startle: Beat = { emotion: 'surprised', presence: 'listening', ms: longAway ? 700 : 450 };
      const delight: Beat = { emotion: 'joy', presence: 'happy', ms: longAway ? 2600 : 2000 };
      const glance: Beat[] = [
        { emotion: 'comfort', presence: 'rest', ms: 600 },
        { emotion: glanceAtSignup(), presence: 'rest', ms: 1300 },
      ];
      if (joined) {
        if (returning) play(longAway ? [startle, delight] : [delight]);
      } else if (returning) {
        arrivalGreeting.current = longAway ? [startle, { ...delight, ms: 1500 }, ...glance] : [startle, ...glance];
        napTimer = window.setTimeout(() => wake(), RETURN_NAP_MS);
      } else {
        napTimer = window.setTimeout(() => wake(), ARRIVAL_NAP_MS);
      }
    };
    if ((window as Window & { __iroModelReady?: boolean }).__iroModelReady) onReady();
    else window.addEventListener('iro:model-ready', onReady, { once: true });
    return () => {
      window.removeEventListener('iro:model-ready', onReady);
      clearTimeout(napTimer);
    };
  }, [memory, play, wake]);

  // Activity wakes it; being left alone lets it doze off.
  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
      // Let the arrival nap be seen for a moment before movement can end it.
      if (asleepRef.current && readyAt.current !== null && performance.now() - readyAt.current > 700) wake();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const idleCheck = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (!asleepRef.current && !focusedRef.current && idle > IDLE_TO_SLEEP_MS) sleep();
    }, 1000);

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      const awayFor = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      lastActivity.current = Date.now();
      if (awayFor < AWAY_FOR_GREETING_MS || readyAt.current === null) return;
      const welcomeBack: Beat[] = [{ emotion: 'joy', presence: 'happy', ms: 1800 }];
      if (asleepRef.current) wake([{ emotion: 'surprised', presence: 'listening', ms: 500 }, ...welcomeBack]);
      else play(welcomeBack);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(idleCheck);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [play, sleep, wake]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onSubmitStart = useCallback(() => setHolding({ emotion: 'thinking', presence: 'thinking' }), []);
  const onSubmitSuccess = useCallback(() => {
    writeMemory({ joined: true });
    setHolding(null);
    play([{ emotion: 'joy', presence: 'happy', ms: 3200 }]);
  }, [play]);
  const onSubmitError = useCallback(() => {
    setHolding(null);
    play([{ emotion: 'confused', presence: 'rest', ms: 2200 }]);
  }, [play]);

  const onPoke = useCallback(() => {
    lastActivity.current = Date.now();
    if (asleepRef.current) return wake();
    const emotion = CLICK_CYCLE[cycle.current++ % CLICK_CYCLE.length];
    play([{ emotion, presence: emotion === 'joy' ? 'happy' : 'listening', ms: 2400 }]);
  }, [play, wake]);

  // Resting state when nothing is playing: attentive while you're in the email field,
  // leaning in (shy) once you type, softly glowing gold after you've joined.
  const base: Mood = asleep
    ? { emotion: 'sleepy', presence: 'rest' }
    : focused && !submitted // the form unmounts on success without a blur event
      ? { emotion: typing ? 'shy' : 'comfort', presence: 'listening' }
      : { emotion: 'comfort', presence: submitted || memory.joined ? 'happy' : 'rest' };

  const mood = holding ?? (asleep ? base : beat ?? base);
  return { mood, onSubmitStart, onSubmitSuccess, onSubmitError, onPoke };
}
