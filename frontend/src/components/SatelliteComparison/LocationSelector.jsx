/**
 * Location Selector Component
 * Interactive map for selecting comparison location
 */

import React, { useState, useCallback, useRef } from 'react';
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

const LocationSelector = ({ onLocationSelect, selectedLocation }) => {
  const [mapCenter] = useState([31.17, -100.08]); // Center of Texas
  const [mapZoom] = useState(6);
  const mapRef = useRef(null);

  const handleLocationSelect = useCallback((location) => {
    console.log('📍 Location clicked:', location);
    onLocationSelect(location);
  }, [onLocationSelect]);

  // Texas boundary for reference
  const texasBoundary = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-106.65, 25.84],
        [-93.51, 25.84],
        [-93.51, 36.50],
        [-106.65, 36.50],
        [-106.65, 25.84]
      ]]
    }
  };

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

          {/* Texas boundary */}
          <GeoJSON
            data={texasBoundary}
            style={{
              fillColor: 'transparent',
              color: '#667eea',
              weight: 3,
              dashArray: '10, 5',
              opacity: 0.8
            }}
          />

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

