import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import { yoloResultsService } from '../../services/yoloResultsService';

/**
 * Component for rendering Texas grid cells with performance optimizations and YOLO-based coloring
 */
const GridLayer = ({ gridData, isVisible = true }) => {
  const map = useMap();
  const geoJsonRef = useRef();
  const renderStartTimeRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [mapBounds, setMapBounds] = useState(map.getBounds());
  const [yoloResults, setYoloResults] = useState(null);
  const [yoloLoading, setYoloLoading] = useState(false);

  // Performance thresholds
  const PERFORMANCE_CONFIG = {
    MIN_ZOOM_FOR_GRID: 8,        // Don't show grid below zoom 8
    MAX_CELLS_TO_RENDER: 2000,   // Maximum cells to render at once
    CLUSTER_ZOOM_THRESHOLD: 10,  // Below this zoom, show fewer cells
  };

  // Track map events for performance optimization
  useMapEvents({
    zoom: () => {
      setCurrentZoom(map.getZoom());
      setMapBounds(map.getBounds());
    },
    moveend: () => {
      setMapBounds(map.getBounds());
    }
  });

  // Load YOLO results on component mount
  useEffect(() => {
    const loadYoloData = async () => {
      if (yoloResults || yoloLoading) return;
      
      setYoloLoading(true);
      try {
        console.log('🔄 Loading YOLO results for grid coloring...');
        const results = await yoloResultsService.loadYoloResults();
        setYoloResults(results);
        
        const stats = yoloResultsService.getStats();
        if (stats) {
          console.log(`🎨 Grid coloring enabled: ${stats.cultivable.toLocaleString()} cultivable (green), ${stats.nonCultivable.toLocaleString()} non-cultivable (black)`);
        }
      } catch (error) {
        console.error('❌ Failed to load YOLO results for grid coloring:', error);
        // Continue without YOLO results - grids will show in default color
      } finally {
        setYoloLoading(false);
      }
    };

    loadYoloData();
  }, []);

  // Optimized grid data based on zoom level and viewport
  const optimizedGridData = useMemo(() => {
    if (!gridData || !isVisible || currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID) {
      return null;
    }

    const startTime = performance.now();
    console.log(`🔍 Optimizing grid for zoom ${currentZoom}`);

    // Filter cells within current viewport with some padding
    const bounds = mapBounds;
    const padding = 0.1; // Add padding to avoid edge issues
    const viewportBounds = {
      north: bounds.getNorth() + padding,
      south: bounds.getSouth() - padding,
      east: bounds.getEast() + padding,
      west: bounds.getWest() - padding
    };

    // Filter features within viewport
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

    // Apply additional sampling based on zoom level
    let finalFeatures = visibleFeatures;
    
    if (currentZoom < PERFORMANCE_CONFIG.CLUSTER_ZOOM_THRESHOLD) {
      // At lower zoom levels, show every Nth cell for better performance
      const samplingRate = Math.max(1, Math.floor(visibleFeatures.length / PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER));
      finalFeatures = visibleFeatures.filter((_, index) => index % samplingRate === 0);
      
      if (samplingRate > 1) {
        console.log(`📉 Sampling: showing 1 in ${samplingRate} cells for performance`);
      }
    } else if (finalFeatures.length > PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER) {
      // Even at high zoom, limit total cells
      finalFeatures = finalFeatures.slice(0, PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER);
      console.log(`✂️  Truncating to ${PERFORMANCE_CONFIG.MAX_CELLS_TO_RENDER} cells`);
    }

    const optimizedData = {
      type: 'FeatureCollection',
      features: finalFeatures
    };

    const endTime = performance.now();
    console.log(`⚡ Grid optimization complete:`);
    console.log(`   📊 Total cells: ${gridData.features.length.toLocaleString()}`);
    console.log(`   👁️  Visible cells: ${visibleFeatures.length.toLocaleString()}`);
    console.log(`   🎨 Rendering cells: ${finalFeatures.length.toLocaleString()}`);
    console.log(`   ⏱️  Optimization time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   🎯 Zoom level: ${currentZoom}`);

    return optimizedData;
  }, [gridData, isVisible, currentZoom, mapBounds]);

  // Performance monitoring for render
  useEffect(() => {
    if (!optimizedGridData) {
      return;
    }

    renderStartTimeRef.current = performance.now();
    console.log(`🎨 Starting optimized grid render: ${optimizedGridData.features.length.toLocaleString()} cells`);
  }, [optimizedGridData]);

  // Measure render completion time
  useEffect(() => {
    if (optimizedGridData && renderStartTimeRef.current) {
      const timer = setTimeout(() => {
        const renderEndTime = performance.now();
        const renderTime = renderEndTime - renderStartTimeRef.current;
        
        console.log(`✅ Optimized grid render complete`);
        console.log(`   🎨 Render time: ${renderTime.toFixed(2)}ms`);
        console.log(`   📊 Cells rendered: ${optimizedGridData.features.length.toLocaleString()}`);
        console.log(`   ⚡ Performance: ${(optimizedGridData.features.length / renderTime * 1000).toFixed(0)} cells/second`);
        
        // Performance warnings adjusted for optimized rendering
        if (renderTime > 1000) {
          console.warn(`⚠️  SLOW RENDER: ${(renderTime/1000).toFixed(2)}s for ${optimizedGridData.features.length.toLocaleString()} cells`);
        } else if (renderTime > 500) {
          console.warn(`⚡ Moderate render time: ${renderTime.toFixed(0)}ms`);
        } else {
          console.log(`🚀 Fast render: ${renderTime.toFixed(0)}ms`);
        }
        
        renderStartTimeRef.current = null;
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [optimizedGridData]);

  // Don't render anything if zoom is too low or no data
  if (!optimizedGridData || currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID) {
    return currentZoom < PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID ? (
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(59, 130, 246, 0.9)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        zIndex: 1000,
        pointerEvents: 'none'
      }}>
        🔍 Zoom in to see grid cells (zoom ≥ {PERFORMANCE_CONFIG.MIN_ZOOM_FOR_GRID})
      </div>
    ) : null;
  }

  /**
   * Optimized style function for grid cells with YOLO-based coloring
   */
  const getGridCellStyle = (feature) => {
    // Adjust style based on zoom level for performance
    const weight = currentZoom >= 12 ? 2 : 1.5;
    const opacity = currentZoom >= 10 ? 0.8 : 0.7;
    
    // Get grid index from feature properties
    const gridIndex = feature.properties.index;
    
    // Determine colors based on YOLO results
    let fillColor = 'transparent';
    let fillOpacity = 0;
    let borderColor = '#1e40af'; // Default blue border
    
    if (yoloResults && gridIndex !== undefined) {
      const cultivability = yoloResultsService.getCultivability(gridIndex);
      
      if (cultivability === 1) {
        // Cultivable - Green
        fillColor = '#22c55e';  // Green-500
        fillOpacity = 0.6;
        borderColor = '#16a34a'; // Green-600
      } else if (cultivability === 0) {
        // Non-cultivable - Black/Dark
        fillColor = '#1f2937';   // Gray-800 (dark)
        fillOpacity = 0.7;
        borderColor = '#374151'; // Gray-700
      }
      // If no YOLO data for this grid, keep transparent (default)
    }
    
    // Disable interactions for non-cultivable (black) grids
    const isNonCultivable = yoloResults && gridIndex !== undefined && yoloResultsService.getCultivability(gridIndex) === 0;
    const isInteractive = currentZoom >= 10 && !isNonCultivable; // Disable interaction for black grids
    
    return {
      color: borderColor,
      weight: weight,
      opacity: opacity,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      interactive: isInteractive,
      className: isNonCultivable ? 'non-cultivable-grid' : '' // Add CSS class for styling
    };
  };

  /**
   * Optimized interaction handling
   */
  const onEachFeature = (feature, layer) => {
    // Only add interactions at higher zoom levels for performance
    if (currentZoom < 10) {
      return;
    }

    // Skip interactions for non-cultivable (black) grids
    const gridIndex = feature.properties.index;
    const isNonCultivable = yoloResults && gridIndex !== undefined && yoloResultsService.getCultivability(gridIndex) === 0;
    
    if (isNonCultivable) {
      // Add a visual indicator that this grid is non-interactive
      layer.setStyle({
        ...layer.options,
        cursor: 'not-allowed'
      });
      
      // Optional: Log non-interactive grids (uncomment for debugging)
      // console.log(`🖤 Grid ${gridIndex} is non-cultivable - interactions disabled`);
      
      return; // Skip adding any event handlers
    }

    let clickCoords = null;

    layer.on('click', (e) => {
      clickCoords = e.latlng;
      
      // Get YOLO classification data for this grid (gridIndex already defined above)
      const yoloData = yoloResultsService.getResultData(gridIndex);
      
      let classificationInfo = '';
      if (yoloData) {
        const cultivableIcon = yoloData.cultivable === 1 ? '🌱' : '🖤';
        const cultivableText = yoloData.cultivable === 1 ? 'Cultivable' : 'Non-cultivable';
        const confidencePercent = (yoloData.confidence * 100).toFixed(1);
        
        classificationInfo = `
          <div style="margin-bottom: 8px; padding: 8px; background: ${yoloData.cultivable === 1 ? '#f0fdf4' : '#f9fafb'}; border-radius: 6px; border: 1px solid ${yoloData.cultivable === 1 ? '#bbf7d0' : '#e5e7eb'};">
            <div style="color: #374151; font-weight: 600; font-size: 12px; margin-bottom: 4px;">${cultivableIcon} YOLO Classification:</div>
            <div style="font-size: 11px; color: #1f2937;">
              <div><strong>Type:</strong> ${cultivableText}</div>
              <div><strong>Confidence:</strong> ${confidencePercent}%</div>
              <div><strong>Class:</strong> ${yoloData.predictedClass}</div>
            </div>
          </div>
        `;
      } else {
        classificationInfo = `
          <div style="margin-bottom: 8px; padding: 8px; background: #fef3c7; border-radius: 6px; border: 1px solid #fde68a;">
            <div style="color: #92400e; font-size: 11px;">⚠️ No YOLO classification data available</div>
          </div>
        `;
      }
      
      const popupContent = `
        <div style="font-family: 'Segoe UI', sans-serif; min-width: 200px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px;">
            <strong style="color: #1f2937; font-size: 14px;">Grid Cell ${feature.properties.index}</strong><br/>
            <small style="color: #6b7280;">ID: ${feature.properties.grid_id}</small>
          </div>
          
          ${classificationInfo}
          
          <div style="margin-bottom: 8px;">
            <div style="color: #374151; font-weight: 600; font-size: 12px; margin-bottom: 4px;">📍 Click Location:</div>
            <div style="font-family: monospace; font-size: 11px; color: #1f2937;">
              <div><strong>Lat:</strong> ${clickCoords.lat.toFixed(6)}°</div>
              <div><strong>Lng:</strong> ${clickCoords.lng.toFixed(6)}°</div>
            </div>
          </div>
          
          <div>
            <div style="color: #374151; font-weight: 600; font-size: 12px; margin-bottom: 4px;">🔲 Cell Bounds:</div>
            <div style="font-family: monospace; font-size: 10px; color: #6b7280;">
              <div><strong>SW:</strong> ${feature.geometry.coordinates[0][0][1].toFixed(6)}°, ${feature.geometry.coordinates[0][0][0].toFixed(6)}°</div>
              <div><strong>NE:</strong> ${feature.geometry.coordinates[0][2][1].toFixed(6)}°, ${feature.geometry.coordinates[0][2][0].toFixed(6)}°</div>
            </div>
          </div>
          
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
            Zoom: ${currentZoom} | Visible: ${optimizedGridData.features.length.toLocaleString()}/${gridData.features.length.toLocaleString()} cells
          </div>
        </div>
      `;

      layer.getPopup().setContent(popupContent);
      
      console.log(`🔲 Grid Cell ${feature.properties.index} clicked (zoom ${currentZoom}):`);
      console.log(`   📍 Click coordinates: ${clickCoords.lat.toFixed(6)}, ${clickCoords.lng.toFixed(6)}`);
    });

    layer.bindPopup(`
      <div style="font-family: 'Segoe UI', sans-serif;">
        <strong>Grid Cell ${feature.properties.index}</strong><br/>
        <small>ID: ${feature.properties.grid_id}</small><br/>
        <em style="color: #6b7280; font-size: 11px;">Click to see coordinates</em>
      </div>
    `, {
      maxWidth: 250,
      className: 'grid-popup'
    });

    // Simplified hover effects for performance with YOLO coloring preservation
    // Note: Hover effects are only added for interactive (non-black) grids
    layer.on({
      mouseover: (e) => {
        if (currentZoom >= 10) {
          const currentStyle = getGridCellStyle(feature);
          e.target.setStyle({
            weight: 3,
            opacity: 1,
            fillColor: currentStyle.fillColor === 'transparent' ? '#1e40af' : currentStyle.fillColor,
            fillOpacity: currentStyle.fillOpacity === 0 ? 0.15 : Math.min(currentStyle.fillOpacity + 0.2, 1)
          });
        }
      },
      mouseout: (e) => {
        e.target.setStyle(getGridCellStyle(feature));
      }
    });
  };

  return (
    <GeoJSON
      ref={geoJsonRef}
      key={`optimized-grid-${currentZoom}-${optimizedGridData.features.length}`}
      data={optimizedGridData}
      style={getGridCellStyle}
      onEachFeature={onEachFeature}
    />
  );
};

export default GridLayer; 