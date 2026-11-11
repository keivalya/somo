import React, { useEffect, useRef, useState } from 'react';
import { ScrollStory } from './components/ScrollStory';
import { SomoHeroCanvas } from './components/SomoHeroCanvas';
import { useIroMood } from './hooks/useIroMood';

const WAITLIST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzIYyQj6gEzVm5s4l1Sp3_MdsUtCXuY5ME-6_st3cQpJ5qxa4t2nyUxwmdk0gwT_IU1/exec';

export const App: React.FC = () => {
  const [mouseSpotlight, setMouseSpotlight] = useState({ x: 68, y: 38 });
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const { mood, onSubmitStart, onSubmitSuccess, onSubmitError, onPoke } = useIroMood({
    focused: emailFocused,
    typing: email.trim().length > 0,
    submitted,
  });
  const heroRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);

  // Pause the 3D hero while the scroll story is on screen.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMouseSpotlight({ x, y });
  };

  const handleWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    onSubmitStart();
    try {
      const body = new URLSearchParams({ email: normalizedEmail });
      const response = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      // Confirm persistence only when the script explicitly reports success.
      if (!response.ok || (await response.text()).trim() !== 'OK') {
        throw new Error('Waitlist submission was not confirmed');
      }
      onSubmitSuccess();
      setSubmitted(true);
      setEmail('');
    } catch {
      onSubmitError();
      setSubmitError('Couldn’t confirm your signup. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const signup = (
    <>
    <div className="signup-actions">
      {submitted ? (
        <div className="waitlist-confirm" role="status">
          <span className="waitlist-confirm-mark" aria-hidden="true">✓</span>
          <span className="waitlist-confirm-copy">
            <strong>You’re in ✨</strong>
          </span>
        </div>
      ) : (
        <form className="waitlist-form" onSubmit={handleWaitlistSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="Email"
            aria-label="Email"
            className="waitlist-input"
          />
          <button type="submit" className="waitlist-button" disabled={submitting}>
            {submitting ? 'Joining…' : 'Waitlist'}
          </button>
        </form>
      )}
      <a className="survey-link" href={`${import.meta.env.BASE_URL}form/`} target="_blank" rel="noopener noreferrer">
        Thoughts?
      </a>
    </div>
    {submitError && <p className="waitlist-error" role="alert">{submitError}</p>}
    </>
  );

  return (
    <>
      <div className="somo-minimal-shell">
        <main className="somo-stage-wrap">
          <section
            ref={heroRef}
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
              <img src={`${import.meta.env.BASE_URL}somo-logo-light.png`} alt="somo logo" className="brand-logo" />
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

                {signup}
              </div>

              <div className="nexbot-canvas-col">
                <SomoHeroCanvas
                  active={heroVisible}
                  emotion={mood.emotion}
                  presence={mood.presence}
                  onCycleEmotion={onPoke}
                />
              </div>
            </div>
            <span className="scroll-cue" aria-hidden="true" />
          </section>
        </main>
      </div>

      <ScrollStory />

      <section className="story-end">
        <h2 className="nexbot-headline">iro</h2>
        {signup}
      </section>
    </>
  );
};
