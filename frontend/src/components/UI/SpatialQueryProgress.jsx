import React from 'react';
import './SpatialQueryProgress.css';

/**
 * Progress indicator for spatial queries
 */
const SpatialQueryProgress = ({ 
  isVisible, 
  progress, 
  onAbort,
  currentQuery 
}) => {
  if (!isVisible) return null;

  const {
    processed = 0,
    total = 0,
    currentLayer = '',
    polygonCount = 0,
    pointCount = 0
  } = progress || {};

  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="spatial-query-progress-overlay">
      <div className="spatial-query-progress-panel">
        {/* Header */}
        <div className="progress-header">
          <h3>🔍 Analyzing Spatial Data...</h3>
          <button 
            className="abort-button" 
            onClick={onAbort}
            title="Cancel Query"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="progress-text">
            {percentage}% ({processed}/{total} layers)
          </div>
        </div>

        {/* Current Status */}
        <div className="progress-status">
          {currentLayer && (
            <div className="current-layer">
              📄 Processing: <strong>{currentLayer}</strong>
            </div>
          )}
          
          <div className="progress-stats">
            <div className="stat">
              <span className="stat-icon">🗾</span>
              <span className="stat-label">Coverage Areas:</span>
              <span className="stat-value">{polygonCount}</span>
            </div>
            <div className="stat">
              <span className="stat-icon">📍</span>
              <span className="stat-label">Nearby Features:</span>
              <span className="stat-value">{pointCount}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="progress-info">
          <p>Querying spatial database...</p>
          <small>
            Using optimized backend with spatial indexing for ultra-fast results!
          </small>
        </div>
      </div>
    </div>
  );
};

export default SpatialQueryProgress; 