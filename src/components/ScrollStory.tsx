import React, { useEffect, useRef } from 'react';

// Frame sequences are produced by scripts/build_scroll_frames.sh.
const CHAPTERS = [
  { id: 'wake', frames: 51, line: 'Up when you are.' },
  { id: 'feel', frames: 31, line: 'Reads how you feel.' },
  { id: 'coffee', frames: 130, line: 'Works with your home.' },
  { id: 'bring', frames: 107, line: 'Brings it to you.' },
  { id: 'sun', frames: 108, line: 'Every morning.' },
] as const;

// Scroll distance per chapter, in viewport heights. Short clips still get room to read.
const weightOf = (frames: number) => Math.max(1.5, frames / 45);
const WEIGHTS = CHAPTERS.map((c) => weightOf(c.frames));
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);
const CROSSFADE = 0.1; // share of each chapter spent fading in from the previous one

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
// Fade in over [a, b], fade out over [c, d].
const window4 = (p: number, a: number, b: number, c: number, d: number) =>
  smooth(clamp((p - a) / (b - a))) * (1 - smooth(clamp((p - c) / (d - c))));

const frameUrl = (id: string, size: 'lg' | 'sm', i: number) =>
  `${import.meta.env.BASE_URL}story/${id}/${size}/${String(i + 1).padStart(4, '0')}.webp`;

// First frame, then coarse-to-fine, so scrubbing works before everything has arrived.
const loadOrder = (count: number) => {
  const order: number[] = [];
  const seen = new Set<number>();
  for (let step = 16; step >= 1; step /= 2) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  if (!seen.has(count - 1)) order.splice(1, 0, count - 1);
  return order;
};

export const ScrollStory: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return;

    const size = window.matchMedia('(max-width: 820px)').matches ? 'sm' : 'lg';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const images = CHAPTERS.map((c) => new Array<HTMLImageElement | null>(c.frames).fill(null));
    const requested = CHAPTERS.map(() => false);
    const pending: HTMLImageElement[] = [];
    const queue: [number, number][] = [];
    const MAX_IN_FLIGHT = 6;
    let inFlight = 0;
    let disposed = false;
    let raf = 0;
    let lastKey = '';
    let visible = false;
    // Hold frame downloads until the hero model is ready (or the visitor starts scrolling),
    // so the 3D model never competes with hundreds of image requests on first load.
    let allowed = Boolean((window as Window & { __iroModelReady?: boolean }).__iroModelReady);

    const pump = () => {
      while (allowed && !disposed && inFlight < MAX_IN_FLIGHT && queue.length) {
        const [ci, i] = queue.shift()!;
        const img = new Image() as HTMLImageElement & { fetchPriority?: string };
        img.decoding = 'async';
        img.fetchPriority = 'low';
        img.onload = img.onerror = () => {
          inFlight--;
          if (img.naturalWidth) {
            images[ci][i] = img;
            lastKey = '';
            schedule();
          }
          pump();
        };
        inFlight++;
        img.src = frameUrl(CHAPTERS[ci].id, size, i);
        pending.push(img);
      }
    };

    const allow = () => {
      if (allowed) return;
      allowed = true;
      pump();
    };

    const loadChapter = (ci: number) => {
      if (ci < 0 || ci >= CHAPTERS.length || requested[ci]) return;
      requested[ci] = true;
      loadOrder(CHAPTERS[ci].frames).forEach((i) => queue.push([ci, i]));
      pump();
    };

    const nearest = (ci: number, target: number) => {
      const list = images[ci];
      for (let d = 0; d < list.length; d++) {
        if (list[target - d]) return list[target - d];
        if (list[target + d]) return list[target + d];
      }
      return null;
    };

    const drawCover = (img: HTMLImageElement, alpha: number) => {
      const { width: cw, height: ch } = canvas;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastKey = '';
      }
    };

    const update = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const enter = clamp(1 - rect.top / vh);
      const leave = clamp((rect.bottom - vh) / (vh * 0.6));
      const progress = clamp(-rect.top / Math.max(1, rect.height - vh));

      // Which chapter, and how far through it.
      let pos = progress * TOTAL_WEIGHT;
      let ci = 0;
      while (ci < CHAPTERS.length - 1 && pos > WEIGHTS[ci]) {
        pos -= WEIGHTS[ci];
        ci++;
      }
      const local = clamp(pos / WEIGHTS[ci]);
      const chapter = CHAPTERS[ci];

      loadChapter(ci);
      loadChapter(ci + 1);

      root.style.setProperty('--enter', enter.toFixed(4));
      root.style.setProperty('--leave', leave.toFixed(4));
      root.style.setProperty('--zoom', reduceMotion ? '1' : (1 + local * 0.06).toFixed(4));

      CHAPTERS.forEach((_, i) => {
        const el = lineRefs.current[i];
        if (!el) return;
        const o = i === ci ? window4(local, 0.16, 0.32, 0.74, 0.9) : 0;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translateY(${((1 - o) * 16).toFixed(1)}px)`;
      });

      const frame = Math.round(local * (chapter.frames - 1));
      const fade = ci > 0 ? clamp(local / CROSSFADE) : 1;
      const key = `${ci}:${frame}:${fade.toFixed(2)}`;
      if (key === lastKey) return;

      const current = nearest(ci, frame);
      if (!current) return;
      if (fade < 1) {
        const prev = nearest(ci - 1, CHAPTERS[ci - 1].frames - 1);
        if (prev) drawCover(prev, 1);
        drawCover(current, smooth(fade));
      } else {
        drawCover(current, 1);
      }
      lastKey = key;
    };

    function schedule() {
      if (!raf && visible) raf = requestAnimationFrame(update);
    }

    const preload = new IntersectionObserver(([e]) => e.isIntersecting && loadChapter(0), {
      rootMargin: '150% 0px 150% 0px',
    });
    const onScreen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      schedule();
    });
    preload.observe(root);
    onScreen.observe(root);

    const onResize = () => {
      resize();
      schedule();
    };
    resize();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', allow, { passive: true, once: true });
    window.addEventListener('iro:model-ready', allow, { once: true });
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      preload.disconnect();
      onScreen.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', allow);
      window.removeEventListener('iro:model-ready', allow);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
      pending.forEach((img) => (img.onload = img.onerror = null));
    };
  }, []);

  return (
    <div ref={rootRef} className="story" style={{ height: `${(TOTAL_WEIGHT + 1) * 100}vh` }}>
      <div className="story-sticky">
        <div className="story-card">
          <canvas ref={canvasRef} className="story-canvas" aria-hidden="true" />
          {CHAPTERS.map((c, i) => (
            <p
              key={c.id}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className="story-line"
            >
              {c.line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
