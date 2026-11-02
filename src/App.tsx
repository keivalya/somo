import React, { useEffect, useState } from 'react';
import { SomoHeroCanvas, IroEmotion } from './components/SomoHeroCanvas';

const EMOTIONS: { id: IroEmotion; label: string }[] = [
  { id: 'comfort', label: 'Comfort' },
  { id: 'shy', label: 'Shy' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'confused', label: 'Confused' },
  { id: 'angry', label: 'Angry' },
];

export const App: React.FC = () => {
  const [emotion, setEmotion] = useState<IroEmotion>('comfort');
  const [mouseSpotlight, setMouseSpotlight] = useState({ x: 68, y: 38 });
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Autonomously rotate through emotions on a steady rhythm so iro feels alive
  useEffect(() => {
    const timer = window.setInterval(() => {
      setEmotion((prev) => {
        const idx = EMOTIONS.findIndex((item) => item.id === prev);
        return EMOTIONS[(idx + 1) % EMOTIONS.length].id;
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMouseSpotlight({ x, y });
  };

  const handleCycleEmotion = () => {
    setEmotion((prev) => {
      const idx = EMOTIONS.findIndex((item) => item.id === prev);
      return EMOTIONS[(idx + 1) % EMOTIONS.length].id;
    });
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
              <h1 className="nexbot-headline">iro</h1>

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
              <SomoHeroCanvas emotion={emotion} onCycleEmotion={handleCycleEmotion} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
