/**
 * Tour Guide Button Component
 * Beautiful floating button to trigger tour guide
 */

import React from 'react';
import { FaQuestionCircle, FaPlay } from 'react-icons/fa';
import './TourGuideButton.css';

const TourGuideButton = ({ onClick, position = 'bottom-right', tooltip = 'Start Tour Guide' }) => {
  const positionClasses = {
    'bottom-right': 'tour-btn-bottom-right',
    'bottom-left': 'tour-btn-bottom-left',
    'top-right': 'tour-btn-top-right',
    'top-left': 'tour-btn-top-left',
  };

  return (
    <button
      className={`tour-guide-button ${positionClasses[position]}`}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
    >
      <div className="tour-btn-icon-wrapper">
        <FaQuestionCircle className="tour-btn-icon" />
        {/* <FaPlay className="tour-btn-play-icon" /> */}
      </div>
      <span className="tour-btn-pulse"></span>
      <span className="tour-btn-pulse tour-btn-pulse-delay"></span>
    </button>
  );
};

export default TourGuideButton;

