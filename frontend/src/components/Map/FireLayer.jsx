import React, { useEffect, useState, useCallback } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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
   * Create popup content for fire detection with inline styles only
   */
  const createFirePopupContent = (feature) => {
    const fireInfo = fireTrackingService.formatFireDetection(feature);
    const props = feature.properties;
    
    // Get confidence color
    const getConfidenceColor = (level) => {
      const colors = {
        'High': '#22c55e',
        'Medium': '#f59e0b',
        'Low': '#ef4444',
        'Very Low': '#dc2626'
      };
      return colors[level] || '#6b7280';
    };
    
    // Get intensity color
    const getIntensityColor = (level) => {
      const colors = {
        'Very High': '#dc2626',
        'High': '#ef4444',
        'Medium': '#f59e0b',
        'Low': '#22c55e',
        'Very Low': '#16a34a'
      };
      return colors[level] || '#6b7280';
    };
    
    return (
      <div style={{
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        color: '#1e293b',
        minWidth: '300px',
        maxWidth: '350px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px',
          background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)',
          color: 'white',
          borderRadius: '8px 8px 0 0',
          marginBottom: '12px',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)'
        }}>
          <div style={{ fontSize: '24px' }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '700',
              marginBottom: '2px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
            }}>
              Fire Detection
            </div>
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.95,
              fontWeight: '500'
            }}>
              {fireInfo.dataset}
            </div>
          </div>
        </div>
        
        <div style={{ padding: '0 8px 8px 8px' }}>
          {/* Primary Detection Info */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#475569',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🕒</span> Detection Details
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Time:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{fireInfo.detectionTime}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Satellite:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{fireInfo.satellite}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Instrument:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{props.instrument || 'Unknown'}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Day/Night:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>
                {props.daynight === 'D' ? '☀️ Day' : props.daynight === 'N' ? '🌙 Night' : 'Unknown'}
              </span>
            </div>
          </div>

          {/* Fire Characteristics */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            border: '1px solid #fecaca'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#dc2626',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🔥</span> Fire Characteristics
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Confidence:</span>
              <span style={{ 
                color: getConfidenceColor(fireInfo.confidenceLevel),
                fontWeight: '700',
                fontSize: '14px'
              }}>
                {fireInfo.confidence}% ({fireInfo.confidenceLevel})
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Intensity:</span>
              <span style={{ 
                color: getIntensityColor(fireInfo.fireIntensity),
                fontWeight: '700',
                fontSize: '14px'
              }}>
                {fireInfo.fireIntensity}
              </span>
            </div>
            
            {fireInfo.fireRadiativePower > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>FRP:</span>
                <span style={{ color: '#dc2626', fontWeight: '700' }}>
                  {fireInfo.fireRadiativePower.toFixed(2)} MW
                </span>
              </div>
            )}
            
            {fireInfo.brightness > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Brightness:</span>
                <span style={{ color: '#ea580c', fontWeight: '700' }}>
                  {fireInfo.brightness.toFixed(1)} K
                </span>
              </div>
            )}
          </div>

          {/* Technical Details */}
          <div style={{
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            border: '1px solid #cbd5e1'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#475569',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📡</span> Technical Data
            </div>
            
            {fireInfo.scan > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Scan Angle:</span>
                <span style={{ color: '#0f172a', fontWeight: '600' }}>{fireInfo.scan.toFixed(2)}°</span>
              </div>
            )}
            
            {fireInfo.track > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Track Angle:</span>
                <span style={{ color: '#0f172a', fontWeight: '600' }}>{fireInfo.track.toFixed(2)}°</span>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>Version:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{props.version || 'Unknown'}</span>
            </div>
            
            {/* Additional brightness temperatures for VIIRS */}
            {props.bright_ti5 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Brightness (I5):</span>
                <span style={{ color: '#0f172a', fontWeight: '600' }}>
                  {parseFloat(props.bright_ti5).toFixed(1)} K
                </span>
              </div>
            )}
            
            {props.bright_t31 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Brightness (T31):</span>
                <span style={{ color: '#0f172a', fontWeight: '600' }}>
                  {parseFloat(props.bright_t31).toFixed(1)} K
                </span>
              </div>
            )}
          </div>
          
          {/* Location */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#1e40af',
              marginBottom: '4px'
            }}>
              📍 {fireInfo.coordinates[1].toFixed(6)}°N, {Math.abs(fireInfo.coordinates[0]).toFixed(6)}°W
            </div>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              fontFamily: 'monospace'
            }}>
              Lat: {fireInfo.coordinates[1].toFixed(8)}, Lon: {fireInfo.coordinates[0].toFixed(8)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add CSS to ensure fire markers are clickable
  useEffect(() => {
    const styleId = 'fire-marker-styles';
    
    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      /* Critical fix: Allow pointer events on interactive elements within SVG */
      .leaflet-overlay-pane {
        pointer-events: none;
      }
      
      .leaflet-overlay-pane svg {
        pointer-events: none;
      }
      
      .leaflet-overlay-pane svg .leaflet-interactive {
        pointer-events: all !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [map]);

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

        // Create event handlers - working logic
        const markerEventHandlers = {
          click: (e) => {
            handleFireClick(feature, latlng);
          },
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({
              radius: style.radius * 1.2,
              weight: style.weight + 1,
              fillOpacity: 0.9
            });
          },
          mouseout: (e) => {
            const target = e.target;
            target.setStyle({
              radius: style.radius,
              weight: style.weight,
              fillOpacity: style.fillOpacity
            });
          },
          add: (e) => {
            const target = e.target;
            if (target._path) {
              target._path.style.pointerEvents = 'auto';
              target._path.style.cursor = 'pointer';
            }
          }
        };

        return (
          <CircleMarker
            key={fireInfo.id}
            center={latlng}
            radius={style.radius} // Original size from service
            pathOptions={{
              fillColor: style.fillColor,
              color: style.color,
              weight: style.weight, // Original weight
              opacity: style.opacity,
              fillOpacity: style.fillOpacity,
              className: 'fire-circle-marker',
              interactive: true
            }}
            eventHandlers={markerEventHandlers}
          >
            {showPopups && (
              <Popup 
                minWidth={330}
                maxWidth={380}
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
