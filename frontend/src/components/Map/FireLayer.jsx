import React, { useEffect, useState, useCallback } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import { fireTrackingService } from '../../services/fireTrackingService';

/**
 * Fire Layer Component
 * Displays real-time fire detections from NASA FIRMS API
 */
const FireLayer = ({ 
  isVisible = true, 
  dataset = 'VIIRS_NOAA20_NRT', 
  days = 1,
  onFireDataUpdate = null,
  showPopups = true 
}) => {
  const [fireData, setFireData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const map = useMap();

  /**
   * Load fire data from API
   */
  const loadFireData = useCallback(async () => {
    if (!isVisible) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔥 Loading fire data: dataset=${dataset}, days=${days}`);
      const data = await fireTrackingService.getTexasFireData(dataset, days);
      
      setFireData(data);
      setLastUpdate(new Date());
      
      // Notify parent component of data update
      if (onFireDataUpdate) {
        onFireDataUpdate({
          totalDetections: data.features.length,
          dataset: dataset,
          lastUpdate: new Date(),
          metadata: data.metadata
        });
      }
      
      console.log(`✅ Fire data loaded: ${data.features.length} detections`);
    } catch (err) {
      console.error('❌ Failed to load fire data:', err);
      setError(err.message);
      
      if (onFireDataUpdate) {
        onFireDataUpdate({
          totalDetections: 0,
          dataset: dataset,
          lastUpdate: new Date(),
          error: err.message
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isVisible, dataset, days]); // Removed onFireDataUpdate from dependencies

  // Load fire data on component mount and when parameters change
  useEffect(() => {
    loadFireData();
  }, [loadFireData]);

  // Auto-refresh every 5 minutes when visible
  useEffect(() => {
    if (!isVisible) return;

    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing fire data...');
      // Call the service directly to avoid dependency issues
      fireTrackingService.getTexasFireData(dataset, days)
        .then(data => {
          setFireData(data);
          setLastUpdate(new Date());
          if (onFireDataUpdate) {
            onFireDataUpdate({
              totalDetections: data.features.length,
              dataset: dataset,
              lastUpdate: new Date(),
              metadata: data.metadata
            });
          }
        })
        .catch(err => {
          console.error('❌ Auto-refresh failed:', err);
          setError(err.message);
        });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [isVisible, dataset, days]); // Removed loadFireData and onFireDataUpdate from dependencies

  /**
   * Handle fire marker click
   */
  const handleFireClick = useCallback((feature, latlng) => {
    const fireInfo = fireTrackingService.formatFireDetection(feature);
    
    // Zoom to fire location
    map.setView(latlng, Math.max(map.getZoom(), 10), {
      animate: true,
      duration: 0.5
    });
    
    console.log('🔥 Fire detection clicked:', fireInfo);
  }, [map]);

  /**
   * Create popup content for fire detection
   */
  const createFirePopupContent = (feature) => {
    const fireInfo = fireTrackingService.formatFireDetection(feature);
    const props = feature.properties;
    
    return (
      <div className="fire-popup">
        <div className="fire-popup-header">
          <div className="fire-popup-icon">🔥</div>
          <div className="fire-popup-title">Fire Detection</div>
          <div className="fire-popup-dataset">{fireInfo.dataset}</div>
        </div>
        
        <div className="fire-popup-content">
          {/* Primary Detection Info */}
          <div className="fire-popup-section">
            <div className="fire-popup-section-title">🕒 Detection Details</div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Time:</span>
              <span className="fire-popup-value">{fireInfo.detectionTime}</span>
            </div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Satellite:</span>
              <span className="fire-popup-value">{fireInfo.satellite}</span>
            </div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Instrument:</span>
              <span className="fire-popup-value">{props.instrument || 'Unknown'}</span>
            </div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Day/Night:</span>
              <span className="fire-popup-value">
                {props.daynight === 'D' ? '☀️ Day' : props.daynight === 'N' ? '🌙 Night' : 'Unknown'}
              </span>
            </div>
          </div>

          {/* Fire Characteristics */}
          <div className="fire-popup-section">
            <div className="fire-popup-section-title">🔥 Fire Characteristics</div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Confidence:</span>
              <span className={`fire-popup-value confidence-${fireInfo.confidenceLevel.toLowerCase().replace(' ', '-')}`}>
                {fireInfo.confidence}% ({fireInfo.confidenceLevel})
              </span>
            </div>
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Intensity:</span>
              <span className={`fire-popup-value intensity-${fireInfo.fireIntensity.toLowerCase().replace(' ', '-')}`}>
                {fireInfo.fireIntensity}
              </span>
            </div>
            
            {fireInfo.fireRadiativePower > 0 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">FRP:</span>
                <span className="fire-popup-value">{fireInfo.fireRadiativePower.toFixed(2)} MW</span>
              </div>
            )}
            
            {fireInfo.brightness > 0 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">Brightness:</span>
                <span className="fire-popup-value">{fireInfo.brightness.toFixed(1)} K</span>
              </div>
            )}
          </div>

          {/* Technical Details */}
          <div className="fire-popup-section">
            <div className="fire-popup-section-title">📡 Technical Data</div>
            
            {fireInfo.scan > 0 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">Scan Angle:</span>
                <span className="fire-popup-value">{fireInfo.scan.toFixed(2)}°</span>
              </div>
            )}
            
            {fireInfo.track > 0 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">Track Angle:</span>
                <span className="fire-popup-value">{fireInfo.track.toFixed(2)}°</span>
              </div>
            )}
            
            <div className="fire-popup-row">
              <span className="fire-popup-label">Version:</span>
              <span className="fire-popup-value">{props.version || 'Unknown'}</span>
            </div>
            
            {/* Additional brightness temperatures for VIIRS */}
            {props.bright_ti5 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">Brightness (I5):</span>
                <span className="fire-popup-value">{parseFloat(props.bright_ti5).toFixed(1)} K</span>
              </div>
            )}
            
            {props.bright_t31 && (
              <div className="fire-popup-row">
                <span className="fire-popup-label">Brightness (T31):</span>
                <span className="fire-popup-value">{parseFloat(props.bright_t31).toFixed(1)} K</span>
              </div>
            )}
          </div>
          
          {/* Location */}
          <div className="fire-popup-coordinates">
            📍 {fireInfo.coordinates[1].toFixed(6)}°N, {Math.abs(fireInfo.coordinates[0]).toFixed(6)}°W
            <div className="fire-popup-coordinates-detail">
              Lat: {fireInfo.coordinates[1].toFixed(8)}, Lon: {fireInfo.coordinates[0].toFixed(8)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Don't render anything if not visible or no data
  if (!isVisible || !fireData || !fireData.features) {
    return null;
  }

  return (
    <>
      {fireData.features.map((feature, index) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const latlng = [latitude, longitude];
        const style = fireTrackingService.getFireMarkerStyle(feature);
        const fireInfo = fireTrackingService.formatFireDetection(feature);

        return (
          <CircleMarker
            key={fireInfo.id}
            center={latlng}
            radius={style.radius}
            pathOptions={{
              fillColor: style.fillColor,
              color: style.color,
              weight: style.weight,
              opacity: style.opacity,
              fillOpacity: style.fillOpacity
            }}
            eventHandlers={{
              click: () => handleFireClick(feature, latlng)
            }}
          >
            {showPopups && (
              <Popup 
                maxWidth={300}
                className="fire-popup-container"
                closeButton={true}
                autoClose={false}
                closeOnClick={false}
              >
                {createFirePopupContent(feature)}
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
};

export default FireLayer;
