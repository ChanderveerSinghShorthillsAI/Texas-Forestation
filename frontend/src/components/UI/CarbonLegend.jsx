import React from 'react';
import './CarbonLegend.css';

const CarbonLegend = ({ isVisible = false, onClose = null }) => {
  if (!isVisible) return null;

  // Get dynamic range for labels
  const thresholds = window.dynamicCarbonThresholds;
  const minValue = thresholds?.min || 0;
  const maxValue = thresholds?.max || 100000;

  // Format values for display
  const formatValue = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    } else {
      return value.toString();
    }
  };

  return (
    <div className="carbon-legend carbon-legend-compact" aria-label="Carbon density legend">
      <div className="legend-content">
        <div 
          className="gradient-bar"
          style={{
            background: 'linear-gradient(to right, #f5f5dc 0%, #dcebbe 20%, #b4d796 40%, #78b464 60%, #468c46 80%, #286432 100%)',
            height: '10px',
            width: '180px',
            borderRadius: '6px',
            border: '1px solid #a0d2a0',
            position: 'relative',
            marginBottom: '4px'
          }}
        />
        <div className="value-range" style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '180px',
          fontSize: '10px',
          color: '#666',
          fontWeight: 600
        }}>
          <span>{formatValue(minValue)}</span>
          <span>{formatValue(maxValue)}</span>
        </div>
      </div>
    </div>
  );
};

export default CarbonLegend;
