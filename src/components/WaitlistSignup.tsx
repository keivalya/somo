import React from 'react';
import { AnimatePresence, motion, type Transition } from 'motion/react';

type Props = {
  /** Unique per rendered copy, so each copy morphs its own button into its own confirmation. */
  id: string;
  email: string;
  submitted: boolean;
  submitting: boolean;
  submitError: string;
  onEmailChange: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

const morph: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 };
const quick: Transition = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };

export const WaitlistSignup: React.FC<Props> = ({
  id,
  email,
  submitted,
  submitting,
  submitError,
  onEmailChange,
  onFocusChange,
  onSubmit,
}) => {
  const ctaId = `${id}-cta`;

  return (
    <>
      <div className="signup-actions">
        <AnimatePresence mode="popLayout" initial={false}>
          {submitted ? (
            // Shares a layoutId with the button, so the button stretches into this pill.
            <motion.div
              key="confirm"
              layoutId={ctaId}
              className="waitlist-confirm"
              role="status"
              transition={morph}
              style={{ borderRadius: 16 }}
            >
              <motion.span
                className="waitlist-confirm-mark"
                aria-hidden="true"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.16 }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <motion.path
                    d="M3.2 8.6 6.4 11.6 12.8 4.6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.36, ease: 'easeOut', delay: 0.3 }}
                  />
                </svg>
              </motion.span>
              <motion.span
                className="waitlist-confirm-copy"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: 0.22 }}
              >
                <strong>You’re in ✨</strong>
              </motion.span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className="waitlist-form"
              onSubmit={onSubmit}
              exit={{ opacity: 0, transition: quick }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onFocus={() => onFocusChange(true)}
                onBlur={() => onFocusChange(false)}
                placeholder="Email"
                aria-label="Email"
                className="waitlist-input"
              />
              <motion.button
                layoutId={ctaId}
                type="submit"
                className="waitlist-button"
                disabled={submitting}
                transition={morph}
                style={{ borderRadius: 999 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Labels slide past each other instead of swapping instantly. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={submitting ? 'joining' : 'idle'}
                    className="waitlist-button-label"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={quick}
                  >
                    {submitting ? 'Joining…' : 'Waitlist'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
        <motion.a
          layout="position"
          transition={morph}
          className="survey-link"
          href={`${import.meta.env.BASE_URL}form/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Thoughts?
        </motion.a>
      </div>
      <AnimatePresence initial={false}>
        {submitError && (
          <motion.p
            key="error"
            className="waitlist-error"
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {submitError}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
};
