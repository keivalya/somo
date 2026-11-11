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

/**
 * iro reacts to the visitor: dozes on arrival and wakes up, falls asleep when left alone,
 * startles awake on movement, leans in while you type, thinks while your signup is sent,
 * and is overjoyed when you're in.
 */
export function useIroMood({ focused, typing, submitted }: { focused: boolean; typing: boolean; submitted: boolean }) {
  const [asleep, setAsleep] = useState(true);
  const [beat, setBeat] = useState<Mood | null>(null);
  const [holding, setHolding] = useState<Mood | null>(null); // held until released (e.g. while submitting)
  const timers = useRef<number[]>([]);
  const asleepRef = useRef(true);
  const readyAt = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const cycle = useRef(0);
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
      play(greeting);
    },
    [play],
  );

  // Arrival: iro is dozing when the model first appears, then wakes up to meet you.
  useEffect(() => {
    let napTimer = 0;
    const onReady = () => {
      readyAt.current = performance.now();
      napTimer = window.setTimeout(() => wake(), ARRIVAL_NAP_MS);
    };
    if ((window as Window & { __iroModelReady?: boolean }).__iroModelReady) onReady();
    else window.addEventListener('iro:model-ready', onReady, { once: true });
    return () => {
      window.removeEventListener('iro:model-ready', onReady);
      clearTimeout(napTimer);
    };
  }, [wake]);

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
      : { emotion: 'comfort', presence: submitted ? 'happy' : 'rest' };

  const mood = holding ?? (asleep ? base : beat ?? base);
  return { mood, onSubmitStart, onSubmitSuccess, onSubmitError, onPoke };
}
