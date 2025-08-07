import React, { useEffect, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { createMeaningfulPopup } from '../../utils/mapUtils';

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

  const { data, type, color, fillColor, fillOpacity, weight, radius, opacity, zIndex, showLabels } = layerData;

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

    // Add county labels if enabled
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