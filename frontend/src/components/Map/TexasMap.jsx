import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {FaSpinner} from 'react-icons/fa';

import GeoJsonLayer from './GeoJsonLayer';
import GridLayer from './GridLayer';
import LayerSelector from '../UI/LayerSelector';
import SpatialQueryResults from '../UI/SpatialQueryResults';
import SpatialQueryProgress from '../UI/SpatialQueryProgress';
import CarbonEstimationPanel from '../UI/CarbonEstimationPanel';
import CarbonButton from '../UI/CarbonButton';
import LoadingOptimizer from '../UI/LoadingOptimizer';
import { geoJsonLayers } from '../../constants/geoJsonLayers';
import { useMapLayers } from '../../hooks/useMapLayers';
import { TEXAS_BOUNDS, GEOJSON_LAYERS } from '../../constants/geoJsonLayers';
import { gridService } from '../../services/gridService';
import { yoloResultsService } from '../../services/yoloResultsService';
import { backendSpatialQueryService } from '../../services/backendSpatialQuery';
import { carbonEstimationService } from '../../services/carbonEstimationService';
import { performanceMonitor } from '../../services/performanceMonitor';
import './TexasMap.css';
import './TexasMapOptimized.css';
import CarbonVisualizationLayer from '../UI/CarbonVisualizationLayer';
import CarbonLegend from '../UI/CarbonLegend';
import FireLayer from './FireLayer';
import FireButton from '../UI/FireButton';
import FireControlPanel from '../UI/FireControlPanel';
import WildfireLayer from './WildfireLayer';
import WildfireButton from '../UI/WildfireButton';
import WildfireControlPanel from '../UI/WildfireControlPanel';
import USGSWildfireButton from '../UI/USGSWildfireButton';
import HistoricalDataButton from '../UI/HistoricalDataButton';
import HistoricalDataModal from '../UI/HistoricalDataModal';

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



/**
 * Component to track map events (zoom, pan) for carbon layer visibility
 */
const MapEventTracker = ({ setCurrentZoom, setMapBounds }) => {
  const map = useMap();
  
  useMapEvents({
    zoom: () => {
      setCurrentZoom(map.getZoom());
      setMapBounds(map.getBounds());
    },
    moveend: () => {
      setMapBounds(map.getBounds());
    }
  });
  
  // Initialize bounds on mount
  useEffect(() => {
    setCurrentZoom(map.getZoom());
    setMapBounds(map.getBounds());
  }, [map, setCurrentZoom, setMapBounds]);
  
  return null;
};

/**
 * Component to handle map click events for spatial queries
 */
const MapClickHandler = ({ 
  onMapClick, 
  gridData, 
  yoloDataLoaded, 
  setNonCultivableAlert,
  texasBoundaryData,
  setOutsideTexasAlert 
}) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      const clickCoords = [lng, lat];
      
      console.log(`🖱️ Map click detected at: [${lng}, ${lat}]`);
      
      // STEP 1: Check if click is within Texas boundary (highest priority)
      const isInTexas = isPointInTexasBoundary(lng, lat, texasBoundaryData);
      
      if (!isInTexas) {
        console.log(`🚫 Click BLOCKED: Outside Texas boundary at [${lng}, ${lat}]`);
        
        // Show alert for clicking outside Texas
        setOutsideTexasAlert({
          coordinates: { 
            lat: lat.toFixed(6), 
            lng: lng.toFixed(6) 
          }
        });
        
        // Auto-hide the alert after 5 seconds
        setTimeout(() => {
          setOutsideTexasAlert(null);
        }, 5000);
        
        return; // Block the click - don't proceed with any query
      }
      
      console.log(`✅ Click is INSIDE Texas boundary at [${lng}, ${lat}]`);
      
      // STEP 2: Check if click is on a non-cultivable grid area (only if YOLO data is loaded)
      if (gridData && yoloDataLoaded) {
        const clickedGrid = findGridAtCoordinates(gridData, lng, lat);
        if (clickedGrid) {
          const gridIndex = clickedGrid.properties.index;
          const cultivability = yoloResultsService.getCultivability(gridIndex);
          
          if (cultivability === 0) {
            console.log(`🚫 Click BLOCKED: Non-cultivable grid ${gridIndex} at [${lng}, ${lat}]`);
            
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
          
          console.log(`✅ Click in cultivable grid ${gridIndex} at [${lng}, ${lat}]`);
        }
      }
      
      // STEP 3: All checks passed - proceed with spatial query
      console.log(`🔍 Proceeding with spatial query at [${lng}, ${lat}]`);
      onMapClick(clickCoords);
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
 * Helper function to check if a point is inside a polygon using ray-casting algorithm
 * @param {number} lng - Longitude of the point
 * @param {number} lat - Latitude of the point
 * @param {Array} polygon - Array of [lng, lat] coordinates
 * @returns {boolean} - True if point is inside polygon
 */
const isPointInPolygon = (lng, lat, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
                     (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Check if a point is within Texas boundary
 * Handles Polygon and MultiPolygon geometries with holes
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude  
 * @param {Object} texasBoundaryData - Texas boundary GeoJSON
 * @returns {boolean} - True if point is within Texas
 */
const isPointInTexasBoundary = (lng, lat, texasBoundaryData) => {
  if (!texasBoundaryData) {
    console.warn('⚠️ Texas boundary data not available');
    return true; // Allow clicks if boundary data is not loaded yet
  }

  // Handle both FeatureCollection and single Feature
  let features = [];
  if (texasBoundaryData.type === 'FeatureCollection' && texasBoundaryData.features) {
    features = texasBoundaryData.features;
  } else if (texasBoundaryData.type === 'Feature' && texasBoundaryData.geometry) {
    features = [texasBoundaryData];
  } else {
    console.warn('⚠️ Invalid Texas boundary data format');
    return true; // Allow clicks if data format is unexpected
  }

  // Check each feature
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      // Check outer ring (index 0)
      const outerRing = geometry.coordinates[0];
      if (isPointInPolygon(lng, lat, outerRing)) {
        // Point is in outer ring, now check if it's in any holes (inner rings)
        let inHole = false;
        for (let i = 1; i < geometry.coordinates.length; i++) {
          if (isPointInPolygon(lng, lat, geometry.coordinates[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) {
          return true; // Point is in Texas
        }
      }
    } else if (geometry.type === 'MultiPolygon') {
      // Check each polygon in the MultiPolygon
      for (const polygonCoords of geometry.coordinates) {
        const outerRing = polygonCoords[0];
        if (isPointInPolygon(lng, lat, outerRing)) {
          // Check if point is in any holes
          let inHole = false;
          for (let i = 1; i < polygonCoords.length; i++) {
            if (isPointInPolygon(lng, lat, polygonCoords[i])) {
              inHole = true;
              break;
            }
          }
          if (!inHole) {
            return true; // Point is in Texas
          }
        }
      }
    }
  }

  return false; // Point is not in any Texas polygon
};

// Build a "world-with-hole" feature from the Texas boundary GeoJSON
function buildOutsideTexasMask(texasGeojson) {
  console.log('🎭 buildOutsideTexasMask called with:', texasGeojson);
  
  // Handle both FeatureCollection and single Feature formats
  let features = [];
  if (texasGeojson?.type === 'FeatureCollection' && texasGeojson?.features?.length) {
    features = texasGeojson.features;
    console.log('🎭 Found FeatureCollection with', features.length, 'features');
  } else if (texasGeojson?.type === 'Feature' && texasGeojson?.geometry) {
    features = [texasGeojson];
    console.log('🎭 Found single Feature, converting to array');
  } else {
    console.log('🎭 No valid features found in texasGeojson');
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
      // g.coordinates = [outer, hole1, hole2, ...]
      // We want to cut **everything within the Texas outer ring(s)** out of the mask.
      // Use ONLY the outer ring for the "hole". Ignore any internal holes inside Texas polygons.
      const outer = g.coordinates?.[0];
      if (outer && outer.length >= 4) texasHoles.push(outer);
    } else if (g.type === 'MultiPolygon') {
      // g.coordinates = [ [polygon1Rings], [polygon2Rings], ... ]
      for (const poly of g.coordinates || []) {
        const outer = poly?.[0];
        if (outer && outer.length >= 4) texasHoles.push(outer);
      }
    }
  }

  console.log('🎭 Extracted', texasHoles.length, 'Texas holes');
  if (texasHoles.length === 0) {
    console.log('🎭 No Texas holes found, cannot create mask');
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
  
  console.log('🎭 Successfully created mask feature with', maskFeature.geometry.coordinates.length, 'coordinate rings');
  return maskFeature;
}

// Lightweight component to render the mask in its own pane
const OutsideTexasMask = ({ texasGeojson, opacity = 0.6 }) => {
  console.log('🎭 OutsideTexasMask called with texasGeojson:', texasGeojson);
  const maskFeature = React.useMemo(() => {
    console.log('🎭 Building mask feature...');
    const result = buildOutsideTexasMask(texasGeojson);
    console.log('🎭 Mask feature result:', result);
    return result;
  }, [texasGeojson]);
  
  if (!maskFeature) {
    console.log('🎭 No mask feature generated, returning null');
    return null;
  }
  
  console.log('🎭 Rendering OutsideTexasMask with opacity:', opacity);

  return (
    // Pane above base tiles, below your overlays
    <Pane name="outside-texas-mask" style={{ zIndex: 350, pointerEvents: 'none' }}>
      <GeoJSON
        data={maskFeature}
        interactive={false}
        style={{
          stroke: false,
          fillColor: '#000000',
          fillOpacity: opacity, // tweak as you like (e.g., 0.5–0.75)
        }}
        // Important: pointerEvents none so inside-Texas interactions remain perfect
      />
    </Pane>
  );
};

/**
 * Main Texas Map Component with Grid Cells
 */
const TexasMap = ({ onInitializationChange }) => {
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
  const [outsideTexasAlert, setOutsideTexasAlert] = useState(null); // Alert for clicks outside Texas
  
  // Carbon estimation states
  const [showCarbonPanel, setShowCarbonPanel] = useState(false);
  const [selectedCountyForCarbon, setSelectedCountyForCarbon] = useState(null);
  const [countyLayerData, setCountyLayerData] = useState(null);
  const [isCountyColorVisible, setIsCountyColorVisible] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(5.8);
  const [mapBounds, setMapBounds] = useState(null);
  
  // Fire tracking states
  const [showFireLayer, setShowFireLayer] = useState(false);
  const [showFirePanel, setShowFirePanel] = useState(false);
  const [fireDataset, setFireDataset] = useState('VIIRS_NOAA20_NRT');
  const [fireDays, setFireDays] = useState(1);
  const [fireData, setFireData] = useState(null);
  const [isLoadingFire, setIsLoadingFire] = useState(false);
  
  // Wildfire prediction states
  const [showWildfireLayer, setShowWildfireLayer] = useState(false);
  const [showWildfirePanel, setShowWildfirePanel] = useState(false);
  const [wildfireData, setWildfireData] = useState(null);
  const [wildfireMapData, setWildfireMapData] = useState(null);
  const [selectedWildfirePoint, setSelectedWildfirePoint] = useState(null);
  
  // Historical data states
  const [showHistoricalData, setShowHistoricalData] = useState(false);
  
  // Layer selector state
  const [isLayerSelectorOpen, setIsLayerSelectorOpen] = useState(false);
  
  // Loading optimization states
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState({
    boundaries: false,
    grid: false,
    layers: false,
    services: false
  });
  
  const {
    getActiveLayersData,
    toggleLayer,
    isLayerActive,
    isLayerLoading,
    getLayerError,
    clearAllLayers,
    getActiveLayerCount
  } = useMapLayers();

  // Optimized sequential loading to prevent overwhelming the browser
  useEffect(() => {
    // Notify parent that initialization is starting
    if (onInitializationChange) {
      onInitializationChange(true);
    }

    const initializeMapComponents = async () => {
      try {
        // Start performance tracking
        performanceMonitor.startTracking('total_init', 'Total Map Initialization');
        
        // Get optimization recommendations
        const optimization = performanceMonitor.getOptimizationRecommendations();
        console.log('🔧 Using optimization config:', optimization.suggestedConfig);
        
        // Update loading progress
        if (window.updateLoadingTask) {
          window.updateLoadingTask('boundaries', { status: 'in-progress', progress: 0 });
        }

        // 1. Load Texas boundary data first (essential for map bounds)
        console.log('🗺️ Step 1: Loading Texas boundaries...');
        const boundaryLayer = GEOJSON_LAYERS.find(layer => layer.id === 'texas-boundary');
        console.log('🔍 Found boundary layer:', boundaryLayer);
        
        if (boundaryLayer) {
          const boundaryUrl = `/Texas_Geojsons/Texas_Geojsons/${boundaryLayer.file}`;
          console.log('📡 Fetching boundary from:', boundaryUrl);
          
          try {
            const response = await fetch(boundaryUrl);
            console.log('📡 Boundary response status:', response.status, response.statusText);
            
            if (response.ok) {
              const data = await response.json();
              console.log('✅ Boundary data loaded successfully:', data);
              setTexasBoundaryData(data);
              setLoadingTasks(prev => ({ ...prev, boundaries: true }));
              
              if (window.updateLoadingTask) {
                window.updateLoadingTask('boundaries', { status: 'completed', progress: 100 });
                window.updateLoadingTask('grid', { status: 'in-progress', progress: 0 });
              }
            } else {
              console.error('❌ Failed to load boundary data - HTTP', response.status, response.statusText);
            }
          } catch (error) {
            console.error('❌ Error fetching boundary data:', error);
          }
        } else {
          console.error('❌ No texas-boundary layer found in GEOJSON_LAYERS');
        }

        // 2. Small delay to prevent browser freeze
        await new Promise(resolve => setTimeout(resolve, 100));

        // 3. Load grid data (can be large, so we track progress)
        console.log('📊 Step 2: Loading grid system...');
        try {
          const gridCells = await gridService.loadGridCells();
          const geoJsonGrid = gridService.toGeoJSON(gridCells);
          const stats = gridService.getGridStats(gridCells);
          
          setGridData(geoJsonGrid);
          setGridStats(stats);
          setLoadingTasks(prev => ({ ...prev, grid: true }));
          
          if (window.updateLoadingTask) {
            window.updateLoadingTask('grid', { status: 'completed', progress: 100 });
            window.updateLoadingTask('services', { status: 'in-progress', progress: 0 });
          }

          console.log('✅ Grid system loaded successfully');
        } catch (error) {
          console.warn('⚠️ Grid system failed to load, continuing without it:', error);
          setLoadingTasks(prev => ({ ...prev, grid: true })); // Continue anyway
          
          if (window.updateLoadingTask) {
            window.updateLoadingTask('grid', { status: 'completed', progress: 100 });
            window.updateLoadingTask('services', { status: 'in-progress', progress: 0 });
          }
        }

        // 4. Another small delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // 5. Load YOLO results (optional, non-blocking)
        console.log('🤖 Step 3: Loading YOLO statistics...');
        try {
          await yoloResultsService.loadYoloResults();
          const yoloStatistics = yoloResultsService.getStats();
          setYoloStats(yoloStatistics);
          setYoloDataLoaded(true);
          console.log('✅ YOLO statistics loaded successfully');
        } catch (error) {
          console.warn('⚠️ YOLO statistics unavailable, continuing without them:', error);
        }
        
        setLoadingTasks(prev => ({ ...prev, services: true }));
        
        if (window.updateLoadingTask) {
          window.updateLoadingTask('services', { status: 'completed', progress: 100 });
          window.updateLoadingTask('layers', { status: 'completed', progress: 100 });
        }

        // 6. Final delay before showing the map
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Stop performance tracking and log results
        performanceMonitor.stopTracking('total_init');
        performanceMonitor.logSummary();
        
        console.log('🎉 Map initialization complete!');
        setIsInitializing(false);
        // Notify parent that initialization is complete
        if (onInitializationChange) {
          onInitializationChange(false);
        }

      } catch (error) {
        console.error('❌ Map initialization failed:', error);
        setIsInitializing(false); // Show map anyway with limited functionality
        // Notify parent that initialization is complete (even if failed)
        if (onInitializationChange) {
          onInitializationChange(false);
        }
      }
    };

    // Mark auth as completed when this component loads
    if (window.updateLoadingTask) {
      window.updateLoadingTask('auth', { status: 'completed', progress: 100 });
    }

    // Start the initialization sequence
    initializeMapComponents();
  }, []);

  // Load counties GeoJSON for CarbonVisualizationLayer (from configured layers)
  useEffect(() => {
    const initCountyLayer = async () => {
      try {
        const countyLayer = GEOJSON_LAYERS.find(layer => layer.id === 'counties');
        if (!countyLayer) return;
        const response = await fetch(`/Texas_Geojsons/Texas_Geojsons/${countyLayer.file}`);
        if (response.ok) {
          const data = await response.json();
          setCountyLayerData(data);
        }
      } catch (e) {
        console.warn('Failed to load counties GeoJSON for CarbonVisualizationLayer:', e?.message);
      }
    };
    initCountyLayer();
  }, []);

  // Keep carbon layer always visible - region-specific hiding is now handled in CarbonVisualizationLayer
  useEffect(() => {
    setIsCountyColorVisible(true); // Always keep the layer enabled, regional hiding is handled per-feature
  }, []);

  // Remove the separate grid loading effect - now handled in the main initialization

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
          // Also check for county information for carbon analysis
          extractCountyFromQuery(results);
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

  /**
   * Handle carbon button click
   */
  const handleCarbonButtonClick = () => {
    setShowCarbonPanel(!showCarbonPanel);
  };

  /**
   * Handle county selection for carbon analysis
   */
  const handleCountySelection = (countyName) => {
    setSelectedCountyForCarbon(countyName);
    // Optionally, you could also trigger a map zoom to the county here
  };

  /**
   * Extract county name from clicked features
   */
  const extractCountyFromQuery = (queryResults) => {
    if (!queryResults || !queryResults.polygon_matches) return null;

    // Look for county-related matches
    const countyMatches = queryResults.polygon_matches.filter(match => 
      match.layer_name && (
        match.layer_name.toLowerCase().includes('county') ||
        match.layer_name.toLowerCase().includes('counties')
      )
    );

    if (countyMatches.length > 0) {
      const countyName = carbonEstimationService.extractCountyName(countyMatches[0]);
      if (countyName) {
        setSelectedCountyForCarbon(countyName);
        if (showCarbonPanel) {
          // Panel is already open, county will update automatically
        }
      }
    }
  };

  /**
   * Note: Fire button now navigates to separate Fire Tracking page
   * Fire layer functionality has been moved to /fire-tracking route
   */

  /**
   * Handle wildfire button toggle
   */
  const handleWildfireToggle = (isActive) => {
    setShowWildfireLayer(isActive);
    if (isActive) {
      // When enabling wildfire layer, also show the control panel
      setShowWildfirePanel(true);
    } else {
      // Clear selected point when disabling
      setSelectedWildfirePoint(null);
    }
  };

  /**
   * Handle wildfire data load from button
   */
  const handleWildfireDataLoad = (data) => {
    setWildfireData(data.rawData);
    setWildfireMapData(data.mapData);
  };

  /**
   * Handle wildfire location selection
   */
  const handleWildfireLocationSelect = (location) => {
    console.log('🔥 Wildfire location selected:', location);
    setSelectedWildfirePoint(location);
    // Ensure panel is open when a location is selected
    if (!showWildfirePanel) {
      console.log('🔥 Opening wildfire panel for selected location');
      setShowWildfirePanel(true);
    }
  };

  /**
   * Handle wildfire panel close
   */
  const handleWildfirePanelClose = () => {
    setShowWildfirePanel(false);
    setSelectedWildfirePoint(null);
  };

  /**
   * Handle fire panel close
   */
  const handleFirePanelClose = () => {
    setShowFirePanel(false);
  };

  /**
   * Handle fire dataset change
   */
  const handleFireDatasetChange = (dataset) => {
    setFireDataset(dataset);
  };

  /**
   * Handle fire days change
   */
  const handleFireDaysChange = (days) => {
    setFireDays(days);
  };

  /**
   * Handle fire data update from FireLayer
   */
  const handleFireDataUpdate = useCallback((data) => {
    setFireData(data);
  }, []);

  /**
   * Handle fire data refresh
   */
  const handleFireRefresh = async () => {
    setIsLoadingFire(true);
    // The FireLayer will handle the actual refresh
    // This is just to show loading state
    setTimeout(() => {
      setIsLoadingFire(false);
    }, 2000);
  };

  /**
   * Handle historical data button click
   */
  const handleHistoricalDataClick = () => {
    setShowHistoricalData(!showHistoricalData);
  };

  /**
   * Handle historical data modal close
   */
  const handleHistoricalDataClose = () => {
    setShowHistoricalData(false);
  };

  // Show professional loading screen during initialization
  if (isInitializing) {
    return (
      // <div style={{
      //   position: 'fixed',
      //   top: 0,
      //   left: 0,
      //   right: 0,
      //   bottom: 0,
      //   display: 'flex',
      //   flexDirection: 'column',
      //   justifyContent: 'center',
      //   alignItems: 'center',
      //   background: '#2d5016',
      //   zIndex: 9999
      // }}>
      //   {/* Animated logo/icon container */}
      //   <div style={{
      //     position: 'relative',
      //     marginBottom: '40px'
      //   }}>
      //     {/* Outer rotating ring */}
      //     <div style={{
      //       position: 'absolute',
      //       top: '50%',
      //       left: '50%',
      //       transform: 'translate(-50%, -50%)',
      //       width: '120px',
      //       height: '120px',
      //       border: '4px solid rgba(255, 255, 255, 0.2)',
      //       borderTop: '4px solid #fff',
      //       borderRadius: '50%',
      //       animation: 'spin 1.5s linear infinite'
      //     }}></div>
          
      //     {/* Inner pulsing circle */}
      //     <div style={{
      //       position: 'relative',
      //       width: '100px',
      //       height: '100px',
      //       background: 'rgba(255, 255, 255, 0.95)',
      //       borderRadius: '50%',
      //       display: 'flex',
      //       alignItems: 'center',
      //       justifyContent: 'center',
      //       boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
      //       animation: 'pulse 2s ease-in-out infinite'
      //     }}>
      //       <span style={{
      //         fontSize: '48px',
      //         animation: 'float 3s ease-in-out infinite'
      //       }}>
      //         🌲
      //       </span>
      //     </div>
      //   </div>

      //   {/* Loading text */}
      //   <div style={{
      //     textAlign: 'center',
      //     color: '#fff'
      //   }}>
      //     <h1 style={{
      //       fontSize: '42px',
      //       fontWeight: '700',
      //       margin: '0 0 16px 0',
      //       textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
      //       letterSpacing: '1px'
      //     }}>
      //       Loading...
      //     </h1>
          
      //     <p style={{
      //       fontSize: '18px',
      //       fontWeight: '400',
      //       margin: '0 0 30px 0',
      //       opacity: 0.9,
      //       textShadow: '0 1px 10px rgba(0, 0, 0, 0.2)'
      //     }}>
      //       Initializing Texas Forestation System
      //     </p>

      //     {/* Animated dots */}
      //     <div style={{
      //       display: 'flex',
      //       justifyContent: 'center',
      //       gap: '12px',
      //       marginTop: '20px'
      //     }}>
      //       <div style={{
      //         width: '12px',
      //         height: '12px',
      //         background: '#fff',
      //         borderRadius: '50%',
      //         animation: 'bounce 1.4s ease-in-out infinite',
      //         animationDelay: '0s'
      //       }}></div>
      //       <div style={{
      //         width: '12px',
      //         height: '12px',
      //         background: '#fff',
      //         borderRadius: '50%',
      //         animation: 'bounce 1.4s ease-in-out infinite',
      //         animationDelay: '0.2s'
      //       }}></div>
      //       <div style={{
      //         width: '12px',
      //         height: '12px',
      //         background: '#fff',
      //         borderRadius: '50%',
      //         animation: 'bounce 1.4s ease-in-out infinite',
      //         animationDelay: '0.4s'
      //       }}></div>
      //     </div>
      //   </div>

      //   {/* Progress hint */}
      //   <div style={{
      //     position: 'absolute',
      //     bottom: '60px',
      //     fontSize: '14px',
      //     color: 'rgba(255, 255, 255, 0.8)',
      //     textAlign: 'center',
      //     maxWidth: '500px',
      //     padding: '0 20px'
      //   }}>
      //   </div>

      //   <style>{`
      //     @keyframes spin {
      //       0% { transform: translate(-50%, -50%) rotate(0deg); }
      //       100% { transform: translate(-50%, -50%) rotate(360deg); }
      //     }
          
      //     @keyframes pulse {
      //       0%, 100% { transform: scale(1); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); }
      //       50% { transform: scale(1.05); box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4); }
      //     }
          
      //     @keyframes float {
      //       0%, 100% { transform: translateY(0px); }
      //       50% { transform: translateY(-10px); }
      //     }
          
      //     @keyframes bounce {
      //       0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
      //       40% { transform: scale(1); opacity: 1; }
      //     }
      //   `}</sty
      // <div className="loading-container">
      <div className="loading-container">
          <FaSpinner className="loading-spinner-icon" />
          <h2 style={{color: "red", fontSize: "2.5rem", fontWeight: "700", margin: "20px 0 10px 0", textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)"}}>Texas Forestation</h2>
          <p>Initializing Texas Forestation System...</p>
        </div>
      // </div>
    );
  }

  // Fallback loading if boundary data still not available
  if (!texasBoundaryData) {
    return (
      <div className="map-loading">
        <div className="spinner"></div>
        <span>Loading Texas Map...</span>
      </div>
    );
  }

  // Calculate Texas bounds for initial view (but don't restrict scrolling)
  const texasBounds = texasBoundaryData && texasBoundaryData.features 
    ? getGeoJsonBounds(texasBoundaryData) 
    : TEXAS_BOUNDS.maxBounds; // Use predefined bounds as fallback

  return (
    <div className="texas-map-container">
      <MapContainer
        center={texasCenter}
        zoom={5.6}
        minZoom={5.4}
        maxZoom={18}
        style={{ height: '100vh', width: '100%' }}
        ref={mapRef}
        className="texas-map"
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
        preferCanvas={true}                          // Use Canvas for better performance
        renderer={L.canvas()}                        // Explicit Canvas renderer
        zoomSnap={1}                                // Standard zoom increments (faster)
        zoomDelta={1}                               // Full zoom level per action
        wheelPxPerZoomLevel={60}                    // More responsive trackpad zoom
        wheelDebounceTime={40}                      // Faster wheel response
      >
        {!isInitializing && (
        <button 
        onClick={() => window.location.href = '/home'}
        className="back-button"
        title="Back to main application"
        style={{
          position: 'absolute',
          top: '20px',
          left: '60px',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '15px',
          color: 'white',
          padding: '12px 24px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}

        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.25)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          e.target.style.transform = 'translateX(-5px)';
          e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          e.target.style.transform = 'translateX(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
          <path d="M280.37 148.26L96 300.11V464a16 16 0 0 0 16 16l112.06-.29a16 16 0 0 0 15.92-16V368a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v95.64a16 16 0 0 0 16 16.05L464 480a16 16 0 0 0 16-16V300L295.67 148.26a12.19 12.19 0 0 0-15.3 0zM571.6 251.47L488 182.56V44.05a12 12 0 0 0-12-12h-56a12 12 0 0 0-12 12v72.61L318.47 43a48 48 0 0 0-61 0L4.34 251.47a12 12 0 0 0-1.6 16.9l25.5 31A12 12 0 0 0 45.15 301l235.22-193.74a12.19 12.19 0 0 1 15.3 0L530.9 301a12 12 0 0 0 16.9-1.6l25.5-31a12 12 0 0 0-1.7-16.93z"></path>
        </svg>
        <span>Back to Main</span>
      </button>
      )}

        {/* Satellite imagery base layer - optimized for performance */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={18}
          tileSize={256}
          keepBuffer={2}                              // Reduce tile buffer for better memory usage
          updateWhenZooming={false}                   // Don't update tiles during zoom animation
          updateInterval={200}                        // Throttle tile updates
        />

        {/* Blackout outside Texas only (no effect inside) */}
        {(texasBoundaryData || countyLayerData) && (
          <OutsideTexasMask 
            texasGeojson={texasBoundaryData || countyLayerData} 
            opacity={0.65} 
          />
        )}

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

        {/* Carbon county color layer (region-aware visibility) */}
        {countyLayerData && (
          <CarbonVisualizationLayer
            isVisible={isCountyColorVisible}
            countyGeoJsonData={countyLayerData}
            onCountyClick={handleCountySelection}
            currentZoom={currentZoom}
            mapBounds={mapBounds}
            isGridVisible={isGridVisible}
          />
        )}

        {/* Render all active GeoJSON layers */}
        {activeLayersData.map((layerData) => (
          <GeoJsonLayer
            key={layerData.id}
            layerData={layerData}
          />
        ))}

        {/* Fire detection layer */}
        {showFireLayer && (
          <FireLayer
            isVisible={showFireLayer}
            dataset={fireDataset}
            days={fireDays}
            onFireDataUpdate={handleFireDataUpdate}
            showPopups={true}
          />
        )}

        {/* Wildfire prediction layer */}
        {showWildfireLayer && wildfireMapData && (
          <WildfireLayer
            wildfireData={wildfireMapData}
            isVisible={showWildfireLayer}
            onLocationClick={handleWildfireLocationSelect}
            opacity={0.8}
          />
        )}

        
        {/* Map event tracker for carbon layer visibility */}
        <MapEventTracker setCurrentZoom={setCurrentZoom} setMapBounds={setMapBounds} />
        
        {/* Map click handler for spatial queries */}
        <MapClickHandler 
          onMapClick={handleMapClick} 
          gridData={gridData} 
          yoloDataLoaded={yoloDataLoaded} 
          setNonCultivableAlert={setNonCultivableAlert}
          texasBoundaryData={texasBoundaryData}
          setOutsideTexasAlert={setOutsideTexasAlert}
        />
      </MapContainer>

      {/* Layer control panel - Only show when map is fully initialized */}
      {!isInitializing && !showHistoricalData && !showCarbonPanel &&(
        <LayerSelector
          isLayerActive={isLayerActive}
          isLayerLoading={isLayerLoading}
          toggleLayer={toggleLayer}
          getLayerError={getLayerError}
          clearAllLayers={clearAllLayers}
          getActiveLayerCount={getActiveLayerCount}
          getActiveLayersData={getActiveLayersData}
          onToggle={setIsLayerSelectorOpen}
        />
      )}

      {/* Map info panel */}
      {/* <div className="map-info">
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
      </div> */}

      
      {/* <div className="custom-attribution">
        <p>Data sources: Texas state government & Esri satellite imagery</p>
      </div> */}

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

      {/* Action Buttons - Only show when map is fully initialized */}
      {!isInitializing && !showHistoricalData && !showCarbonPanel && !isLayerSelectorOpen && (
        <>
          {/* Carbon Analysis Button */}
          <CarbonButton 
            onClick={handleCarbonButtonClick}
            isActive={showCarbonPanel}
          />

          {/* Fire Tracking Button */}
          {/* <FireButton */}
            {/* // onClick={handleFireButtonClick}
            // isActive={showFireLayer}
            // isLoading={isLoadingFire}
            // fireCount={fireData?.totalDetections || 0} */}
          {/* /> */}

          {/* Wildfire Prediction Button - Now with Full Texas Coverage */}
          <WildfireButton
            onToggle={handleWildfireToggle}
            isActive={showWildfireLayer}
            onDataLoad={handleWildfireDataLoad}
          />

          {/* USGS Enhanced Wildfire Prediction Button */}
          {/* <USGSWildfireButton /> */}

          {/* Historical Data Button */}
          <HistoricalDataButton
            onClick={handleHistoricalDataClick}
            isActive={showHistoricalData}
          />
        </>
      )}

      {/* Carbon Estimation Panel */}
      <CarbonEstimationPanel
        selectedCounty={selectedCountyForCarbon}
        isVisible={showCarbonPanel}
        onClose={() => setShowCarbonPanel(false)}
        onCountySelect={handleCountySelection}
      />

      {/* Fire Control Panel */}
      <FireControlPanel
        isVisible={showFirePanel}
        onClose={handleFirePanelClose}
        onDatasetChange={handleFireDatasetChange}
        onDaysChange={handleFireDaysChange}
        onRefresh={handleFireRefresh}
        fireData={fireData}
      />

      {/* Wildfire Control Panel */}
      <WildfireControlPanel
        isVisible={showWildfirePanel}
        onClose={handleWildfirePanelClose}
        selectedPoint={selectedWildfirePoint}
        onLocationSelect={handleWildfireLocationSelect}
        mapData={wildfireMapData}
      />

      {/* Historical Data Modal */}
      <HistoricalDataModal
        isVisible={showHistoricalData}
        onClose={handleHistoricalDataClose}
      />

      {/* Spatial Query Results Modal */}
      <SpatialQueryResults
        queryResults={queryResults}
        isVisible={showQueryResults}
        onClose={handleCloseQueryResults}
      />

      {/* Carbon Legend - Only show when map is fully initialized */}
      {!isInitializing && (
        <CarbonLegend 
          isVisible={isCountyColorVisible && countyLayerData !== null}
        />
      )}

      {/* Non-cultivable area alert notification */}
      {nonCultivableAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#1f2937',
          color: 'white',
          padding: '12px 28px',
          borderRadius: '50px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          border: '2px solid #374151',
          animation: 'slideDownAlert 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{
            fontSize: '15px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            color: '#f9fafb'
          }}>
            🖤 Non-Cultivable Area - Please select a green area
          </span>
          <button
            onClick={() => setNonCultivableAlert(null)}
            style={{
              background: 'white',
              border: 'none',
              color: '#1f2937',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '7px 18px',
              borderRadius: '25px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
            }}
            title="Close alert"
          >
            Got it!
          </button>
        </div>
      )}

      {/* Outside Texas boundary alert notification */}
      {outsideTexasAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          background: '#8B0000',
          color: 'white',
          padding: '14px 32px',
          borderRadius: '50px',
          boxShadow: '0 8px 24px rgba(139, 0, 0, 0.6)',
          animation: 'slideDownAlert 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            Please click on the Texas region only.
          </span>
          <button
            onClick={() => setOutsideTexasAlert(null)}
            style={{
              background: 'white',
              border: 'none',
              color: '#8B0000',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '8px 20px',
              borderRadius: '25px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
            }}
            title="Close alert"
          >
            Got it!
          </button>
          
          <style>{`
            @keyframes slideDownAlert {
              0% {
                transform: translateX(-50%) translateY(-100px);
                opacity: 0;
              }
              100% {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default TexasMap; 