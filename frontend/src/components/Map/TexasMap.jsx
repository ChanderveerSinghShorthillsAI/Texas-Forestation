import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

      } catch (error) {
        console.error('❌ Map initialization failed:', error);
        setIsInitializing(false); // Show map anyway with limited functionality
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
   * Handle fire button click
   */
  const handleFireButtonClick = () => {
    setShowFireLayer(!showFireLayer);
    if (!showFireLayer) {
      // When enabling fire layer, also show the control panel
      setShowFirePanel(true);
    }
  };

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

  // Show loading optimizer during initialization
  if (isInitializing) {
    return (
      <>
        <LoadingOptimizer
          isVisible={true}
          onComplete={() => setIsInitializing(false)}
        />
        {/* Carbon Button should still be visible during loading */}
        <CarbonButton 
          onClick={handleCarbonButtonClick}
          isActive={showCarbonPanel}
          disabled={true}
        />
      </>
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

      {/* Carbon Analysis Button */}
      <CarbonButton 
        onClick={handleCarbonButtonClick}
        isActive={showCarbonPanel}
      />

      {/* Fire Tracking Button */}
      <FireButton
        onClick={handleFireButtonClick}
        isActive={showFireLayer}
        isLoading={isLoadingFire}
        fireCount={fireData?.totalDetections || 0}
      />

      {/* Wildfire Prediction Button - Now with Full Texas Coverage */}
      <WildfireButton
        onToggle={handleWildfireToggle}
        isActive={showWildfireLayer}
        onDataLoad={handleWildfireDataLoad}
      />

      {/* USGS Enhanced Wildfire Prediction Button */}
      <USGSWildfireButton />

      {/* Historical Data Button */}
      <HistoricalDataButton
        onClick={handleHistoricalDataClick}
        isActive={showHistoricalData}
      />

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

      {/* Carbon Legend */}
      <CarbonLegend 
        isVisible={isCountyColorVisible && countyLayerData !== null}
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