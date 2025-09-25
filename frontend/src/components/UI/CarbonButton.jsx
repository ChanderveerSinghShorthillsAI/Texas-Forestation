import React from 'react';
import './CarbonButton.css';

const CarbonButton = ({ onClick, isActive = false, disabled = false }) => {
  return (
    <button
      className={`carbon-button ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title="Texas Carbon Estimation - Analyze carbon stocks across Texas counties"
    >
      <span className="carbon-icon">🌲</span>
      <span className="carbon-text">Carbon Analysis</span>
      {isActive && <span className="active-indicator"></span>}
    </button>
  );
};

export default CarbonButton;
