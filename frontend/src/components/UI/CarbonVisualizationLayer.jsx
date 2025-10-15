import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { carbonEstimationService } from '../../services/carbonEstimationService';

/**
 * Carbon Visualization Layer Component
 * Renders counties with color-coded carbon density levels
 */
const CarbonVisualizationLayer = ({ 
  isVisible = false, 
  countyGeoJsonData = null, 
  onCountyClick = null,
  currentZoom = 6,
  mapBounds = null,
  isGridVisible = true
}) => {
  const map = useMap();
  const geoJsonLayerRef = useRef(null);
  const [carbonData, setCarbonData] = useState(new Map());
  const [loading, setLoading] = useState(false);

  const normalizeCounty = (name) => {
    if (!name) return null;
    const cleaned = String(name)
      .replace(/\s+County$/i, '')
      .replace(/\s+Co\.?$/i, '')
      .trim();
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Load carbon data for all counties when component becomes visible
  useEffect(() => {
    if (isVisible && countyGeoJsonData && carbonData.size === 0) {
      loadCarbonDataForCounties();
    }
  }, [isVisible, countyGeoJsonData, carbonData.size]);

  // Force style reset on zoom change to prevent hover artifacts
  useEffect(() => {
    if (geoJsonLayerRef.current && currentZoom) {
      // Reset all styles when zoom changes
      const layer = geoJsonLayerRef.current;
      if (layer.eachLayer) {
        layer.eachLayer((sublayer) => {
          if (sublayer.feature) {
            layer.resetStyle(sublayer);
          }
        });
      }
    }
  }, [currentZoom]);

  // Add map event listeners to force cleanup during zoom
  useEffect(() => {
    if (!map) return;

    const handleZoomStart = () => {
      // Clear all hover states when zoom starts
      if (geoJsonLayerRef.current && geoJsonLayerRef.current.eachLayer) {
        geoJsonLayerRef.current.eachLayer((sublayer) => {
          if (sublayer.feature) {
            geoJsonLayerRef.current.resetStyle(sublayer);
          }
        });
      }
    };

    const handleZoomEnd = () => {
      // Force a final cleanup when zoom ends
      if (geoJsonLayerRef.current && geoJsonLayerRef.current.eachLayer) {
        geoJsonLayerRef.current.eachLayer((sublayer) => {
          if (sublayer.feature) {
            geoJsonLayerRef.current.resetStyle(sublayer);
          }
        });
      }
    };

    map.on('zoomstart', handleZoomStart);
    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomstart', handleZoomStart);
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  const loadCarbonDataForCounties = async () => {
    if (!countyGeoJsonData || !countyGeoJsonData.features) return;

    setLoading(true);
    const newCarbonData = new Map();

    try {
      // Fetch cached county carbon data in one call for instant rendering
      const allCounties = await carbonEstimationService.getAllCountiesCarbon();
      console.log(`🌍 Loaded ${allCounties.length} counties with carbon data`);
      
      // Log sample values to debug thresholds and analyze distribution
      const carbonValues = allCounties.map(c => c.total_carbon_tons).filter(v => v != null).sort((a, b) => b - a);
      console.log('🔍 Carbon value distribution:');
      console.log('  Highest 10:', carbonValues.slice(0, 10));
      console.log('  Middle range:', carbonValues.slice(Math.floor(carbonValues.length * 0.4), Math.floor(carbonValues.length * 0.6)));
      console.log('  Lowest 10:', carbonValues.slice(-10));
      console.log('  Total counties:', carbonValues.length);
      
      // Calculate balanced thresholds and store full range for gradient
      const highThreshold = carbonValues[Math.floor(carbonValues.length * 0.33)];
      const mediumThreshold = carbonValues[Math.floor(carbonValues.length * 0.66)];
      const maxValue = carbonValues[0]; // Highest value
      const minValue = carbonValues[carbonValues.length - 1]; // Lowest value
      
      console.log(`📊 Carbon range: ${minValue} to ${maxValue} tons`);
      console.log(`📊 Gradient thresholds: High ≥${highThreshold}, Medium ≥${mediumThreshold}`);
      
      // Store complete range for gradient calculation
      window.dynamicCarbonThresholds = { 
        high: highThreshold, 
        medium: mediumThreshold,
        max: maxValue,
        min: minValue
      };
      
      for (const item of allCounties) {
        if (item && item.county_name) {
          const base = normalizeCounty(item.county_name);
          if (!base) continue;
          // Map both base and "County" suffixed keys for robust matching
          newCarbonData.set(base, item);
          newCarbonData.set(`${base} County`, item);
        }
      }
    } catch (e) {
      console.warn('Falling back to per-county fetch due to all-counties API failure:', e?.message);

      // Fallback: fetch first N to avoid long startup
      const countiesToLoad = countyGeoJsonData.features.slice(0, 60);
      for (const feature of countiesToLoad) {
        const countyNameRaw = carbonEstimationService.extractCountyName(feature);
        const countyName = normalizeCounty(countyNameRaw);
        if (countyName) {
          try {
            const carbonInfo = await carbonEstimationService.getCountyCarbon(countyName);
            if (carbonInfo) {
              newCarbonData.set(countyName, carbonInfo);
              newCarbonData.set(`${countyName} County`, carbonInfo);
            }
          } catch (error) {
            console.warn(`Failed to load carbon data for ${countyName}:`, error);
          }
        }
      }
    }

    setCarbonData(newCarbonData);
    setLoading(false);
  };

  // Check if a county feature intersects with the current viewport where grids are visible
  const isCountyInGridZone = useCallback((feature) => {
    if (!isGridVisible || currentZoom < 8 || !mapBounds) return false;
    
    // Get county bounds
    const coords = feature.geometry.coordinates;
    let countyBounds = null;
    
    if (feature.geometry.type === 'Polygon') {
      const lats = coords[0].map(c => c[1]);
      const lngs = coords[0].map(c => c[0]);
      countyBounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };
    } else if (feature.geometry.type === 'MultiPolygon') {
      const allCoords = coords.flat(2);
      const lats = allCoords.map(c => c[1]);
      const lngs = allCoords.map(c => c[0]);
      countyBounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };
    }
    
    if (!countyBounds) return false;
    
    // Check if county intersects with current map viewport
    const viewport = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest()
    };
    
    return (
      countyBounds.north >= viewport.south &&
      countyBounds.south <= viewport.north &&
      countyBounds.east >= viewport.west &&
      countyBounds.west <= viewport.east
    );
  }, [isGridVisible, currentZoom, mapBounds]);

  // Memoized style function with grid-zone aware visibility
  const getCountyStyle = useCallback((feature) => {
    const countyNameRaw = carbonEstimationService.extractCountyName(feature);
    const countyName = normalizeCounty(countyNameRaw);
    const carbonInfo = carbonData.get(countyName) || carbonData.get(`${countyName} County`);
    
    // Hide carbon colors in areas where grids are visible
    const inGridZone = isCountyInGridZone(feature);
    
    if (carbonInfo && carbonInfo.total_carbon_tons && !inGridZone) {
      const isDefault = carbonEstimationService.isDefaultEstimate(carbonInfo);
      const category = carbonEstimationService.getCarbonCategory(carbonInfo.total_carbon_tons, isDefault);
      return {
        color: isDefault ? '#f59e0b' : category.color,  // Orange border for default estimates
        weight: isDefault ? 2 : 1,  // Thicker border for default estimates
        fillColor: category.color,  // Use gradient color for fill
        fillOpacity: isDefault ? 0.5 : 0.4,  // Slightly more opaque for defaults to show gradient better
        opacity: 0.8,
        dashArray: isDefault ? '8,4' : null  // Dashed pattern for default estimates (longer dashes)
      };
    }

    // Transparent/hidden style for counties in grid zones or without data
    // Make them completely transparent and non-interactive so clicks pass through
    return {
      color: 'transparent',
      weight: 0,
      fillColor: 'transparent',
      fillOpacity: 0,
      opacity: 0,
      dashArray: null,
      interactive: false  // Don't intercept mouse events - let them pass to the map
    };
  }, [carbonData, isCountyInGridZone]);

  const handleCountyClick = (e) => {
    const feature = e.target.feature;
    const countyName = carbonEstimationService.extractCountyName(feature);
    
    // Only visible counties are interactive, so if this fires, handle the county selection
    if (countyName && onCountyClick) {
      onCountyClick(countyName);
    }
  };

  // Optimized onEachFeature with reduced DOM manipulations
  const onEachFeature = useCallback((feature, layer) => {
    const countyNameRaw = carbonEstimationService.extractCountyName(feature);
    const countyName = normalizeCounty(countyNameRaw);
    const carbonInfo = carbonData.get(countyName) || carbonData.get(`${countyName} County`);

    // Simplified popup - only show on demand to reduce initial load
    layer.bindPopup(() => {
      let popupContent = `<div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #2d5016;">${countyName} County</h4>`;

      if (carbonInfo) {
        const isDefault = carbonEstimationService.isDefaultEstimate(carbonInfo);
        const category = carbonEstimationService.getCarbonCategory(carbonInfo.total_carbon_tons, isDefault);
        popupContent += `
          <div style="margin-bottom: 8px;">
            <div style="display: inline-block; width: 12px; height: 12px; background: ${category.color}; border-radius: 50%; margin-right: 6px;"></div>
            <strong>${category.label} Carbon Density</strong>
          </div>
          <div style="font-size: 13px; line-height: 1.4;">
            <div><strong>Total Carbon:</strong> ${carbonEstimationService.formatCarbonValue(carbonInfo.total_carbon_tons)}</div>
            <div><strong>CO₂ Equivalent:</strong> ${carbonEstimationService.formatCO2Value(carbonInfo.total_co2_equivalent_tons)}</div>
            ${isDefault ? '<div style="color: #f59e0b; font-size: 12px; margin-top: 4px;"><em>⚠️ Default estimate - no biomass data available</em></div>' : ''}
          </div>`;
      } else {
        popupContent += `<div style="color: #666; font-size: 13px;">Carbon data not available</div>`;
      }
      return popupContent + `</div>`;
    });

    layer.on('click', handleCountyClick);

    // Add hover label with carbon data (similar to GeoJsonLayer)
    let hoverLabel = null;
    let originalStyle = null;
    
    // Store original style on layer creation
    originalStyle = getCountyStyle(feature);
    
    layer.on('mouseover', function(e) {
      // Don't apply hover effects during zoom animation
      if (map._animatingZoom) {
        return;
      }
      
      const targetLayer = e.target;
      
      // Get current style as base for hover
      const currentStyle = getCountyStyle(feature);
      
      // Apply visual hover effect ONLY if county has visible styling
      // (fillOpacity > 0.1 to exclude the transparent counties with 0.01 opacity)
      if (currentStyle.fillOpacity > 0.1) {
        targetLayer.setStyle({
          ...currentStyle,
          weight: 2,
          fillOpacity: 0.6
        });
      }
      
      // ALWAYS show hover label with carbon data (regardless of visibility)
      if (layer.getBounds && countyName && carbonInfo) {
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        
        const hoverContent = `
          <span class="county-name-hover">${countyName} County</span>
          <div class="carbon-data">
            <div class="carbon-item">🌲 ${carbonEstimationService.formatCarbonValue(carbonInfo.total_carbon_tons)}</div>
            <div class="carbon-item">💨 ${carbonEstimationService.formatCO2Value(carbonInfo.total_co2_equivalent_tons)}</div>
          </div>
        `;
        
        hoverLabel = L.marker(center, {
          icon: L.divIcon({
            className: 'county-label county-label-hover county-label-with-carbon',
            html: `<div class="county-hover-content">${hoverContent}</div>`,
            iconSize: [220, 80],
            iconAnchor: [110, 40]
          }),
          interactive: false,
          zIndexOffset: 2000
        });
        
        hoverLabel.addTo(map);
      }
    });

    layer.on('mouseout', function(e) {
      // Remove hover label immediately (always, regardless of county visibility)
      if (hoverLabel) {
        try {
          if (map.hasLayer(hoverLabel)) {
            map.removeLayer(hoverLabel);
          }
        } catch (err) {
          console.warn('Error removing hover label:', err);
        }
        hoverLabel = null;
      }
      
      // Reset visual style (important to prevent artifacts)
      try {
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.resetStyle(e.target);
        } else {
          // Fallback to manual style setting
          const targetLayer = e.target;
          const originalStyle = getCountyStyle(feature);
          targetLayer.setStyle(originalStyle);
        }
      } catch (err) {
        console.warn('Error resetting style:', err);
      }
    });
    
    // Clean up on layer removal or zoom change
    layer.on('remove', function() {
      if (hoverLabel) {
        map.removeLayer(hoverLabel);
        hoverLabel = null;
      }
    });
  }, [carbonData, getCountyStyle, handleCountyClick, map, normalizeCounty]);

  // Memoize the GeoJSON component to prevent unnecessary re-renders
  const geoJsonComponent = useMemo(() => {
    if (!isVisible || !countyGeoJsonData) {
      return null;
    }
    
    return (
      <GeoJSON
        ref={geoJsonLayerRef}
        key={`carbon-visualization-${carbonData.size}-${currentZoom}-${isGridVisible}`}
        data={countyGeoJsonData}
        style={getCountyStyle}
        onEachFeature={onEachFeature}
        pane="overlayPane" // Use specific pane for better rendering performance
      />
    );
  }, [isVisible, countyGeoJsonData, carbonData.size, getCountyStyle, onEachFeature, currentZoom, mapBounds, isGridVisible]);

  return geoJsonComponent;
};

export default CarbonVisualizationLayer;
