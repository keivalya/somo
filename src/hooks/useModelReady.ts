import { useEffect, useState } from 'react';

type ReadyWindow = Window & { __iroModelReady?: boolean };

/**
 * True once the hero model has loaded (`iro:model-ready`), or after `maxWaitMs`,
 * so a slow 3D load never keeps the page copy hidden.
 */
export const useModelReady = (maxWaitMs = 2500) => {
  const [ready, setReady] = useState(() => Boolean((window as ReadyWindow).__iroModelReady));

  useEffect(() => {
    if (ready) return;
    const done = () => setReady(true);
    const timer = window.setTimeout(done, maxWaitMs);
    window.addEventListener('iro:model-ready', done, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('iro:model-ready', done);
    };
  }, [ready, maxWaitMs]);

  return ready;
};
