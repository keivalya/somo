import React, { useEffect, useState } from 'react';
import { SomoHeroCanvas } from './components/SomoHeroCanvas';

const PRESENCE_STATES = [
  { id: 'rest', emotion: 'comfort', duration: 12000 },
  { id: 'listening', emotion: 'surprised', duration: 5000 },
  { id: 'thinking', emotion: 'thinking', duration: 6000 },
  { id: 'happy', emotion: 'shy', duration: 3000 },
] as const;

export const App: React.FC = () => {
  const [presenceIndex, setPresenceIndex] = useState(0);
  const presence = PRESENCE_STATES[presenceIndex];
  const [mouseSpotlight, setMouseSpotlight] = useState({ x: 68, y: 38 });
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Preview a calm interaction, leaving time for the resting pulse to breathe.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPresenceIndex((index) => (index + 1) % PRESENCE_STATES.length);
    }, presence.duration);
    return () => window.clearTimeout(timer);
  }, [presenceIndex, presence.duration]);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMouseSpotlight({ x, y });
  };

  const handleCycleEmotion = () => {
    setPresenceIndex((index) => (index + 1) % PRESENCE_STATES.length);
  };

  const handleWaitlistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    setEmail('');
  };

  return (
    <div className="somo-minimal-shell">
      <main className="somo-stage-wrap">
        <section
          className="nexbot-stage-card"
          onMouseMove={handleStageMouseMove}
          style={
            {
              '--spot-x': `${mouseSpotlight.x}%`,
              '--spot-y': `${mouseSpotlight.y}%`,
            } as React.CSSProperties
          }
        >
          {/* Minimal Brand Lockup */}
          <header className="nexbot-minimal-header">
            <img src="/somo-logo-light.png" alt="somo logo" className="brand-logo" />
            <span className="brand-company">somo</span>
          </header>

          {/* Subtle Spotlight SVG Beam */}
          <svg
            className="spline-spotlight-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 3787 2842"
            fill="none"
          >
            <g filter="url(#somoSpotlightFilter)">
              <ellipse
                cx="1924.71"
                cy="273.501"
                rx="1924.71"
                ry="273.501"
                transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
                fill="white"
                fillOpacity="0.18"
              />
            </g>
            <defs>
              <filter
                id="somoSpotlightFilter"
                x="0.860352"
                y="0.838989"
                width="3785.16"
                height="2840.26"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
              </filter>
            </defs>
          </svg>

          <div className="nexbot-hero-grid">
            <div className="nexbot-copy-col">
              <div className="nexbot-title-block">
                <h1 className="nexbot-headline">iro</h1>
                <p className="nexbot-tagline">
                  home robot with <span className="tagline-highlight">emotional intelligence</span>
                </p>
              </div>

              {submitted ? (
                <div className="waitlist-confirm" role="status">
                  <span className="waitlist-dot" />
                  <span>On waitlist</span>
                </div>
              ) : (
                <form className="waitlist-form" onSubmit={handleWaitlistSubmit}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    aria-label="Email"
                    className="waitlist-input"
                  />
                  <button type="submit" className="waitlist-button">
                    Waitlist
                  </button>
                </form>
              )}
            </div>

            <div className="nexbot-canvas-col">
              <SomoHeroCanvas emotion={presence.emotion} presence={presence.id} onCycleEmotion={handleCycleEmotion} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
