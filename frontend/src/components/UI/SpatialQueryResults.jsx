import React, { useState } from 'react';
import './SpatialQueryResults.css';

/**
 * Component to display spatial query results for a clicked point
 */
const SpatialQueryResults = ({ queryResults, onClose, isVisible }) => {
  const [activeTab, setActiveTab] = useState('polygons');

  if (!isVisible || !queryResults) return null;

  const {
    clickCoordinates,
    polygonData,
    nearestPoints,
    queryTimestamp
  } = queryResults;

  // Group polygon data by layer
  const groupedPolygons = {};
  polygonData.forEach(feature => {
    const layerName = feature.layerName || 'Unknown Layer';
    if (!groupedPolygons[layerName]) {
      groupedPolygons[layerName] = [];
    }
    
    // Extract meaningful properties
    const properties = {};
    if (feature.properties) {
      Object.entries(feature.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && 
            !['OBJECTID', 'objectid', 'FID', 'fid', 'SHAPE_LENG', 'SHAPE_AREA'].includes(key)) {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          properties[formattedKey] = value;
        }
      });
    }
    
    groupedPolygons[layerName].push({ properties });
  });

  // Group nearest points by layer
  const groupedPoints = {};
  nearestPoints.forEach(feature => {
    const layerName = feature.layerName || 'Unknown Layer';
    if (!groupedPoints[layerName]) {
      groupedPoints[layerName] = [];
    }
    
    // Extract meaningful properties
    const properties = {};
    if (feature.properties) {
      Object.entries(feature.properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && 
            !['OBJECTID', 'objectid', 'FID', 'fid', 'SHAPE_LENG', 'SHAPE_AREA'].includes(key)) {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          properties[formattedKey] = value;
        }
      });
    }
    
    groupedPoints[layerName].push({ 
      properties, 
      distance: feature.distance,
      distanceFormatted: feature.distanceFormatted 
    });
  });

  const polygonLayerCount = Object.keys(groupedPolygons).length;
  const pointLayerCount = Object.keys(groupedPoints).length;
  const totalNearestPoints = nearestPoints.length;

  return (
    <div className="spatial-query-overlay">
      <div className="spatial-query-panel">
        {/* Header */}
        <div className="query-header">
          <h3>📍 Location Query Results</h3>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Coordinates */}
        <div className="query-coordinates">
          <strong>📍 Clicked Location:</strong>
          <span className="coordinates">{clickCoordinates.formatted}</span>
        </div>

        {/* Tabs */}
        <div className="query-tabs">
          <button 
            className={`tab-button ${activeTab === 'polygons' ? 'active' : ''}`}
            onClick={() => setActiveTab('polygons')}
          >
            🗾 Coverage Data ({polygonLayerCount})
          </button>
          <button 
            className={`tab-button ${activeTab === 'points' ? 'active' : ''}`}
            onClick={() => setActiveTab('points')}
          >
            📍 Nearest Features ({totalNearestPoints})
          </button>
        </div>

        {/* Content */}
        <div className="query-content">
          {activeTab === 'polygons' && (
            <div className="polygon-results">
              {polygonLayerCount === 0 ? (
                <div className="no-results">
                  <p>🚫 No polygon layers cover this location.</p>
                  <p className="hint">Try clicking in a different area or enable more polygon layers.</p>
                </div>
              ) : (
                <div className="results-list">
                  <p className="results-summary">
                    This location is covered by <strong>{polygonLayerCount}</strong> layer{polygonLayerCount !== 1 ? 's' : ''}:
                  </p>
                  {Object.entries(groupedPolygons).map(([layerName, features]) => (
                    <div key={layerName} className="layer-group">
                      <h4 className="layer-title">🗾 {layerName}</h4>
                      {features.map((feature, index) => (
                        <div key={index} className="feature-properties">
                          {Object.keys(feature.properties).length === 0 ? (
                            <p className="no-properties">Location covered (no additional properties)</p>
                          ) : (
                            Object.entries(feature.properties).map(([key, value]) => (
                              <div key={key} className="property-row">
                                <span className="property-key">{key}:</span>
                                <span className="property-value">{String(value)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'points' && (
            <div className="point-results">
              {totalNearestPoints === 0 ? (
                <div className="no-results">
                  <p>🚫 No point features found within 50 km of this location.</p>
                  <p className="hint">Try enabling more point layers or clicking in a different area.</p>
                </div>
              ) : (
                <div className="results-list">
                  <p className="results-summary">
                    Found <strong>{totalNearestPoints}</strong> nearest feature{totalNearestPoints !== 1 ? 's' : ''}:
                  </p>
                  {Object.entries(groupedPoints).map(([layerName, features]) => (
                    <div key={layerName} className="layer-group">
                      <h4 className="layer-title">📍 {layerName}</h4>
                      {features.map((feature, index) => (
                        <div key={index} className="feature-properties distance-feature">
                          <div className="distance-badge">
                            📏 {feature.distanceFormatted}
                          </div>
                          {Object.keys(feature.properties).length === 0 ? (
                            <p className="no-properties">Feature found (no additional properties)</p>
                          ) : (
                            Object.entries(feature.properties).map(([key, value]) => (
                              <div key={key} className="property-row">
                                <span className="property-key">{key}:</span>
                                <span className="property-value">{String(value)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="query-footer">
          <small>
            ⏰ Query performed at {new Date(queryTimestamp).toLocaleTimeString()}
          </small>
          {queryResults?.isBackendQuery && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#dcfce7', borderRadius: '4px', fontSize: '11px' }}>
              ⚡ Backend query complete! Results from {queryResults?.processedLayers || 0} layers in {queryResults?.queryDurationMs ? Math.round(queryResults.queryDurationMs) : 0}ms.
            </div>
          )}
          {!queryResults?.isBackendQuery && !queryResults?.isComplete && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#f0f9ff', borderRadius: '4px', fontSize: '11px' }}>
              🔄 Loading results... ({queryResults?.processedLayers || 0} layers processed)
            </div>
          )}
          {!queryResults?.isBackendQuery && queryResults?.isComplete && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#dcfce7', borderRadius: '4px', fontSize: '11px' }}>
              ✅ Complete! Results from {queryResults?.processedLayers || 0} layers shown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpatialQueryResults; 