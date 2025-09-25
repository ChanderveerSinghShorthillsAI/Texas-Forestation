import React, { useEffect, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { createMeaningfulPopup } from '../../utils/mapUtils';
import { carbonEstimationService } from '../../services/carbonEstimationService';

/**
 * Component for rendering GeoJSON layers on the map
 */
const GeoJsonLayer = ({ layerData }) => {
  const map = useMap();
  const geoJsonRef = useRef();
  const labelsRef = useRef([]);

  // Cleanup labels when component unmounts
  useEffect(() => {
    return () => {
      labelsRef.current.forEach(label => {
        if (map.hasLayer(label)) {
          map.removeLayer(label);
        }
      });
      labelsRef.current = [];
    };
  }, [map]);

  if (!layerData || !layerData.data) {
    return null;
  }

  const { data, type, color, fillColor, fillOpacity, weight, radius, opacity, zIndex, showLabels, showLabelsOnHover } = layerData;

  /**
   * Style function for GeoJSON features
   */
  const getFeatureStyle = (feature) => {
    const baseStyle = {
      color: color || '#3b82f6',
      weight: weight || 2,
      opacity: opacity || 1,
      fillOpacity: fillOpacity || 0.2,
      fillColor: fillColor || color || '#3b82f6'
    };

    // Special styling based on feature type
    if (type === 'polygon') {
      return {
        ...baseStyle,
        fillOpacity: fillOpacity || 0.2
      };
    }

    if (type === 'line') {
      return {
        ...baseStyle,
        fill: false
      };
    }

    return baseStyle;
  };

  /**
   * Create popup content from feature properties (now using utility function)
   */
  const createPopupContent = (properties) => {
    return createMeaningfulPopup(properties, type);
  };

  /**
   * Handle each feature in the GeoJSON
   */
  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const popupContent = createPopupContent(feature.properties);
      layer.bindPopup(popupContent, {
        maxWidth: 320,
        className: 'custom-popup'
      });
    }

    // Add county labels if enabled (always visible)
    if (showLabels && feature.properties && (feature.properties.NAME || feature.properties.name)) {
      const labelText = feature.properties.NAME || feature.properties.name;
      
      // Add label after layer is added to map
      setTimeout(() => {
        if (layer.getBounds) {
          const bounds = layer.getBounds();
          const center = bounds.getCenter();
          
          // Create a simple text marker for the label
          const labelMarker = L.marker(center, {
            icon: L.divIcon({
              className: 'county-label',
              html: `<span class="county-name">${labelText}</span>`,
              iconSize: [80, 16],
              iconAnchor: [40, 8]
            }),
            interactive: false,
            zIndexOffset: 1000
          });
          
          labelMarker.addTo(map);
          labelsRef.current.push(labelMarker);
        }
      }, 100);
    }

    // Add hover-based labels if enabled (Enhanced with Carbon Data)
    if (showLabelsOnHover && feature.properties && (feature.properties.NAME || feature.properties.name)) {
      const labelText = feature.properties.NAME || feature.properties.name;
      let hoverLabel = null;

      layer.on('mouseover', async (e) => {
        if (layer.getBounds) {
          const bounds = layer.getBounds();
          const center = bounds.getCenter();
          
          // Check if this is a county for carbon data
          const isCounty = layerData?.name?.toLowerCase().includes('county') || 
                          layerData?.name?.toLowerCase().includes('counties') ||
                          labelText.toLowerCase().includes('county');
          
          let hoverContent = `<span class="county-name-hover">${labelText}</span>`;
          
          if (isCounty) {
            // Extract county name for carbon lookup
            const countyName = carbonEstimationService.extractCountyName(feature);
            
            if (countyName) {
              // Show loading state first
              hoverContent += `<div class="carbon-loading">🔄 Loading carbon data...</div>`;
              
              // Create initial hover label with loading
              hoverLabel = L.marker(center, {
                icon: L.divIcon({
                  className: 'county-label county-label-hover county-label-with-carbon',
                  html: `<div class="county-hover-content">${hoverContent}</div>`,
                  iconSize: [200, 60],
                  iconAnchor: [100, 30]
                }),
                interactive: false,
                zIndexOffset: 2000
              });
              
              hoverLabel.addTo(map);
              
              try {
                // Fetch carbon data
                const carbonData = await carbonEstimationService.getCountyCarbon(countyName);
                
                // Update with carbon data if hover label still exists
                if (hoverLabel && map.hasLayer(hoverLabel)) {
                  // Check if the response has the expected structure
                  if (carbonData && carbonData.county_name && carbonData.total_carbon_tons !== undefined) {
                    // The carbonEstimationService returns the direct data, not wrapped
                    const carbonInfo = carbonData;
                    hoverContent = `
                      <span class="county-name-hover">${labelText}</span>
                      <div class="carbon-data">
                        <div class="carbon-item">🌲 ${carbonEstimationService.formatCarbonValue(carbonInfo.total_carbon_tons)}</div>
                        <div class="carbon-item">💨 ${carbonEstimationService.formatCO2Value(carbonInfo.total_co2_equivalent_tons)}</div>
                      </div>
                    `;
                    
                    // Update the hover label content
                    const newIcon = L.divIcon({
                      className: 'county-label county-label-hover county-label-with-carbon',
                      html: `<div class="county-hover-content">${hoverContent}</div>`,
                      iconSize: [220, 80],
                      iconAnchor: [110, 40]
                    });
                    
                    hoverLabel.setIcon(newIcon);
                  } else {
                    console.warn(`❌ Invalid carbon data structure:`, carbonData);
                    throw new Error('Invalid response structure');
                  }
                }
              } catch (error) {
                console.warn(`Carbon data unavailable for ${countyName}:`, error.message);
                // Update with error message if hover label still exists
                if (hoverLabel && map.hasLayer(hoverLabel)) {
                  hoverContent = `
                    <span class="county-name-hover">${labelText}</span>
                    <div class="carbon-error">⚠️ Carbon data unavailable</div>
                  `;
                  
                  const errorIcon = L.divIcon({
                    className: 'county-label county-label-hover county-label-with-carbon',
                    html: `<div class="county-hover-content">${hoverContent}</div>`,
                    iconSize: [200, 60],
                    iconAnchor: [100, 30]
                  });
                  
                  hoverLabel.setIcon(errorIcon);
                }
              }
            } else {
              // Regular county without carbon lookup capability
              hoverLabel = L.marker(center, {
                icon: L.divIcon({
                  className: 'county-label county-label-hover',
                  html: `<span class="county-name-hover">${labelText}</span>`,
                  iconSize: [120, 20],
                  iconAnchor: [60, 10]
                }),
                interactive: false,
                zIndexOffset: 2000
              });
              
              hoverLabel.addTo(map);
            }
          } else {
            // Non-county feature (regular behavior)
            hoverLabel = L.marker(center, {
              icon: L.divIcon({
                className: 'county-label county-label-hover',
                html: `<span class="county-name-hover">${labelText}</span>`,
                iconSize: [120, 20],
                iconAnchor: [60, 10]
              }),
              interactive: false,
              zIndexOffset: 2000
            });
            
            hoverLabel.addTo(map);
          }
        }
      });

      layer.on('mouseout', (e) => {
        if (hoverLabel) {
          map.removeLayer(hoverLabel);
          hoverLabel = null;
        }
      });
    }

    // Add hover effects for polygons and lines
    if (feature.geometry.type === 'Polygon' || 
        feature.geometry.type === 'MultiPolygon' ||
        feature.geometry.type === 'LineString' ||
        feature.geometry.type === 'MultiLineString') {
      
      layer.on({
        mouseover: (e) => {
          const targetLayer = e.target;
          targetLayer.setStyle({
            weight: (weight || 2) + 2,
            fillOpacity: Math.min((fillOpacity || 0.2) + 0.2, 0.7),
            opacity: 1
          });
          targetLayer.bringToFront();
        },
        mouseout: (e) => {
          const targetLayer = e.target;
          targetLayer.setStyle(getFeatureStyle(feature));
        }
      });
    }

    // Note: Z-index is handled by the rendering order in React components
  };

  /**
   * Custom point renderer with zoom-responsive sizing and better visibility
   */
  const pointToLayer = (feature, latlng) => {
    if (type === 'point') {
      // Get current zoom level for responsive sizing
      const currentZoom = map.getZoom();
      const zoomMultiplier = Math.max(0.7, Math.min(2, currentZoom / 7)); // Scale between 0.7x and 2x
      const responsiveRadius = (radius || 5) * zoomMultiplier;
      
      const marker = L.circleMarker(latlng, {
        radius: responsiveRadius,
        fillColor: fillColor || color || '#3b82f6',
        color: color || '#ffffff',
        weight: (weight || 2) + 1, // Slightly thicker border for visibility
        opacity: opacity || 1,
        fillOpacity: fillOpacity || 0.9
      });

      // Add enhanced hover effects for points
      marker.on({
        mouseover: (e) => {
          const targetMarker = e.target;
          targetMarker.setStyle({
            radius: responsiveRadius * 1.5, // 50% larger on hover
            fillOpacity: 1,
            weight: (weight || 2) + 2,
            color: '#ffff00', // Bright yellow border on hover
          });
          targetMarker.bringToFront();
        },
        mouseout: (e) => {
          const targetMarker = e.target;
          targetMarker.setStyle({
            radius: responsiveRadius,
            fillColor: fillColor || color || '#3b82f6',
            color: color || '#ffffff',
            weight: (weight || 2) + 1,
            opacity: opacity || 1,
            fillOpacity: fillOpacity || 0.9
          });
        }
      });

      return marker;
    }
    return L.marker(latlng);
  };

  // Handle different data structures (Feature vs FeatureCollection)
  const geoJsonData = data.type === 'Feature' ? {
    type: 'FeatureCollection',
    features: [data]
  } : data;

  return (
    <GeoJSON
      ref={geoJsonRef}
      key={`${layerData.id}-${JSON.stringify(geoJsonData).length}`}
      data={geoJsonData}
      style={getFeatureStyle}
      onEachFeature={onEachFeature}
      pointToLayer={pointToLayer}
    />
  );
};

export default GeoJsonLayer; 