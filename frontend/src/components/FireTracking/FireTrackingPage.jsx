/**
 * Fire Tracking Page Component
 * Beautiful, modern, and stylish real-time fire tracking dashboard
 * Powered by NASA FIRMS (Fire Information for Resource Management System)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from 'react-leaflet';
import { 
  FaHome, 
  FaFire, 
  FaSatellite, 
  FaChartBar, 
  FaSync, 
  FaClock, 
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaBolt,
  FaMapMarkerAlt,
  FaThermometerFull
} from 'react-icons/fa';
import L from 'leaflet';
import FireLayer from '../Map/FireLayer';
import { fireTrackingService } from '../../services/fireTrackingService';
import { GEOJSON_LAYERS } from '../../constants/geoJsonLayers';
import './FireTrackingPage.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Texas center coordinates
const texasCenter = [31.0, -99.0];

// Texas bounds for map restrictions
const texasBounds = [
  [25.84, -106.65], // Southwest
  [36.50, -93.51]   // Northeast
];

/**
 * Build a "world-with-hole" feature from the Texas boundary GeoJSON
 * Creates a mask that darkens everything outside Texas
 */
function buildOutsideTexasMask(texasGeojson) {
  // Handle both FeatureCollection and single Feature formats
  let features = [];
  if (texasGeojson?.type === 'FeatureCollection' && texasGeojson?.features?.length) {
    features = texasGeojson.features;
  } else if (texasGeojson?.type === 'Feature' && texasGeojson?.geometry) {
    features = [texasGeojson];
  } else {
    return null;
  }

  // A world-size outer ring (lon, lat) that encloses the whole map
  const worldRing = [
    [-179.9999, -89.9999],
    [-179.9999,  89.9999],
    [ 179.9999,  89.9999],
    [ 179.9999, -89.9999],
    [-179.9999, -89.9999],
  ];

  // Collect all Texas rings (holes). Works for Polygon and MultiPolygon.
  const texasHoles = [];

  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;

    if (g.type === 'Polygon') {
      const outer = g.coordinates?.[0];
      if (outer && outer.length >= 4) texasHoles.push(outer);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) {
        const outer = poly?.[0];
        if (outer && outer.length >= 4) texasHoles.push(outer);
      }
    }
  }

  if (texasHoles.length === 0) {
    return null;
  }

  // One big polygon: outer = world, inners = all Texas outers (as holes)
  const maskFeature = {
    type: 'Feature',
    properties: { role: 'outside-texas-mask' },
    geometry: {
      type: 'Polygon',
      coordinates: [worldRing, ...texasHoles],
    },
  };
  
  return maskFeature;
}

/**
 * Outside Texas Mask Component
 * Darkens everything outside Texas boundaries
 */
const OutsideTexasMask = ({ texasGeojson, opacity = 0.65 }) => {
  const maskFeature = React.useMemo(() => {
    return buildOutsideTexasMask(texasGeojson);
  }, [texasGeojson]);
  
  if (!maskFeature) {
    return null;
  }

  return (
    <Pane name="outside-texas-mask" style={{ zIndex: 350, pointerEvents: 'none' }}>
      <GeoJSON
        data={maskFeature}
        interactive={false}
        style={{
          stroke: false,
          fillColor: '#000000',
          fillOpacity: opacity,
        }}
      />
    </Pane>
  );
};

/**
 * Texas Boundary Component
 * Displays darkened Texas boundary on map
 */
const TexasBoundary = ({ texasBoundaryData }) => {
  const map = useMap();

  useEffect(() => {
    if (!texasBoundaryData) {
      // Set default Texas bounds if no boundary data
      map.setMaxBounds(texasBounds);
      return;
    }

    try {
      // Fit map to Texas bounds
      const texasLayer = L.geoJSON(texasBoundaryData);
      const bounds = texasLayer.getBounds();
      
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 7
      });

      // Set max bounds to keep map focused on Texas
      const bufferedBounds = bounds.pad(0.1); // 10% buffer
      map.setMaxBounds(bufferedBounds);
    } catch (error) {
      console.error('Error setting Texas bounds:', error);
      map.setMaxBounds(texasBounds);
    }
  }, [map, texasBoundaryData]);

  if (!texasBoundaryData) return null;

  // Darkened boundary style matching other features
  const boundaryStyle = {
    fillColor: 'rgba(30, 60, 114, 0.05)', // Slight dark fill
    color: '#1e3c72', // Dark blue border
    weight: 3,
    opacity: 0.9,
    fillOpacity: 0.05,
    dashArray: '8, 4'
  };

  return (
    <GeoJSON
      data={texasBoundaryData}
      style={boundaryStyle}
      interactive={false}  // Make boundary non-interactive
    />
  );
};

const FireTrackingPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [selectedDataset, setSelectedDataset] = useState('VIIRS_NOAA20_NRT');
  const [selectedDays, setSelectedDays] = useState(1);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [fireData, setFireData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [texasBoundaryData, setTexasBoundaryData] = useState(null);

  /**
   * Load available datasets and Texas boundary on mount
   */
  useEffect(() => {
    loadDatasets();
    checkServiceHealth();
    loadTexasBoundary();
  }, []);

  /**
   * Load Texas boundary GeoJSON
   */
  const loadTexasBoundary = async () => {
    try {
      const boundaryLayer = GEOJSON_LAYERS.find(layer => layer.id === 'texas-boundary');
      
      if (boundaryLayer) {
        const boundaryUrl = `${process.env.PUBLIC_URL}/default_geojsons/${boundaryLayer.file}`;
        console.log('🗺️ Loading Texas boundary from:', boundaryUrl);
        
        const response = await fetch(boundaryUrl);
        if (response.ok) {
          const data = await response.json();
          setTexasBoundaryData(data);
          console.log('✅ Texas boundary loaded successfully');
        } else {
          console.error('❌ Failed to load Texas boundary:', response.status);
        }
      }
    } catch (err) {
      console.error('❌ Error loading Texas boundary:', err);
    }
  };

  /**
   * Load fire data when dataset or days change
   */
  useEffect(() => {
    loadFireData();
    loadStatistics();
  }, [selectedDataset, selectedDays]);

  /**
   * Auto-refresh every 5 minutes
   */
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing fire data...');
      loadFireData();
      loadStatistics();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedDataset, selectedDays]);

  /**
   * Check service health
   */
  const checkServiceHealth = async () => {
    try {
      const health = await fireTrackingService.getServiceHealth();
      setServiceHealth(health);
    } catch (err) {
      console.error('Health check failed:', err);
      setServiceHealth({ status: 'offline' });
    }
  };

  /**
   * Load available datasets
   */
  const loadDatasets = async () => {
    try {
      const result = await fireTrackingService.getAvailableDatasets();
      setAvailableDatasets(result.datasets || []);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  /**
   * Load fire data
   */
  const loadFireData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fireTrackingService.getTexasFireData(selectedDataset, selectedDays);
      setFireData(data);
      setLastUpdate(new Date());
      
      console.log(`✅ Loaded ${data.features.length} fire detections`);
    } catch (err) {
      console.error('Failed to load fire data:', err);
      setError(err.message || 'Failed to load fire data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load fire statistics
   */
  const loadStatistics = async () => {
    try {
      const stats = await fireTrackingService.getFireStatistics(selectedDataset, selectedDays);
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  /**
   * Handle manual refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fireTrackingService.clearServerCache();
      await loadFireData();
      await loadStatistics();
      console.log('✅ Refresh complete');
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle dataset change
   */
  const handleDatasetChange = (e) => {
    setSelectedDataset(e.target.value);
  };

  /**
   * Handle days change
   */
  const handleDaysChange = (e) => {
    setSelectedDays(parseInt(e.target.value));
  };

  /**
   * Format time for display
   */
  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * Get confidence color
   */
  const getConfidenceColor = (level) => {
    const colors = {
      'High': '#22c55e',
      'Medium': '#f59e0b',
      'Low': '#ef4444',
      'Very Low': '#dc2626'
    };
    return colors[level] || '#6b7280';
  };

  /**
   * Get intensity color
   */
  const getIntensityColor = (level) => {
    const colors = {
      'Very High': '#dc2626',
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#22c55e',
      'Very Low': '#16a34a'
    };
    return colors[level] || '#6b7280';
  };

  return (
    <div 
      className="fire-tracking-page"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/images/forest-fire-tracking-1.jpg)`
      }}
    >
      {/* Header */}
      <div className="fire-tracking-header">
        <div className="header-background-overlay"></div>
        
        <div className="header-content">
          <button 
            onClick={() => navigate('/home')}
            className="back-button"
            title="Back to main application"
          >
            <FaHome /> <span>Back to Main</span>
          </button>

          <div className="header-main">
            <div className="header-icon-wrapper">
              <FaFire className="header-fire-icon flickering" />
            </div>
            <div className="header-text">
              <h1>Texas Fire Tracking</h1>
              <p className="header-subtitle">
                <FaSatellite className="inline-icon" />
                Real-time Fire Detection powered by NASA FIRMS
              </p>
            </div>
          </div>

          <div className="header-status">
            {serviceHealth && (
              <div className={`service-status ${serviceHealth.status}`}>
                <div className="status-dot"></div>
                <span>Service: {serviceHealth.status}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="fire-tracking-main">
        {/* Control Panel */}
        <div className="fire-control-sidebar">
          <div className="control-panel">
            {/* Statistics Summary */}
            <div className="stats-summary-card">
              <div className="stats-header">
                <FaChartBar className="stats-icon" />
                <h3>Detection Statistics</h3>
              </div>
              
              {loading && !statistics ? (
                <div className="stats-loading">
                  <div className="spinner"></div>
                  <p>Loading statistics...</p>
                </div>
              ) : statistics ? (
                <>
                  <div className="total-detections">
                    <div className="detection-count">{statistics.total_detections}</div>
                    <div className="detection-label">Active Fire Detections</div>
                    <div className="detection-period">{statistics.time_period}</div>
                  </div>

                  {/* Confidence Breakdown */}
                  {statistics.confidence_breakdown && (
                    <div className="breakdown-section">
                      <div className="breakdown-title">
                        <FaCheckCircle className="breakdown-icon" />
                        Confidence Levels
                      </div>
                      <div className="breakdown-items">
                        {Object.entries(statistics.confidence_breakdown).map(([level, count]) => (
                          count > 0 && (
                            <div key={level} className="breakdown-item">
                              <div 
                                className="breakdown-indicator"
                                style={{ backgroundColor: getConfidenceColor(level) }}
                              ></div>
                              <span className="breakdown-label">{level}</span>
                              <span className="breakdown-count">{count}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intensity Breakdown */}
                  {statistics.intensity_breakdown && (
                    <div className="breakdown-section">
                      <div className="breakdown-title">
                        <FaThermometerFull className="breakdown-icon" />
                        Fire Intensity
                      </div>
                      <div className="breakdown-items">
                        {Object.entries(statistics.intensity_breakdown).map(([level, count]) => (
                          count > 0 && (
                            <div key={level} className="breakdown-item">
                              <div 
                                className="breakdown-indicator"
                                style={{ backgroundColor: getIntensityColor(level) }}
                              ></div>
                              <span className="breakdown-label">{level}</span>
                              <span className="breakdown-count">{count}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="stats-error">
                  <FaExclamationTriangle />
                  <p>Unable to load statistics</p>
                </div>
              )}
            </div>

            {/* Controls Card */}
            <div className="controls-card">
              <div className="control-section">
                <label className="control-label">
                  <FaSatellite className="label-icon" />
                  Satellite Dataset
                </label>
                <select 
                  className="control-select"
                  value={selectedDataset}
                  onChange={handleDatasetChange}
                >
                  {availableDatasets.map(dataset => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-section">
                <label className="control-label">
                  <FaClock className="label-icon" />
                  Time Period
                </label>
                <select 
                  className="control-select"
                  value={selectedDays}
                  onChange={handleDaysChange}
                >
                  <option value={1}>Last 24 hours</option>
                  <option value={2}>Last 2 days</option>
                  <option value={3}>Last 3 days</option>
                  <option value={7}>Last 7 days</option>
                </select>
              </div>

              <div className="control-section">
                <button 
                  className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <FaSync className={`refresh-icon ${refreshing ? 'spinning' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh Data'}
                </button>
                
                <div className="last-update">
                  <FaClock className="update-icon" />
                  Last updated: {formatTime(lastUpdate)}
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="info-card">
              <button 
                className="info-toggle"
                onClick={() => setShowInfo(!showInfo)}
              >
                <FaInfoCircle className="info-icon" />
                About Fire Tracking
              </button>
              
              {showInfo && (
                <div className="info-content">
                  <p>
                    Real-time fire detection data from NASA's Fire Information 
                    for Resource Management System (FIRMS).
                  </p>
                  
                  <div className="legend">
                    <div className="legend-title">Fire Marker Legend:</div>
                    <div className="legend-items">
                      <div className="legend-item">
                        <div className="legend-marker high-confidence"></div>
                        <span style={{color: "#ffd4a3"}}>High Confidence (80%+)</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-marker medium-confidence"></div>
                        <span style={{color: "#ffd4a3"}}>Medium (50-80%)</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-marker low-confidence"></div>
                        <span style={{color: "#ffd4a3"}}>Low (&lt;50%)</span>
                      </div>
                    </div>
                    <div className="legend-note">
                      <FaBolt className="note-icon" />
                      Marker size indicates fire intensity (FRP)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="fire-map-container">
          {error && (
            <div className="error-banner">
              <FaExclamationTriangle className="error-icon" />
              <span>{error}</span>
              <button 
                className="error-close"
                onClick={() => setError(null)}
              >
                <FaTimes />
              </button>
            </div>
          )}

          {loading && !fireData ? (
            <div className="map-loading-overlay">
              <div className="loading-content">
                <FaFire className="loading-fire-icon flickering" />
                <h3>Loading Fire Data...</h3>
                <p>Fetching real-time detections from NASA FIRMS</p>
                <div className="loading-spinner"></div>
              </div>
            </div>
          ) : (
            <MapContainer
              center={texasCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
              minZoom={5}
              maxZoom={18}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={18}
              />
              
              {/* Blackout outside Texas only (no effect inside) */}
              {texasBoundaryData && (
                <OutsideTexasMask 
                  texasGeojson={texasBoundaryData} 
                  opacity={0.65} 
                />
              )}
              
              {/* Texas Boundary - Darkened style */}
              <TexasBoundary texasBoundaryData={texasBoundaryData} />
              
              <Pane name="fire-markers" style={{ zIndex: 650 }}>
                <FireLayer
                  isVisible={true}
                  dataset={selectedDataset}
                  days={selectedDays}
                  onFireDataUpdate={(data) => {
                    if (data.totalDetections !== undefined) {
                      console.log(`Fire data updated: ${data.totalDetections} detections`);
                    }
                  }}
                  showPopups={true}
                />
              </Pane>
            </MapContainer>
          )}

          {/* Map Info Badge */}
          {fireData && (
            <div className="map-info-badge">
              <FaMapMarkerAlt className="badge-icon" />
              <span>{fireData.features.length} fire detections visible</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="fire-tracking-footer">
        <div className="footer-content">
          <div className="footer-info">
            <FaSatellite className="footer-icon" />
            <span>Powered by NASA FIRMS - Fire Information for Resource Management System</span>
          </div>
          <div className="footer-credits">
            <FaFire className="footer-fire-icon" />
            <span>Real-time Wildfire Monitoring for Texas</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FireTrackingPage;

 