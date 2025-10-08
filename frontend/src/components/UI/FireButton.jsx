import React from 'react';
import { useNavigate } from 'react-router-dom';
import './FireButton.css';

/**
 * Fire Button Component
 * Navigation button for fire tracking feature
 */
const FireButton = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/fire-tracking');
  };

  return (
    <button
      className="fire-button"
      onClick={handleClick}
      title="Open Fire Tracking Dashboard"
    >
      <div className="fire-button-content">
        <div className="fire-button-icon flickering">
          🔥
        </div>
        
        <div className="fire-button-text">
          <div className="fire-button-label">
            Fire Tracking
          </div>
        </div>
      </div>
    </button>
  );
};

export default FireButton;
