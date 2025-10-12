/**
 * Location Selector Component
 * Interactive map for selecting comparison location
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import './LocationSelector.css';

// Custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-location-marker',
    html: `<div class="marker-pin">
             <div class="marker-pulse"></div>
             <div class="marker-icon">📍</div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

/**
 * Map click handler component
 */
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      
      // Check if within Texas bounds (approximate)
      if (lat >= 25.84 && lat <= 36.50 && lng >= -106.65 && lng <= -93.51) {
        onLocationSelect({ lat, lng });
      }
    }
  });
  return null;
};

/**
 * Outside Texas Mask Component
 * Creates a darkened overlay outside Texas boundaries
 */
const OutsideTexasMask = ({ texasGeojson }) => {
  if (!texasGeojson) return null;

  try {
    // Extract Texas geometry
    let texasGeometry;
    if (texasGeojson.type === 'FeatureCollection') {
      texasGeometry = texasGeojson.features[0].geometry;
    } else if (texasGeojson.type === 'Feature') {
      texasGeometry = texasGeojson.geometry;
    } else {
      texasGeometry = texasGeojson;
    }

    // Handle MultiPolygon - use the largest polygon (mainland Texas)
    let texasCoords;
    if (texasGeometry.type === 'MultiPolygon') {
      // Find the largest polygon (by number of coordinates)
      const polygons = texasGeometry.coordinates;
      const largestPolygon = polygons.reduce((largest, current) => {
        return current[0].length > largest[0].length ? current : largest;
      }, polygons[0]);
      texasCoords = largestPolygon;
    } else if (texasGeometry.type === 'Polygon') {
      texasCoords = texasGeometry.coordinates;
    } else {
      console.warn('Unexpected geometry type:', texasGeometry.type);
      return null;
    }

    // Create mask with hole for Texas
    const maskWithHole = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          // Outer ring (world bounds)
          [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90]
          ],
          // Inner ring (Texas - creates a hole)
          // Use only the outer ring of the polygon
          texasCoords[0]
        ]
      }
    };

    return (
      <GeoJSON
        data={maskWithHole}
        style={{
          fillColor: '#000000',
          fillOpacity: 0.5,
          color: 'transparent',
          weight: 0
        }}
        interactive={false}
      />
    );
  } catch (error) {
    console.error('Error creating Texas mask:', error);
    return null;
  }
};

const LocationSelector = ({ onLocationSelect, selectedLocation }) => {
  const [mapCenter] = useState([31.17, -100.08]); // Center of Texas
  const [mapZoom] = useState(6);
  const [texasBoundaryData, setTexasBoundaryData] = useState(null);
  const mapRef = useRef(null);

  const handleLocationSelect = useCallback((location) => {
    console.log('📍 Location clicked:', location);
    onLocationSelect(location);
  }, [onLocationSelect]);

  /**
   * Load Texas GeoJSON boundary data
   */
  useEffect(() => {
    const loadTexasBoundary = async () => {
      try {
        const response = await fetch('/default_geojsons/texas.geojson');
        if (response.ok) {
          const data = await response.json();
          setTexasBoundaryData(data);
          console.log('✅ Texas boundary GeoJSON loaded for Satellite Comparison Map');
        } else {
          console.warn('⚠️ Failed to load Texas boundary GeoJSON');
        }
      } catch (error) {
        console.error('❌ Error loading Texas boundary:', error);
      }
    };

    loadTexasBoundary();
  }, []);

  return (
    <div className="location-selector">
      <div className="map-container-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="location-map"
          ref={mapRef}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          {/* Base map layer */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
            maxZoom={18}
          />

          {/* Darken area outside Texas */}
          {texasBoundaryData && <OutsideTexasMask texasGeojson={texasBoundaryData} />}

          {/* Texas boundary - using actual GeoJSON data */}
          {texasBoundaryData && (
            <GeoJSON
              data={texasBoundaryData}
              style={{
                fillColor: 'rgba(20, 40, 80, 0.15)', // Darker blue fill
                color: '#0d1f3d', // Much darker blue border
                weight: 4,
                opacity: 1,
                fillOpacity: 0.15,
                dashArray: '8, 4'
              }}
              interactive={false}
            />
          )}

          {/* Click handler */}
          <MapClickHandler onLocationSelect={handleLocationSelect} />

          {/* Selected location marker */}
          {selectedLocation && (
            <Marker
              position={[selectedLocation.lat, selectedLocation.lng]}
              icon={createCustomIcon()}
            >
              <Popup>
                <div className="location-popup">
                  <h4>Selected Location</h4>
                  <p>
                    <strong>Latitude:</strong> {selectedLocation.lat.toFixed(6)}
                  </p>
                  <p>
                    <strong>Longitude:</strong> {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Map instructions overlay */}
        {/* <div className="map-instructions">
          <div className="instruction-card">
            <span className="instruction-icon">👆</span>
            <span className="instruction-text">
              {selectedLocation 
                ? `Selected: (${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)})` 
                : 'Click anywhere on the map to select a location'}
            </span>
          </div>
        </div> */}
      </div>

      {/* Selection info */}
      {selectedLocation && (
        <div className="selection-info fade-in">
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">✅</span>
              <h3>Location Selected</h3>
            </div>
            <div className="info-details">
              <div className="info-row">
                <span className="info-label">Latitude:</span>
                <span className="info-value">{selectedLocation.lat.toFixed(6)}°</span>
              </div>
              <div className="info-row">
                <span className="info-label">Longitude:</span>
                <span className="info-value">{selectedLocation.lng.toFixed(6)}°</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;

