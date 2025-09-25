import React from 'react';
import './FireButton.css';

/**
 * Fire Button Component
 * Toggle button for fire tracking feature
 */
const FireButton = ({ 
  onClick, 
  isActive = false, 
  isLoading = false,
  disabled = false,
  fireCount = 0 
}) => {
  return (
    <button
      className={`fire-button ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      title={isActive ? 'Hide Fire Tracking' : 'Show Fire Tracking'}
    >
      <div className="fire-button-content">
        <div className={`fire-button-icon ${isActive ? 'flickering' : ''}`}>
          🔥
        </div>
        
        <div className="fire-button-text">
          <div className="fire-button-label">
            {isLoading ? 'Loading...' : 'Fire Tracking'}
          </div>
          
          {fireCount > 0 && (
            <div className="fire-button-count">
              {fireCount} active
            </div>
          )}
        </div>
      </div>
      
      {isActive && (
        <div className="fire-button-indicator">
          <div className="fire-button-pulse"></div>
        </div>
      )}
      
      {isLoading && (
        <div className="fire-button-spinner">
          <div className="fire-spinner"></div>
        </div>
      )}
    </button>
  );
};

export default FireButton;
