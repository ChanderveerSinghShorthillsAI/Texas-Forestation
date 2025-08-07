import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import GeoJsonLayer from './GeoJsonLayer';
import GridLayer from './GridLayer';
import LayerSelector from '../UI/LayerSelector';
import SpatialQueryResults from '../UI/SpatialQueryResults';
import SpatialQueryProgress from '../UI/SpatialQueryProgress';
import { useMapLayers } from '../../hooks/useMapLayers';
import { TEXAS_BOUNDS, GEOJSON_LAYERS } from '../../constants/geoJsonLayers';
import { gridService } from '../../services/gridService';
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
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onMapClick([lng, lat]); // Pass coordinates as [lng, lat] for GeoJSON compatibility
    }
  });
  return null;
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
  const [queryResults, setQueryResults] = useState(null);
  const [showQueryResults, setShowQueryResults] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryProgress, setQueryProgress] = useState(null);
  const [currentQueryId, setCurrentQueryId] = useState(null);
  
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
        <MapClickHandler onMapClick={handleMapClick} />
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

      {/* Spatial Query Progress */}
      <SpatialQueryProgress
        isVisible={isQuerying}
        progress={queryProgress}
        onAbort={handleAbortQuery}
        currentQuery={currentQueryId}
      />

      {/* Spatial Query Results Modal */}
      <SpatialQueryResults
        queryResults={queryResults}
        isVisible={showQueryResults}
        onClose={handleCloseQueryResults}
      />
    </div>
  );
};

export default TexasMap; 