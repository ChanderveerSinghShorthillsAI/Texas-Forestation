import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import GeoJsonLayer from './GeoJsonLayer';
import GridLayer from './GridLayer';
import LayerSelector from '../UI/LayerSelector';
import SpatialQueryResults from '../UI/SpatialQueryResults';
import SpatialQueryProgress from '../UI/SpatialQueryProgress';
import { geoJsonLayers } from '../../constants/geoJsonLayers';
import { useMapLayers } from '../../hooks/useMapLayers';
import { TEXAS_BOUNDS, GEOJSON_LAYERS } from '../../constants/geoJsonLayers';
import { gridService } from '../../services/gridService';
import { yoloResultsService } from '../../services/yoloResultsService';
import { backendSpatialQueryService } from '../../services/backendSpatialQuery';
import './TexasMap.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Texas center coordinates
const texasCenter = [31.0, -99.0];

// Simple bounds calculation - just like MapView.jsx
function getGeoJsonBounds(geojson) {
  if (!geojson || !geojson.features) return null;
  
  let coords = [];
  geojson.features.forEach((feature) => {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      coords.push(...geom.coordinates.flat());
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((polygon) => coords.push(...polygon.flat()));
    }
  });
  
  if (coords.length === 0) return null;
  
  let lats = coords.map((c) => c[1]);
  let lngs = coords.map((c) => c[0]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

// Build a polygon with Texas as a "hole" - masking everything outside Texas
function getMaskPolygon(texasGeoJson) {
  // World bounds
  const world = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180],
    [-90, -180],
  ];

  // Collect all Texas boundaries
  let holes = [];
  if (texasGeoJson && texasGeoJson.features) {
    texasGeoJson.features.forEach((feature) => {
      let geom = feature.geometry;
      if (geom.type === "Polygon") {
        holes.push(geom.coordinates[0].map(([lng, lat]) => [lat, lng]));
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((polygon) => {
          holes.push(polygon[0].map(([lng, lat]) => [lat, lng]));
        });
      }
    });
  }

  return [world, ...holes];
}

/**
 * Component to handle map click events for spatial queries
 */
const MapClickHandler = ({ onMapClick, gridData, yoloDataLoaded, setNonCultivableAlert }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      const clickCoords = [lng, lat];
      
      // Check if click is on a non-cultivable grid area (only if YOLO data is loaded)
      if (gridData && yoloDataLoaded) {
        const clickedGrid = findGridAtCoordinates(gridData, lng, lat);
        if (clickedGrid) {
          const gridIndex = clickedGrid.properties.index;
          const cultivability = yoloResultsService.getCultivability(gridIndex);
          
          if (cultivability === 0) {
            console.log(`🚫 Click blocked: Coordinates ${lng}, ${lat} are in non-cultivable grid ${gridIndex}`);
            
            // Show custom notification for non-cultivable grid
            setNonCultivableAlert({
              gridIndex,
              coordinates: { lat: lat.toFixed(6), lng: lng.toFixed(6) }
            });
            
            // Auto-hide the alert after 5 seconds
            setTimeout(() => {
              setNonCultivableAlert(null);
            }, 5000);
            
            return; // Don't trigger spatial query for black grids
          }
          
          console.log(`✅ Click allowed: Coordinates ${lng}, ${lat} are in cultivable grid ${gridIndex}`);
        }
      }
      
      console.log('🔍 Map clicked at:', clickCoords);
      onMapClick(clickCoords); // Only trigger for cultivable areas or areas without grid data
    }
  });
  return null;
};

/**
 * Helper function to find which grid contains the given coordinates
 */
const findGridAtCoordinates = (gridData, lng, lat) => {
  if (!gridData || !gridData.features) return null;
  
  // Check each grid cell to see if it contains the point
  for (const feature of gridData.features) {
    if (feature.geometry && feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0];
      if (isPointInPolygon(lng, lat, coords)) {
        return feature;
      }
    }
  }
  return null;
};

/**
 * Helper function to check if a point is inside a polygon
 */
const isPointInPolygon = (lng, lat, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i][1] > lat) !== (polygon[j][1] > lat)) &&
        (lng < (polygon[j][0] - polygon[i][0]) * (lat - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Main Texas Map Component with Grid Cells
 */
const TexasMap = () => {
  const mapRef = useRef();
  const [texasBoundaryData, setTexasBoundaryData] = useState(null);
  const [gridData, setGridData] = useState(null);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [gridStats, setGridStats] = useState(null);
  const [yoloStats, setYoloStats] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [showQueryResults, setShowQueryResults] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryProgress, setQueryProgress] = useState(null);
  const [currentQueryId, setCurrentQueryId] = useState(null);
  const [yoloDataLoaded, setYoloDataLoaded] = useState(false);
  const [nonCultivableAlert, setNonCultivableAlert] = useState(null); // New state for alert
  
  const {
    getActiveLayersData,
    toggleLayer,
    isLayerActive,
    isLayerLoading,
    getLayerError,
    clearAllLayers,
    getActiveLayerCount
  } = useMapLayers();

  // Load Texas boundary data on component mount
  useEffect(() => {
    const loadTexasBoundary = async () => {
      try {
        // Find the Texas boundary layer from our constants
        const boundaryLayer = GEOJSON_LAYERS.find(layer => layer.id === 'texas-boundary');
        if (boundaryLayer) {
          const response = await fetch(`/Texas_Geojsons/${boundaryLayer.file}`);
          if (response.ok) {
            const data = await response.json();
            setTexasBoundaryData(data);
          }
        }
      } catch (error) {
        console.error('Error loading Texas boundary:', error);
      }
    };

    loadTexasBoundary();
  }, []);

  // Load grid data on component mount
  useEffect(() => {
    const loadGridData = async () => {
      try {
        console.log('🔄 Loading Texas grid cells...');
        const gridCells = await gridService.loadGridCells();
        const geoJsonGrid = gridService.toGeoJSON(gridCells);
        const stats = gridService.getGridStats(gridCells);
        
        setGridData(geoJsonGrid);
        setGridStats(stats);
        
        console.log('📊 Grid statistics:', stats);
        
        // Also load YOLO results for statistics
        try {
          await yoloResultsService.loadYoloResults();
          const yoloStatistics = yoloResultsService.getStats();
          setYoloStats(yoloStatistics);
          setYoloDataLoaded(true); // Set state to true when YOLO data is loaded
          console.log('✅ YOLO statistics loaded successfully');
        } catch (error) {
          console.warn('⚠️ Could not load YOLO statistics:', error);
        }
      } catch (error) {
        console.error('❌ Failed to load grid data:', error);
      }
    };

    loadGridData();
  }, []);

  // Performance monitoring for spatial queries
  useEffect(() => {
    const logPerformanceStats = async () => {
      const stats = await backendSpatialQueryService.getCacheStats();
      console.log('🔧 Backend Spatial Query Stats:', stats);
    };

    // Log stats every 5 minutes
    const interval = setInterval(logPerformanceStats, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      // Clear cache on component unmount to free memory
      backendSpatialQueryService.clearCache();
    };
  }, []);

  const activeLayersData = getActiveLayersData();

  /**
   * Handle map clicks for progressive spatial queries
   */
  const handleMapClick = async (clickCoordinates) => {
    console.log('🔍 Map clicked at:', clickCoordinates);
    
    // Prevent multiple concurrent queries
    if (isQuerying) {
      console.log('Query already in progress, ignoring click');
      return;
    }
    
    // Start progressive query
    setIsQuerying(true);
    setQueryProgress({ processed: 0, total: 0 });
    setQueryResults(null);
    setShowQueryResults(true); // Show results panel immediately
    
    try {
      // Perform backend spatial query
      await backendSpatialQueryService.performSpatialQuery(
        clickCoordinates,
        // Progress callback
        (progress) => {
          setQueryProgress(progress);
        },
        // Results callback
        (results) => {
          setQueryResults(results);
        }
      );
      
      console.log('✅ Backend spatial query completed');
      
    } catch (error) {
      console.error('Progressive spatial query failed:', error);
    } finally {
      setIsQuerying(false);
      setQueryProgress(null);
    }
  };

  /**
   * Close query results
   */
  const handleCloseQueryResults = () => {
    setShowQueryResults(false);
    setQueryResults(null);
  };

  /**
   * Abort current spatial query
   */
  const handleAbortQuery = () => {
    backendSpatialQueryService.cancelQuery();
    setIsQuerying(false);
    setQueryProgress(null);
  };

  // Simple loading check - just like MapView.jsx
  if (!texasBoundaryData) {
    return (
      <div className="map-loading">
        <div className="spinner"></div>
        <span>Loading Texas Map...</span>
      </div>
    );
  }

  // Simple bounds calculation - just like MapView.jsx
  const texasBounds = texasBoundaryData && texasBoundaryData.features 
    ? getGeoJsonBounds(texasBoundaryData) 
    : null;

  return (
    <div className="texas-map-container">
      <MapContainer
        center={texasCenter}
        zoom={6.5}                                    // Simple fixed zoom - like MapView.jsx
        minZoom={6}                                   // Prevent too much zoom out - like MapView.jsx  
        style={{ height: '100vh', width: '100%' }}
        ref={mapRef}
        maxBounds={texasBounds}                       // Simple bounds restriction - like MapView.jsx
        maxBoundsViscosity={1.0}
        className="texas-map"
      >
        {/* Satellite imagery base layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
        />

        {/* Texas boundary outline */}
        {texasBoundaryData && (
          <GeoJSON
            data={texasBoundaryData}
            style={{
              fillColor: "transparent",
              color: "#3b82f6",
              weight: 3,
              fillOpacity: 0,
            }}
            interactive={false}
          />
        )}

        {/* Render Texas grid cells */}
        {gridData && (
          <GridLayer
            gridData={gridData}
            isVisible={isGridVisible}
          />
        )}

        {/* Render all active GeoJSON layers */}
        {activeLayersData.map((layerData) => (
          <GeoJsonLayer
            key={layerData.id}
            layerData={layerData}
          />
        ))}

        {/* Map click handler for spatial queries */}
        <MapClickHandler onMapClick={handleMapClick} gridData={gridData} yoloDataLoaded={yoloDataLoaded} setNonCultivableAlert={setNonCultivableAlert} />
      </MapContainer>

      {/* Layer control panel */}
      <LayerSelector
        isLayerActive={isLayerActive}
        isLayerLoading={isLayerLoading}
        toggleLayer={toggleLayer}
        getLayerError={getLayerError}
        clearAllLayers={clearAllLayers}
        getActiveLayerCount={getActiveLayerCount}
        getActiveLayersData={getActiveLayersData}
      />

      {/* Map info panel */}
      <div className="map-info">
        <div className="map-title">
          <h1>Texas GeoSpatial Explorer</h1>
          <p>Interactive satellite view with real terrain and trees</p>
          <p style={{ fontSize: '12px', color: '#059669', fontWeight: '500', margin: '8px 0 0 0' }}>
            💡 Click anywhere on the map for lightning-fast spatial analysis via backend API!
          </p>
        </div>
        <div className="active-layers-count">
          {activeLayersData.length} layer{activeLayersData.length !== 1 ? 's' : ''} active
        </div>
        
        {/* Grid Control */}
        {gridStats && (
          <div className="grid-control">
            <div className="grid-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isGridVisible}
                  onChange={(e) => setIsGridVisible(e.target.checked)}
                />
                <span>Show Grid ({gridStats.totalCells.toLocaleString()} cells)</span>
              </label>
            </div>
            <div className="grid-info">
              <div className="grid-stat">
                <span className="label">Cell Size:</span>
                <span className="value">
                  {gridStats.cellSize.widthKm.toFixed(2)} × {gridStats.cellSize.heightKm.toFixed(2)} km
                </span>
              </div>
              
              {/* YOLO Classification Statistics */}
              {yoloStats && (
                <div className="yolo-stats" style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: '600', 
                    color: '#0369a1', 
                    marginBottom: '4px' 
                  }}>
                    🤖 YOLO Classification Results:
                  </div>
                  <div style={{ fontSize: '10px', color: '#0369a1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ marginRight: '4px' }}>🌱</span>
                      <span style={{ flex: 1 }}>Cultivable:</span>
                      <span style={{ fontWeight: '600' }}>
                        {yoloStats.cultivable.toLocaleString()} ({yoloStats.cultivablePercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '4px' }}>🖤</span>
                      <span style={{ flex: 1 }}>Non-cultivable:</span>
                      <span style={{ fontWeight: '600' }}>
                        {yoloStats.nonCultivable.toLocaleString()} ({yoloStats.nonCultivablePercentage.toFixed(1)}%)
                      </span>
                                         </div>
                   </div>
                   
                   {/* Interaction Legend */}
                   <div style={{
                     marginTop: '6px',
                     padding: '4px 6px',
                     background: '#fefce8',
                     borderRadius: '4px',
                     border: '1px solid #fde047',
                     fontSize: '9px',
                     color: '#854d0e'
                   }}>
                     💡 <strong>Interaction:</strong> 🌱 Green grids are clickable, 🖤 Black grids are non-interactive
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Performance Controls */}
        <div className="performance-control" style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f0f9ff',
          borderRadius: '8px',
          borderLeft: '3px solid #0ea5e9'
        }}>
          <button
            onClick={() => backendSpatialQueryService.clearCache()}
            style={{
              background: '#0ea5e9',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%'
            }}
            title="Clear cache to free up memory"
          >
            🧹 Clear Spatial Cache
          </button>
          <div style={{
            fontSize: '10px',
            color: '#075985',
            marginTop: '4px',
            textAlign: 'center'
          }}>
            Use if queries become slow
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="custom-attribution">
        <p>Data sources: Texas state government & Esri satellite imagery</p>
      </div>

      {/* Stylish Center Loading Indicator with Blurred Background */}
      {isQuerying && (
        <div className="stylish-loading-overlay">
          <div className="stylish-loading-modal">
            <div className="stylish-loading-header">
              <div className="stylish-loading-icon">🔍</div>
              <h3 className="stylish-loading-title">Analyzing Location</h3>
              <p className="stylish-loading-subtitle">Processing spatial data layers...</p>
            </div>
            
            <div className="stylish-progress-container">
              <div className="stylish-progress-info">
                <span className="stylish-progress-text">
                  {queryProgress ? queryProgress.processed : 0} of {queryProgress ? queryProgress.total : 0} layers
                </span>
                <span className="stylish-progress-percentage">
                  {queryProgress ? Math.round((queryProgress.processed / queryProgress.total) * 100) : 0}%
                </span>
              </div>
              
              <div className="stylish-progress-bar">
                <div 
                  className="stylish-progress-fill"
                  style={{
                    width: queryProgress ? `${(queryProgress.processed / queryProgress.total) * 100}%` : '0%'
                  }}
                ></div>
                <div className="stylish-progress-glow"></div>
              </div>
              
              <div className="stylish-loading-dots">
                <div className="stylish-dot"></div>
                <div className="stylish-dot"></div>
                <div className="stylish-dot"></div>
              </div>
            </div>
            
            <button 
              className="stylish-cancel-button"
              onClick={handleAbortQuery}
              title="Cancel Analysis"
            >
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Spatial Query Results Modal */}
      <SpatialQueryResults
        queryResults={queryResults}
        isVisible={showQueryResults}
        onClose={handleCloseQueryResults}
      />

      {/* Non-cultivable area alert notification */}
      {nonCultivableAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2000,
          background: '#1f2937',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          border: '2px solid #374151',
          minWidth: '300px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '24px',
              flexShrink: 0,
              marginTop: '2px'
            }}>
              🖤
            </div>
            <div style={{
              flex: 1
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#f9fafb'
              }}>
                Non-Cultivable Area
              </div>
              <div style={{
                fontSize: '14px',
                lineHeight: '1.5',
                color: '#d1d5db',
                marginBottom: '8px'
              }}>
                Grid <strong>{nonCultivableAlert.gridIndex}</strong> is not suitable for cultivation.
              </div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                fontFamily: 'monospace'
              }}>
                📍 {nonCultivableAlert.coordinates.lat}°, {nonCultivableAlert.coordinates.lng}°
              </div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginTop: '4px'
              }}>
                Please select a 🌱 green area to perform spatial queries.
              </div>
            </div>
            <button
              onClick={() => setNonCultivableAlert(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                borderRadius: '4px',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.color = '#f9fafb'}
              onMouseOut={(e) => e.target.style.color = '#9ca3af'}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TexasMap; 