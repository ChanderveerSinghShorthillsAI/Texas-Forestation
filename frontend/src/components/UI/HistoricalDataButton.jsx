import React from 'react';
import './HistoricalDataButton.css';

/**
 * Historical Data Button Component
 * Floating button to open historical fire data modal
 */
const HistoricalDataButton = ({ 
  onClick, 
  isActive = false, 
  isLoading = false,
  disabled = false 
}) => {
  return (
    <div className="historical-data-button-container">
      <button
        className={`historical-data-button ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={onClick}
        disabled={disabled || isLoading}
        title="View Historical Fire Data"
        aria-label="View Historical Fire Data"
      >
        <div className="historical-data-button-icon">
          {isLoading ? (
            <div className="historical-data-spinner">
              <div className="spinner-ring"></div>
            </div>
          ) : (
            <span className="icon">📊</span>
          )}
        </div>
        
        <div className="historical-data-button-content">
          <div className="historical-data-button-title">
            Historical Data
          </div>
          <div className="historical-data-button-subtitle">
            Fire Records
          </div>
        </div>

        {/* Active indicator */}
        {isActive && !isLoading && (
          <div className="historical-data-active-indicator">
            <div className="active-dot"></div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="historical-data-loading-overlay">
            <div className="loading-text">Loading...</div>
          </div>
        )}
      </button>

      {/* Tooltip for additional info */}
      <div className="historical-data-tooltip">
        <div className="tooltip-content">
          <div className="tooltip-title">📊 Historical Fire Data</div>
          <div className="tooltip-description">
            View historical records of Texas wildfires including:
          </div>
          <ul className="tooltip-list">
            <li>🔥 Deadliest fires</li>
            <li>💥 Most destructive fires</li>
            <li>📈 Wildfire statistics</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HistoricalDataButton;
