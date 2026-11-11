// Films iro's wake-up loop from the live page for social sharing.
//
//   npm run build && npx vite preview --port 4789   (in another terminal)
//   npm run record:share
//
// Drives the page with a fake clock so every frame is exactly 1/30s apart, triggers the
// real reactions with visitor events (nudge -> wakes, tab return -> joy, idle -> sleeps),
// skips the still stretches, then encodes seamless loops with ffmpeg:
//   public/social/iro-loop-square.mp4    1080x1080
//   public/social/iro-loop-vertical.mp4  1080x1920 (phone layout)
//   public/social/iro-share-v2.jpg       1200x630 link preview still
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.SHARE_URL ?? 'http://localhost:4789/';
const OUT = 'public/social';
const FPS = 30;
const STEP = 1000 / FPS;
const FADE = 0.5; // seconds of end-to-start crossfade that hides the loop point

async function film(name, viewport, clipFor, onJoy) {
  const dir = mkdtempSync(join(tmpdir(), `iro-${name}-`));
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.clock.install();
  await page.goto(URL);
  // The scroll hint is a CSS animation on real time; hide it so it can't flicker between frames.
  await page.addStyleTag({ content: '.scroll-cue { display: none !important; }' });

  // Rest the cursor on the robot so it looks straight at the viewer (before it's awake).
  const col = await page.locator('.nexbot-canvas-col').boundingBox();
  const eye = { x: col.x + col.width / 2, y: col.y + col.height * 0.38 };
  await page.mouse.move(eye.x, eye.y);
  await page.waitForFunction(() => window.__iroModelReady === true, null, { timeout: 60000 });
  await page.clock.pauseAt(new Date(Date.now() + 500));

  const clip = clipFor(col, viewport);
  let n = 0;
  const record = async (seconds) => {
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
      await page.clock.runFor(STEP);
      await page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.png`), clip });
    }
  };
  const nudge = (dx) => page.mouse.move(eye.x + dx, eye.y);
  const setHidden = (hidden) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  // Wake from the arrival nap, then leave it alone until it's fast asleep (not filmed).
  await page.clock.runFor(2500);
  await page.clock.runFor(24000);

  await record(0.9); // asleep
  await nudge(1);
  await record(1.7); // startles awake, looks at you
  await setHidden(true);
  await page.clock.runFor(6000); // "away" (nothing moves)
  await setHidden(false);
  await record(1.0); // overjoyed you're back
  if (onJoy) await onJoy(page);
  await record(1.4);
  await nudge(0); // counts as activity, so the doze starts 20s from here
  await page.clock.runFor(19900);
  await record(3.6); // nods off again

  await browser.close();
  return { dir, frames: n };
}

function encode({ dir, frames }, out, scale) {
  const total = frames / FPS;
  const body = (total - FADE).toFixed(3);
  // Crossfade the tail into the head so the last frame flows into the first.
  const filter =
    `[0]${scale},fps=${FPS},split[a][b];` +
    `[a]trim=start=${FADE},setpts=PTS-STARTPTS,fps=${FPS}[body];` +
    `[b]trim=end=${FADE},setpts=PTS-STARTPTS,fps=${FPS}[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${(body - FADE).toFixed(3)},format=yuv420p`;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, '%05d.png'),
    '-filter_complex', filter,
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '18', '-profile:v', 'high',
    '-movflags', '+faststart', '-an', out,
  ]);
}

// Desktop: square crop around the robot, plus a full-frame still at peak joy.
const desktop = await film(
  'square',
  { width: 1600, height: 840 },
  (col) => {
    const side = Math.round(col.height * 0.96);
    return { x: Math.round(col.x + col.width / 2 - side / 2), y: Math.round(col.y + col.height / 2 - side / 2), width: side, height: side };
  },
  async (page) => {
    await page.screenshot({ path: join(tmpdir(), 'iro-share.png') });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(tmpdir(), 'iro-share.png'), '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '3', `${OUT}/iro-share-v2.jpg`]);
  },
);
encode(desktop, `${OUT}/iro-loop-square.mp4`, 'scale=1080:1080:flags=lanczos');

// Phone: the real mobile layout, full screen.
const phone = await film('vertical', { width: 540, height: 960 }, (_, vp) => ({ x: 0, y: 0, width: vp.width, height: vp.height }));
encode(phone, `${OUT}/iro-loop-vertical.mp4`, 'scale=1080:1920:flags=lanczos');

for (const r of [desktop, phone]) rmSync(r.dir, { recursive: true, force: true });
console.log('done');
