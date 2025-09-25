import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { GeoJSON } from 'react-leaflet';
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
    return {
      color: 'transparent',
      weight: 0,
      fillColor: 'transparent',
      fillOpacity: 0,
      opacity: 0,
      dashArray: null
    };
  }, [carbonData, isCountyInGridZone]);

  const handleCountyClick = (e) => {
    const feature = e.target.feature;
    const countyName = carbonEstimationService.extractCountyName(feature);
    
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

    // Throttled hover effects to reduce performance impact
    let hoverTimeout;
    layer.on('mouseover', function(e) {
      clearTimeout(hoverTimeout);
      const targetLayer = e.target;
      targetLayer.setStyle({
        weight: 2,
        fillOpacity: 0.6
      });
    });

    layer.on('mouseout', function(e) {
      hoverTimeout = setTimeout(() => {
        const targetLayer = e.target;
        targetLayer.setStyle(getCountyStyle(feature));
      }, 50); // Small delay to prevent rapid style changes
    });
  }, [carbonData, getCountyStyle, handleCountyClick]);

  // Memoize the GeoJSON component to prevent unnecessary re-renders
  const geoJsonComponent = useMemo(() => {
    if (!isVisible || !countyGeoJsonData) {
      return null;
    }
    
    return (
      <GeoJSON
        key={`carbon-visualization-${carbonData.size}`}
        data={countyGeoJsonData}
        style={getCountyStyle}
        onEachFeature={onEachFeature}
        pane="overlayPane" // Use specific pane for better rendering performance
      />
    );
  }, [isVisible, countyGeoJsonData, carbonData.size, getCountyStyle, onEachFeature, currentZoom, mapBounds]);

  return geoJsonComponent;
};

export default CarbonVisualizationLayer;
