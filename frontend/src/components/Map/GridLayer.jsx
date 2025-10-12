import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { yoloResultsService } from '../../services/yoloResultsService';

/**
 * GridLayer Component - Simple solution: separate layers for black and green grids
 */
const GridLayer = ({ 
  gridData, 
  isVisible = true
}) => {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [mapBounds, setMapBounds] = useState(map.getBounds());
  const [yoloResults, setYoloResults] = useState(null);
  const [yoloLoading, setYoloLoading] = useState(false);

  const PERFORMANCE_CONFIG = {
    MIN_ZOOM_FOR_GRID: 8,
    MAX_CELLS_TO_RENDER: 2000,
    CLUSTER_ZOOM_THRESHOLD: 10,
  };

  // Removed SVG hatch pattern injection to keep land visible under semi-transparent fill

  useMapEvents({
    zoom: () => {
      setCurrentZoom(map.getZoom());
      setMapBounds(map.getBounds());
    },
    moveend: () => {
      setMapBounds(map.getBounds());
    }
  });

  // Load YOLO results
  useEffect(() => {
    const loadYoloData = async () => {
      if (yoloResults || yoloLoading) return;
      setYoloLoading(true);
      try {
        console.log('🔄 Loading YOLO results...');
        const results = await yoloResultsService.loadYoloResults();
        setYoloResults(results);
        const stats = yoloResultsService.getStats();
        if (stats) {
          console.log(`🎨 Loaded: ${stats.cultivable.toLocaleString()} green, ${stats.nonCultivable.toLocaleString()} black grids`);
        }
      } catch (error) {
        console.error('❌ Failed to load YOLO results:', error);
      } finally {
        setYoloLoading(false);
      }
    };
    loadYoloData();
  }, []);

  // Check if grid is cultivable
  const isGridCultivable = (gridIndex) => {
    if (!yoloResults || gridIndex === undefined) return true;
    return yoloResultsService.getCultivability(gridIndex) === 1;
  };

  // Separate cultivable and non-cultivable grids
  const { cultivableGrids, nonCultivableGrids } = useMemo(() => {
    if (!gridData || !isVisible || currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID) {
      return { cultivableGrids: null, nonCultivableGrids: null };
    }

    // Filter viewport
    const bounds = mapBounds;
    const padding = 0.1;
    const viewportBounds = {
      north: bounds.getNorth() + padding,
      south: bounds.getSouth() - padding,
      east: bounds.getEast() + padding,
      west: bounds.getWest() - padding
    };

    const visibleFeatures = gridData.features.filter(feature => {
      const coords = feature.geometry.coordinates[0];
      const cellBounds = {
        south: Math.min(...coords.map(c => c[1])),
        north: Math.max(...coords.map(c => c[1])),
        west: Math.min(...coords.map(c => c[0])),
        east: Math.max(...coords.map(c => c[0]))
      };
      return (
        cellBounds.north >= viewportBounds.south &&
        cellBounds.south <= viewportBounds.north &&
        cellBounds.east >= viewportBounds.west &&
        cellBounds.west <= viewportBounds.east
      );
    });

    // Apply performance limits
    let finalFeatures = visibleFeatures;
    if (currentZoom < PERFORMANCE_CONFIG.CLUSTER_ZOOM_THRESHOLD) {
      const samplingRate = Math.max(1, Math.floor(visibleFeatures.length / PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER));
      finalFeatures = visibleFeatures.filter((_, index) => index % samplingRate === 0);
    } else if (finalFeatures.length > PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER) {
      finalFeatures = finalFeatures.slice(0, PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER);
    }

    // Split into cultivable and non-cultivable
    const cultivable = [];
    const nonCultivable = [];

    finalFeatures.forEach(feature => {
      const gridIndex = feature.properties.index;
      if (isGridCultivable(gridIndex)) {
        cultivable.push(feature);
      } else {
        nonCultivable.push(feature);
      }
    });

    console.log(`🎯 Split grids: ${cultivable.length} green (interactive), ${nonCultivable.length} black (non-interactive)`);

    return {
      cultivableGrids: cultivable.length > 0 ? { type: 'FeatureCollection', features: cultivable } : null,
      nonCultivableGrids: nonCultivable.length > 0 ? { type: 'FeatureCollection', features: nonCultivable } : null
    };
  }, [gridData, isVisible, currentZoom, mapBounds, yoloResults]);

  // Styles - Lighter opacity to show terrain underneath
  const greenGridStyle = {
    color: '#16a34a',
    weight: 1.5,
    opacity: 0.7,
    fillColor: '#22c55e',
    fillOpacity: 0.15  // Much lighter - was 0.6
  };

  const blackGridStyle = {
    color: '#b91c1c',       // Border to indicate "restricted"
    weight: 2,
    opacity: 1,
    fillColor: '#dc2626',   // Lightish dark red
    fillOpacity: 0.2,       // Semi-transparent like green
    interactive: false
  };

  // Event handler ONLY for green grids
  const handleGreenGridEvents = (feature, layer) => {
    const gridIndex = feature.properties.index;
    console.log(`🌱 Green grid ${gridIndex} - adding interactions`);

    if (currentZoom < 10) return;

    layer.on('click', (e) => {
      const clickCoords = e.latlng;
      console.log(`✅ Green grid ${gridIndex} clicked`);
      
      // Note: Popup removed - green grids now only trigger map-level spatial queries
      // The MapClickHandler in TexasMap.jsx will handle the spatial query
    });

    // Hover effects disabled - no highlighting on mouseover
  };

  // No event handler for black grids - they get NOTHING!
  const handleBlackGridEvents = (feature, layer) => {
    const gridIndex = feature.properties.index;
    console.log(`🖤 Black grid ${gridIndex} - blocking all interactions`);
    
    // Mark this layer as non-cultivable for reference
    layer._isBlackGrid = true;
    
    // Ensure fill stays semi-transparent red without overriding by pattern
    if (layer.getElement) {
      const element = layer.getElement();
      if (element) {
        element.removeAttribute('fill');
        element.removeAttribute('fill-opacity');
        element.setAttribute('stroke', '#b91c1c');
        element.setAttribute('stroke-width', '2');
      }
    }
    
    // Remove all default interactivity
    layer.options.interactive = false;
    
    // Add event handlers that completely block propagation
    layer.on('click', (e) => {
      console.log(`🚫 BLOCKED: Click on black grid ${gridIndex} - event stopped`);
      e.originalEvent?.stopPropagation();
      e.originalEvent?.preventDefault();
      if (L.DomEvent && L.DomEvent.stopPropagation) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
      }
      return false;
    });
    
    // Block other mouse events too
    layer.on('mousedown mouseup mouseover mouseout', (e) => {
      e.originalEvent?.stopPropagation();
      if (L.DomEvent && L.DomEvent.stopPropagation) {
        L.DomEvent.stopPropagation(e);
      }
    });
  };

  // if (!isVisible || currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID) {
  //   return currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID ? (
  //     <div style={{
  //       position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
  //       background: 'rgba(59, 130, 246, 0.9)', color: 'white', padding: '8px 16px',
  //       borderRadius: '6px', fontSize: '12px', fontWeight: '600', zIndex: 1000, pointerEvents: 'none'
  //     }}>
  //       🔍 Zoom in to see grid cells (zoom ≥ {PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID})
  //     </div>
  //   ) : null;
  // }

  // const debugOverlay = (
  //   <div style={{
  //     position: 'absolute', top: '80px', left: '10px', background: 'rgba(0, 0, 0, 0.8)',
  //     color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '11px',
  //     zIndex: 1000, pointerEvents: 'none', fontFamily: 'monospace'
  //   }}>
  //     <div>🎨 YOLO: {yoloResults ? 'Loaded' : 'Loading...'}</div>
  //     {yoloResults && (
  //       <>
  //         <div>🌱 Green: {cultivableGrids?.features.length || 0}</div>
  //         <div>🖤 Black: {nonCultivableGrids?.features.length || 0}</div>
  //       </>
  //     )}
  //     <div>Zoom: {currentZoom}</div>
  //   </div>
  // );

  return (
    <>
      {/* {debugOverlay} */}
      
      {/* BLACK GRIDS - NO INTERACTIONS */}
      {nonCultivableGrids && (
        <GeoJSON
          key={`black-grids-${currentZoom}`}
          data={nonCultivableGrids}
          style={blackGridStyle}
          onEachFeature={handleBlackGridEvents}
          interactive={false}
          eventHandlers={{
            // Global event blocking for all black grid events
            click: (e) => {
              console.log('🚫 GLOBAL BLOCK: Click on black grids layer');
              e.originalEvent?.stopPropagation();
              e.originalEvent?.preventDefault();
              if (L.DomEvent) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
              }
              return false;
            },
            mousedown: (e) => {
              e.originalEvent?.stopPropagation();
              if (L.DomEvent) L.DomEvent.stopPropagation(e);
              return false;
            },
            mouseup: (e) => {
              e.originalEvent?.stopPropagation();
              if (L.DomEvent) L.DomEvent.stopPropagation(e);
              return false;
            }
          }}
        />
      )}
      
      {/* GREEN GRIDS - FULL INTERACTIONS */}
      {cultivableGrids && (
        <GeoJSON
          key={`green-grids-${currentZoom}`}
          data={cultivableGrids}
          style={greenGridStyle}
          onEachFeature={handleGreenGridEvents}
        />
      )}
    </>
  );
};

export default GridLayer; 