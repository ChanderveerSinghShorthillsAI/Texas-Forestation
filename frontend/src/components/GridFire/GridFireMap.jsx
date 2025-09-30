/**
 * Grid Fire Map Component
 * Displays fire risk data on an interactive map of Texas
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import gridFireService from '../../services/gridFireService';
import './GridFireMap.css';

const GridFireMap = ({ onGridCellClick }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [fireRiskLayer, setFireRiskLayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Configuration state
  const [riskThreshold, setRiskThreshold] = useState(40);
  const [showLowRisk, setShowLowRisk] = useState(false);
  const [mapStyle, setMapStyle] = useState('terrain');
  const [lastUpdate, setLastUpdate] = useState(null);

  /**
   * Initialize map
   */
  const initializeMap = useCallback(() => {
    if (!window.google || !mapRef.current) return;

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 31.0, lng: -100.0 }, // Center of Texas
        zoom: 6,
        mapTypeId: mapStyle,
        styles: [
          {
            featureType: "administrative.country",
            elementType: "geometry.stroke",
            stylers: [{ color: "#4b6878" }, { weight: 2 }]
          },
          {
            featureType: "administrative.province",
            elementType: "geometry.stroke",
            stylers: [{ color: "#4b6878" }, { weight: 1 }]
          }
        ]
      });

      setMap(mapInstance);
      setLoading(false);

    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, [mapStyle]);

  /**
   * Load fire risk data and display on map
   */
  const loadFireRiskData = useCallback(async () => {
    if (!map) return;

    try {
      setLoading(true);
      setError(null);

      // Clear existing layer
      if (fireRiskLayer) {
        fireRiskLayer.setMap(null);
      }

      // Fetch GeoJSON data
      const geoJsonData = await gridFireService.getFireRiskGeoJSON({
        riskThreshold: showLowRisk ? 0 : riskThreshold,
        formatType: 'simplified'
      });

      if (!geoJsonData.features || geoJsonData.features.length === 0) {
        setError('No fire risk data available');
        return;
      }

      // Create data layer
      const dataLayer = new window.google.maps.Data();
      
      // Add GeoJSON data
      dataLayer.addGeoJson(geoJsonData);

      // Style features based on risk score
      dataLayer.setStyle((feature) => {
        const riskScore = feature.getProperty('fire_risk_score');
        const riskCategory = feature.getProperty('risk_category');
        const riskColor = feature.getProperty('risk_color');

        return {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: getRiskMarkerSize(riskScore),
            fillColor: riskColor,
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 1,
            strokeOpacity: 0.9
          },
          title: `Risk: ${riskScore}% (${riskCategory})`
        };
      });

      // Add click listeners
      dataLayer.addListener('click', (event) => {
        const feature = event.feature;
        const gridIndex = feature.getProperty('grid_index');
        const riskScore = feature.getProperty('fire_risk_score');
        const riskCategory = feature.getProperty('risk_category');

        // Create info window content
        const infoContent = createInfoWindowContent(feature);
        
        const infoWindow = new window.google.maps.InfoWindow({
          content: infoContent,
          position: event.latLng
        });

        infoWindow.open(map);

        // Call parent callback if provided
        if (onGridCellClick) {
          onGridCellClick({
            gridIndex,
            riskScore,
            riskCategory,
            properties: feature.getProperty
          });
        }
      });

      // Set the layer on the map
      dataLayer.setMap(map);
      setFireRiskLayer(dataLayer);
      setLastUpdate(new Date());

      console.log(`Loaded ${geoJsonData.features.length} fire risk points on map`);

    } catch (err) {
      console.error('Error loading fire risk data:', err);
      setError(`Failed to load fire risk data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [map, riskThreshold, showLowRisk, onGridCellClick]);

  /**
   * Get marker size based on risk score
   */
  const getRiskMarkerSize = (riskScore) => {
    if (riskScore < 20) return 4;
    if (riskScore < 40) return 6;
    if (riskScore < 60) return 8;
    if (riskScore < 80) return 10;
    return 12;
  };

  /**
   * Create info window content for map markers
   */
  const createInfoWindowContent = (feature) => {
    const props = {
      grid_index: feature.getProperty('grid_index'),
      fire_risk_score: feature.getProperty('fire_risk_score'),
      risk_category: feature.getProperty('risk_category'),
      max_risk_24h: feature.getProperty('max_risk_24h'),
      avg_risk_24h: feature.getProperty('avg_risk_24h'),
      temperature: feature.getProperty('temperature'),
      humidity: feature.getProperty('humidity'),
      wind_speed: feature.getProperty('wind_speed'),
      forecast_time: feature.getProperty('forecast_time')
    };

    return `
      <div class="fire-risk-info-window">
        <h4>Grid Cell #${props.grid_index}</h4>
        <div class="risk-score-display">
          <span class="risk-score" style="color: ${feature.getProperty('risk_color')}">
            ${props.fire_risk_score}%
          </span>
          <span class="risk-category">${props.risk_category}</span>
        </div>
        <div class="risk-details">
          <div class="detail-row">
            <span class="label">24h Max:</span>
            <span class="value">${props.max_risk_24h}%</span>
          </div>
          <div class="detail-row">
            <span class="label">24h Avg:</span>
            <span class="value">${props.avg_risk_24h}%</span>
          </div>
          ${props.temperature ? `
            <div class="detail-row">
              <span class="label">Temperature:</span>
              <span class="value">${props.temperature}°C</span>
            </div>
          ` : ''}
          ${props.humidity ? `
            <div class="detail-row">
              <span class="label">Humidity:</span>
              <span class="value">${props.humidity}%</span>
            </div>
          ` : ''}
          ${props.wind_speed ? `
            <div class="detail-row">
              <span class="label">Wind Speed:</span>
              <span class="value">${props.wind_speed} km/h</span>
            </div>
          ` : ''}
        </div>
        <div class="update-time">
          Updated: ${props.forecast_time ? new Date(props.forecast_time).toLocaleString() : 'Unknown'}
        </div>
      </div>
    `;
  };

  /**
   * Handle map style change
   */
  const handleMapStyleChange = (newStyle) => {
    setMapStyle(newStyle);
    if (map) {
      map.setMapTypeId(newStyle);
    }
  };

  /**
   * Refresh map data
   */
  const refreshMapData = async () => {
    gridFireService.clearCache();
    await loadFireRiskData();
  };

  // Initialize map when component mounts
  useEffect(() => {
    const initMap = () => {
      if (window.google) {
        initializeMap();
      } else {
        // Wait for Google Maps to load
        const checkGoogleMaps = setInterval(() => {
          if (window.google) {
            clearInterval(checkGoogleMaps);
            initializeMap();
          }
        }, 100);

        // Cleanup interval after 10 seconds
        setTimeout(() => clearInterval(checkGoogleMaps), 10000);
      }
    };

    initMap();
  }, [initializeMap]);

  // Load fire risk data when map is ready
  useEffect(() => {
    if (map) {
      loadFireRiskData();
    }
  }, [map, loadFireRiskData]);

  // Auto-refresh data every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (map && !loading) {
        loadFireRiskData();
      }
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [map, loading, loadFireRiskData]);

  return (
    <div className="grid-fire-map">
      {/* Map Controls */}
      <div className="map-controls">
        <div className="control-group">
          <label htmlFor="risk-threshold-map">Risk Threshold:</label>
          <input
            id="risk-threshold-map"
            type="range"
            min="20"
            max="80"
            step="10"
            value={riskThreshold}
            onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
            className="risk-threshold-slider"
          />
          <span className="threshold-value">{riskThreshold}%</span>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showLowRisk}
              onChange={(e) => setShowLowRisk(e.target.checked)}
            />
            Show Low Risk Areas
          </label>
        </div>

        <div className="control-group">
          <label htmlFor="map-style">Map Style:</label>
          <select
            id="map-style"
            value={mapStyle}
            onChange={(e) => handleMapStyleChange(e.target.value)}
            className="map-style-select"
          >
            <option value="roadmap">Roadmap</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>

        <button 
          onClick={refreshMapData}
          disabled={loading}
          className="btn btn-refresh"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Map Status */}
      <div className="map-status">
        {loading && (
          <div className="status-item loading">
            <div className="loading-dot"></div>
            <span>Loading fire risk data...</span>
          </div>
        )}
        
        {error && (
          <div className="status-item error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {lastUpdate && !loading && !error && (
          <div className="status-item success">
            <span className="success-icon">✅</span>
            <span>Last updated: {lastUpdate.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="map-legend">
        <h4>Fire Risk Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#00ff00', width: '8px', height: '8px' }}></div>
            <span>Low (0-19%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#ffff00', width: '12px', height: '12px' }}></div>
            <span>Moderate (20-39%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#ff8000', width: '16px', height: '16px' }}></div>
            <span>High (40-59%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#ff0000', width: '20px', height: '20px' }}></div>
            <span>Very High (60-79%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#8b0000', width: '24px', height: '24px' }}></div>
            <span>Extreme (80-100%)</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="map-container"
        style={{ 
          height: '600px', 
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default GridFireMap;
