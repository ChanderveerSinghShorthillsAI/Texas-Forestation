import React, { useState, useEffect } from 'react';
import PlantationPlanGenerator from './PlantationPlanGenerator';
import './SpatialQueryResults.css';

/**
 * Component to display spatial query results for a clicked point
 */
const SpatialQueryResults = ({ queryResults, onClose, isVisible }) => {
  const [activeTab, setActiveTab] = useState('polygons');
  const [showPlanGenerator, setShowPlanGenerator] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  // Clear generated plan when query results change (new point clicked)
  useEffect(() => {
    if (queryResults) {
      setGeneratedPlan(null);
      setShowPlanGenerator(false);
    }
  }, [queryResults]);

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

  // Handle plan generation button click
  const handleGeneratePlan = () => {
    setShowPlanGenerator(true);
  };

  // Handle plan generation completion
  const handlePlanGenerated = (plan) => {
    setGeneratedPlan(plan);
    console.log('✅ Plan generated and received in SpatialQueryResults:', plan.plan_id);
  };

  // Handle closing plan generator
  const handleClosePlanGenerator = () => {
    setShowPlanGenerator(false);
  };

  // Calculate data availability for plan generation
  const totalDataPoints = polygonLayerCount + totalNearestPoints;
  const dataQuality = totalDataPoints > 10 ? 'excellent' : 
                     totalDataPoints > 5 ? 'good' : 
                     totalDataPoints > 2 ? 'fair' : 'limited';

  return (
    <>
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
            <strong style={{color: 'white'}}>📍 Clicked Location:</strong>
            <span className="coordinates">{clickCoordinates.formatted}</span>
          </div>

          {/* Plan Generation CTA */}
          <div className="plan-generation-cta">
            <div className="cta-content">
              <div className="cta-header">
                <h4>🌱 Generate Comprehensive 10-Year Plantation Plan</h4>
                <span className={`data-quality-badge ${dataQuality}`}>
                  Data Quality: {dataQuality.charAt(0).toUpperCase() + dataQuality.slice(1)}
                </span>
              </div>
              <p className="cta-description">
                Create a detailed, AI-powered plantation plan based on this location's spatial data. 
                Includes species recommendations, economic projections, employment estimates, 
                and environmental impact analysis.
              </p>
              
              

              {generatedPlan && (
                <div className="previous-plan-info">
                  <p style={{ color: 'white' }}>
                    ✅ <strong style={{ color: 'white' }}>Plan Generated:</strong> {generatedPlan.title}
                    <br />
                    <small style={{ color: 'white' }}>Generated: {new Date(generatedPlan.generated_at).toLocaleString()}</small>
                  </p>
                </div>
              )}
              
              <button 
                className="generate-plan-button"
                onClick={handleGeneratePlan}
                disabled={totalDataPoints === 0}
              >
                <span className="button-icon">🌱</span>
                <span className="button-text">
                  {generatedPlan ? 'Generate New Plan' : 'Generate 10-Year Plan'}
                </span>
                <span className="button-arrow">→</span>
              </button>
              
              {totalDataPoints === 0 && (
                <p className="cta-warning">
                  ⚠️ Limited spatial data available. Enable more map layers for better plan generation.
                </p>
              )}
            </div>
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
          
        </div>
      </div>

      {/* Plantation Plan Generator Modal */}
      <PlantationPlanGenerator
        spatialData={queryResults}
        isVisible={showPlanGenerator}
        onClose={handleClosePlanGenerator}
        onPlanGenerated={handlePlanGenerated}
      />
    </>
  );
};

export default SpatialQueryResults; 