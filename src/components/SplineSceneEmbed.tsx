import React, { Suspense, lazy, useState } from 'react';
import { ExternalLink, Sparkles, UploadCloud } from 'lucide-react';
import { SPLINE_COMMUNITY_FILE_URL, SPLINE_TEMPLATE_URL } from '../data/cadCatalog';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneEmbedProps {
  customSceneUrl?: string;
  onSwitchToSomoCad: () => void;
}

export const SplineSceneEmbed: React.FC<SplineSceneEmbedProps> = ({
  customSceneUrl,
  onSwitchToSomoCad,
}) => {
  const [sceneUrl, setSceneUrl] = useState(customSceneUrl || SPLINE_TEMPLATE_URL);
  const [inputUrl, setInputUrl] = useState('');

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      setSceneUrl(inputUrl.trim());
    }
  };

  return (
    <div className="spline-embed-wrapper">
      <Suspense
        fallback={
          <div className="spline-loading-state">
            <span className="loader-spinner" />
            <span>Loading Spline Scene…</span>
          </div>
        }
      >
        <Spline scene={sceneUrl} className="spline-canvas-instance" />
      </Suspense>

      <div className="spline-overlay-bar">
        <form onSubmit={handleApplyUrl} className="spline-custom-url-form">
          <span className="spline-badge">
            <Sparkles size={13} />
            Spline
          </span>
          <UploadCloud size={14} className="url-icon" />
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste .splinecode URL…"
            className="spline-url-input"
          />
          <button type="submit" className="spline-url-btn">
            Load
          </button>
          <a
            href={SPLINE_COMMUNITY_FILE_URL}
            target="_blank"
            rel="noreferrer"
            className="spline-community-link"
          >
            Template <ExternalLink size={12} />
          </a>
          <button
            type="button"
            onClick={onSwitchToSomoCad}
            className="spline-back-cad-btn"
          >
            Back to iro
          </button>
        </form>
      </div>
    </div>
  );
};
